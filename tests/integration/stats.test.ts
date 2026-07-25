import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { statsService, STATS_WINDOW_LABELS, type StatsWindow } from '@/services/stats.service'

const testDsn = process.env.DATABASE_URL ?? ''
if (!/_test([-?]|$)/.test(testDsn)) {
  throw new Error(
    `Refusing to run stats tests: DATABASE_URL must target a test database (got "${testDsn}").`,
  )
}

let devId: string
let submitterId: string
let projectA: string
let projectB: string

beforeAll(async () => {
  // Wipe everything to get a clean stats canvas.
  await db.statusLog.deleteMany()
  await db.vote.deleteMany()
  await db.comment.deleteMany()
  await db.requirement.deleteMany()
  await db.projectMember.deleteMany()
  await db.project.deleteMany()
  await db.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 12)
  const dev = await db.user.create({
    data: { email: 'dev-stats@test.dev', name: 'Stats Dev', passwordHash, role: 'DEVELOPER' },
  })
  const submitter = await db.user.create({
    data: { email: 'submitter-stats@test.dev', name: 'Stats Submitter', passwordHash, role: 'SUBMITTER' },
  })
  devId = dev.id
  submitterId = submitter.id

  const a = await db.project.create({
    data: {
      name: 'Project A',
      slug: 'stats-a',
      lastRequirementNumber: 0,
      members: {
        create: [
          { userId: dev.id, role: 'OWNER' },
        ],
      },
    },
  })
  const b = await db.project.create({
    data: {
      name: 'Project B',
      slug: 'stats-b',
      lastRequirementNumber: 0,
      members: {
        create: [
          { userId: dev.id, role: 'OWNER' },
        ],
      },
    },
  })
  projectA = a.id
  projectB = b.id
})

afterAll(async () => {
  await db.$disconnect()
})

beforeEach(async () => {
  await db.statusLog.deleteMany()
  await db.vote.deleteMany()
  await db.comment.deleteMany()
  await db.requirement.deleteMany()
})

let globalCounter = 0
async function makeRequirement(args: {
  projectId?: string | null
  authorId: string
  status?: 'SUBMITTED' | 'UNDER_REVIEW' | 'IN_DEVELOPMENT' | 'ACCEPTED'
  daysAgo?: number
}) {
  globalCounter += 1
  const r = await db.requirement.create({
    data: {
      projectId: args.projectId ?? null,
      authorId: args.authorId,
      globalNumber: globalCounter,
      number: args.projectId ? null : null,
      title: `req ${Math.random().toString(36).slice(2, 8)}`,
      status: args.status ?? 'SUBMITTED',
    },
  })
  if (args.daysAgo !== undefined) {
    await db.requirement.update({
      where: { id: r.id },
      data: { createdAt: new Date(Date.now() - args.daysAgo * 86_400_000) },
    })
  }
  return r
}

describe('StatsService.getProjectBacklog', () => {
  it('groups open requirements by project, sorted by backlog size', async () => {
    // Project A: 3 open, Project B: 1 open, Unassigned: 2 open
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'IN_DEVELOPMENT' })
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'UNDER_REVIEW' })
    await makeRequirement({ projectId: projectB, authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ projectId: null, authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ projectId: null, authorId: submitterId, status: 'IN_DEVELOPMENT' })

    const result = await statsService.getProjectBacklog()

    expect(result).toHaveLength(3)
    // Project A first (3 open)
    expect(result[0].totalOpen).toBe(3)
    expect(result[0].projectName).toBe('Project A')
    expect(result[0].projectSlug).toBe('stats-a')
    // Unassigned second (2 open)
    expect(result[1].totalOpen).toBe(2)
    expect(result[1].projectName).toBe('未归集')
    expect(result[1].projectSlug).toBeNull()
    // Project B last (1 open)
    expect(result[2].totalOpen).toBe(1)
  })

  it('ignores closed (ACCEPTED/REJECTED) requirements', async () => {
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'ACCEPTED' })
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'SUBMITTED' })

    const result = await statsService.getProjectBacklog()
    expect(result).toHaveLength(1)
    expect(result[0].totalOpen).toBe(1)
  })

  it('returns empty array when no open requirements', async () => {
    const result = await statsService.getProjectBacklog()
    expect(result).toHaveLength(0)
  })

  it('breaks down by status', async () => {
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ projectId: projectA, authorId: submitterId, status: 'IN_DEVELOPMENT' })

    const result = await statsService.getProjectBacklog()
    const a = result.find((r) => r.projectId === projectA)
    expect(a?.byStatus.SUBMITTED).toBe(2)
    expect(a?.byStatus.IN_DEVELOPMENT).toBe(1)
  })
})

