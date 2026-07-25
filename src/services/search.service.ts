import { db } from '@/lib/db'
import type { Pagination } from '@/lib/api-helpers'
import { Prisma, type Prisma as PrismaTypes } from '@/generated/prisma/client'

/**
 * Requirement search.
 *
 *  - Substring matching uses `ILIKE` for case-insensitive substring
 *    (Postgres handles UTF-8 properly, so this works for Chinese / Japanese
 *    out of the box — pg_trgm's byte-trigram similarity is unreliable for
 *    multi-byte text).
 *  - The `pg_trgm` GIN index on `title` (and `body` when not null)
 *    accelerates the `ILIKE '%query%'` predicates (pg_trgm can speed up
 *    `LIKE`/`ILIKE` with GIN, unlike a plain btree index).
 *  - Results are ordered by a hand-rolled relevance score:
 *      - title exact substring (case-insensitive): +10
 *      - body exact substring:                        +5
 *      - more matches in title:                       +1 each
 *      - then by `votes desc`, `createdAt desc` as tiebreakers.
 */
export class SearchService {
  async searchRequirements(
    userId: string,
    query: string,
    pagination: Pagination,
  ) {
    const q = query.trim()
    if (!q) {
      return {
        data: [],
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      }
    }

    const memberships = await db.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    const projectIds = memberships.map((m) => m.projectId)

    const { page, pageSize } = pagination
    const offset = (page - 1) * pageSize

    const scopeClause: PrismaTypes.Sql =
      projectIds.length > 0
        ? Prisma.sql`(r."projectId" IS NULL AND r."authorId" = ${userId}) OR r."projectId" IN (${Prisma.join(projectIds)})`
        : Prisma.sql`r."projectId" IS NULL AND r."authorId" = ${userId}`

    // Combined WHERE: scope + (title or body contains query, case-insensitive)
    const matchClause = Prisma.sql`(${Prisma.sql`r."title" ILIKE ${'%' + q + '%'}`}) OR (r."body" IS NOT NULL AND r."body" ILIKE ${'%' + q + '%'})`

    const rankExpr = Prisma.sql`
      (
        CASE WHEN LOWER(r."title") LIKE LOWER(${q}) THEN 10 ELSE 0 END
      ) +
      (
        CASE WHEN r."title" ILIKE ${'%' + q + '%'} THEN 5 ELSE 0 END
      ) +
      (
        CASE WHEN r."body" IS NOT NULL AND r."body" ILIKE ${'%' + q + '%'} THEN 3 ELSE 0 END
      )
    `

    const result = await db.$queryRaw<
      Array<{
        id: string
        globalNumber: number
        number: number | null
        title: string
        body: string | null
        status: string
        priority: string
        createdAt: Date
        rank: number
        votes: number
      }>
    >(Prisma.sql`
      SELECT
        r."id",
        r."globalNumber",
        r."number",
        r."title",
        r."body",
        r."status",
        r."priority",
        r."createdAt",
        (SELECT ${rankExpr}) AS rank,
        (SELECT COUNT(*)::int FROM "Vote" v WHERE v."requirementId" = r."id") AS votes
      FROM "Requirement" r
      WHERE (${scopeClause}) AND (${matchClause})
      ORDER BY rank DESC, votes DESC, r."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `)

    const countResult = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "Requirement" r
      WHERE (${scopeClause}) AND (${matchClause})
    `)
    const totalItems = Number(countResult[0]?.count ?? 0)

    return {
      data: result.map((r) => ({
        id: r.id,
        globalNumber: r.globalNumber,
        number: r.number,
        title: r.title,
        body: r.body,
        status: r.status,
        priority: r.priority,
        createdAt: r.createdAt,
        rank: r.rank,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    }
  }
}

export const searchService = new SearchService()