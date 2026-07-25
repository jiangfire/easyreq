import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { searchService } from '@/services/search.service'

const testDsn = process.env.DATABASE_URL ?? ''
if (!/_test([-?]|$)/.test(testDsn)) {
  throw new Error(
    `Refusing to run search tests: DATABASE_URL must target a test database (got "${testDsn}").`,
  )
}

let submitterId: string
let devId: string
let projectA: string

beforeAll(async () => {
  await db.statusLog.deleteMany()
  await db.vote.deleteMany()
  await db.comment.deleteMany()
  await db.requirement.deleteMany()
  await db.projectMember.deleteMany()
  await db.project.deleteMany()
  await db.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 12)
  const submitter = await db.user.create({
    data: { email: 'submitter-search@test.dev', name: 'Search Submitter', passwordHash, role: 'SUBMITTER' },
  })
  const dev = await db.user.create({
    data: { email: 'dev-search@test.dev', name: 'Search Dev', passwordHash, role: 'DEVELOPER' },
  })
  submitterId = submitter.id
  devId = dev.id

  const a = await db.project.create({
    data: {
      name: 'Search A',
      slug: 'search-a',
      lastRequirementNumber: 0,
      members: {
        create: [
          { userId: dev.id, role: 'OWNER' },
          { userId: submitter.id, role: 'MEMBER' },
        ],
      },
    },
  })
  projectA = a.id
})

afterAll(async () => {
  await db.$disconnect()
})

let globalCounter = 0
async function makeRequirement(args: {
  projectId?: string | null
  authorId: string
  title: string
  body?: string | null
  status?: 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_DEVELOPMENT' | 'ACCEPTED'
}) {
  globalCounter += 1
  return db.requirement.create({
    data: {
      projectId: args.projectId ?? null,
      authorId: args.authorId,
      globalNumber: globalCounter,
      title: args.title,
      body: args.body ?? null,
      status: args.status ?? 'SUBMITTED',
    },
  })
}

beforeAll(async () => {
  await db.requirement.deleteMany()
  globalCounter = 0
})

beforeEach(async () => {
  await db.requirement.deleteMany()
  globalCounter = 0
})

describe('SearchService (pg_trgm)', () => {
  it('finds requirements by exact title match', async () => {
    await makeRequirement({ authorId: submitterId, title: '修复登录页面无法访问' })
    await makeRequirement({ authorId: submitterId, title: '优化报表导出' })
    const result = await searchService.searchRequirements(
      submitterId,
      '登录',
      { page: 1, pageSize: 25 },
    )
    expect(result.data.length).toBe(1)
    expect(result.data[0].title).toContain('登录')
  })

  it('finds by partial token in body', async () => {
    // Substring match: query appears inside body but not in title
    await makeRequirement({
      authorId: submitterId,
      title: 'sometitle',
      body: '用户登录时卡死',
    })
    const result = await searchService.searchRequirements(
      submitterId,
      '登录',
      { page: 1, pageSize: 25 },
    )
    expect(result.data.length).toBe(1)
    expect(result.data[0].rank).toBeGreaterThan(0)
  })

  it('ranks by relevance (title matches above body matches)', async () => {
    await makeRequirement({
      authorId: submitterId,
      title: '添加用户登录',
      body: '无关内容',
    })
    await makeRequirement({
      authorId: submitterId,
      title: '无关标题',
      body: '在登录页面添加多因素认证',
    })
    const result = await searchService.searchRequirements(
      submitterId,
      '登录',
      { page: 1, pageSize: 25 },
    )
    expect(result.data.length).toBe(2)
    const titleMatch = result.data.find((r) => r.title.includes('登录'))
    const bodyMatch = result.data.find((r) => r.body?.includes('登录'))
    expect(titleMatch).toBeDefined()
    expect(bodyMatch).toBeDefined()
    expect(titleMatch!.rank).toBeGreaterThan(bodyMatch!.rank)
  })

  it('returns results with rank values (for UI display)', async () => {
    await makeRequirement({ authorId: submitterId, title: '搜索关键字测试' })
    const result = await searchService.searchRequirements(
      submitterId,
      '搜索',
      { page: 1, pageSize: 25 },
    )
    // Rank is an integer 0-18 (title exact=10 + title contains=5 + body contains=3)
    expect(result.data[0].rank).toBeGreaterThan(0)
    expect(Number.isInteger(result.data[0].rank)).toBe(true)
  })

  it('returns no results for completely unrelated query', async () => {
    // No substring overlap with the query
    await makeRequirement({
      authorId: submitterId,
      title: '这个标题与查询毫无关系',
      body: '里面也没有任何相关词汇',
    })
    const result = await searchService.searchRequirements(
      submitterId,
      'veryuniquesearchterm',
      { page: 1, pageSize: 25 },
    )
    expect(result.data).toHaveLength(0)
  })

  it('returns empty result for empty query', async () => {
    const result = await searchService.searchRequirements(
      submitterId,
      '',
      { page: 1, pageSize: 25 },
    )
    expect(result.data).toHaveLength(0)
    expect(result.pagination.totalItems).toBe(0)
  })

  it('returns empty for whitespace-only query', async () => {
    const result = await searchService.searchRequirements(
      submitterId,
      '   \n\t  ',
      { page: 1, pageSize: 25 },
    )
    expect(result.data).toHaveLength(0)
  })

  it('paginates results with totalItems / totalPages', async () => {
    for (let i = 0; i < 7; i++) {
      await makeRequirement({
        authorId: submitterId,
        title: `共同的搜索词 标题 ${i}`,
      })
    }
    const result = await searchService.searchRequirements(
      submitterId,
      '共同',
      { page: 1, pageSize: 3 },
    )
    expect(result.data).toHaveLength(3)
    expect(result.pagination.totalItems).toBe(7)
    expect(result.pagination.totalPages).toBe(3)
  })

  it('scopes by visibility: SUBMITTER does not see other people\'s unassigned', async () => {
    // Create an unassigned req as dev (who has no project membership either)
    await makeRequirement({ authorId: devId, title: 'dev 私有的搜索结果' })
    // Create an unassigned req as submitter
    await makeRequirement({ authorId: submitterId, title: 'submitter 自己的搜索' })

    const result = await searchService.searchRequirements(
      submitterId,
      '搜索',
      { page: 1, pageSize: 25 },
    )
    // Should only see their own unassigned; not dev's
    expect(result.data.length).toBe(1)
    expect(result.data[0].title).toContain('submitter')
  })

  it('includes project requirements the user is a member of', async () => {
    await makeRequirement({
      projectId: projectA,
      authorId: devId,
      title: '搜索词 项目内的需求',
    })
    const result = await searchService.searchRequirements(
      submitterId,
      '搜索',
      { page: 1, pageSize: 25 },
    )
    expect(result.data.length).toBe(1)
  })

  it('order: higher rank first', async () => {
    await makeRequirement({ authorId: submitterId, title: '搜索' }) // exact
    await makeRequirement({ authorId: submitterId, title: '搜索词 后面接一些别的字' }) // contains
    await makeRequirement({ authorId: submitterId, title: '前缀 然后 搜索词' }) // contains
    const result = await searchService.searchRequirements(
      submitterId,
      '搜索',
      { page: 1, pageSize: 25 },
    )
    // All three should match, sorted by rank desc
    expect(result.data.length).toBe(3)
    for (let i = 0; i < result.data.length - 1; i++) {
      expect(result.data[i].rank).toBeGreaterThanOrEqual(result.data[i + 1].rank)
    }
  })
})