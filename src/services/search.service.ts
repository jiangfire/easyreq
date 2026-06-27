import { db } from '@/lib/db'
import type { Pagination } from '@/lib/api-helpers'

export class SearchService {
  /**
   * Full-text-ish search across requirements the user can see (members of).
   * Uses PostgreSQL `contains` (ILIKE) — no tsvector index yet, which is fine
   * for MVP volumes. Avoid mixing `search` operator on plain text columns
   * (it requires a tsvector and otherwise errors or is silently ignored).
   */
  async searchRequirements(userId: string, query: string, pagination: Pagination) {
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

    if (projectIds.length === 0) {
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

    const where = {
      projectId: { in: projectIds },
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { body: { contains: q, mode: 'insensitive' as const } },
      ],
    }

    const { page, pageSize } = pagination
    const [requirements, total] = await Promise.all([
      db.requirement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          project: { select: { slug: true, name: true } },
          _count: { select: { votes: true, comments: { where: { isDeleted: false } } } },
        },
      }),
      db.requirement.count({ where }),
    ])

    return {
      data: requirements,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }
}

export const searchService = new SearchService()