describe('StatsService.getWindowedStats', () => {
  it('returns total requirements for "all" window', async () => {
    await makeRequirement({ authorId: submitterId, daysAgo: 0 })
    await makeRequirement({ authorId: submitterId, daysAgo: 60 })
    const result = await statsService.getWindowedStats('all')
    expect(result.total).toBe(2)
    expect(result.window).toBe('all')
  })

  it('week window only counts recent requirements', async () => {
    await makeRequirement({ authorId: submitterId, daysAgo: 1 })
    await makeRequirement({ authorId: submitterId, daysAgo: 30 })
    const result = await statsService.getWindowedStats('week')
    expect(result.total).toBe(1)
  })

  it('month window captures last 30 days', async () => {
    await makeRequirement({ authorId: submitterId, daysAgo: 5 })
    await makeRequirement({ authorId: submitterId, daysAgo: 20 })
    await makeRequirement({ authorId: submitterId, daysAgo: 60 })
    const result = await statsService.getWindowedStats('month')
    expect(result.total).toBe(2)
  })

  it('quarter window captures last 90 days', async () => {
    await makeRequirement({ authorId: submitterId, daysAgo: 30 })
    await makeRequirement({ authorId: submitterId, daysAgo: 80 })
    await makeRequirement({ authorId: submitterId, daysAgo: 100 })
    const result = await statsService.getWindowedStats('quarter')
    expect(result.total).toBe(2)
  })

  it('separates open vs closed counts', async () => {
    await makeRequirement({ authorId: submitterId, status: 'SUBMITTED' })
    await makeRequirement({ authorId: submitterId, status: 'ACCEPTED' })
    const result = await statsService.getWindowedStats('all')
    expect(result.total).toBe(2)
    expect(result.open).toBe(1)
    expect(result.closed).toBe(1)
  })
})

describe('StatsService.getUserLeaderboard', () => {
  it('ranks submitters by requirement count', async () => {
    await makeRequirement({ authorId: submitterId })
    await makeRequirement({ authorId: submitterId })
    await makeRequirement({ authorId: devId })

    const result = await statsService.getUserLeaderboard('all')
    expect(result.topSubmitters[0].user.id).toBe(submitterId)
    expect(result.topSubmitters[0].count).toBe(2)
    expect(result.topSubmitters[1].user.id).toBe(devId)
    expect(result.topSubmitters[1].count).toBe(1)
  })

  it('ranks closers by ACCEPTED requirement count', async () => {
    await makeRequirement({ authorId: submitterId, status: 'ACCEPTED' })
    await makeRequirement({ authorId: submitterId, status: 'ACCEPTED' })
    await makeRequirement({ authorId: devId, status: 'SUBMITTED' })

    const result = await statsService.getUserLeaderboard('all')
    expect(result.topClosers[0].user.id).toBe(submitterId)
    expect(result.topClosers[0].count).toBe(2)
    expect(result.topClosers).toHaveLength(1)
  })

  it('filters by time window', async () => {
    await makeRequirement({ authorId: submitterId, daysAgo: 1 })
    await makeRequirement({ authorId: submitterId, daysAgo: 60 })
    const result = await statsService.getUserLeaderboard('week')
    expect(result.topSubmitters[0].count).toBe(1)
  })

  it('handles empty data gracefully', async () => {
    const result = await statsService.getUserLeaderboard('all')
    expect(result.topSubmitters).toHaveLength(0)
    expect(result.topClosers).toHaveLength(0)
  })
})

describe('StatsService.STATS_WINDOW_LABELS', () => {
  it('has Chinese labels for every window', () => {
    const expected: StatsWindow[] = ['all', 'week', 'month', 'quarter']
    for (const w of expected) {
      expect(STATS_WINDOW_LABELS[w]).toBeTruthy()
    }
  })
})