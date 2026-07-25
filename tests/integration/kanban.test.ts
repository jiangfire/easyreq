import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requirementService } from '@/services/requirement.service'
import { canTransition, hasTransitionPermission, getAvailableTransitions } from '@/lib/transitions'
import type { ReqStatus } from '@/lib/transitions'

const testDsn = process.env.DATABASE_URL ?? ''
if (!/_test([-?]|$)/.test(testDsn)) {
  throw new Error(
    `Refusing to run kanban tests: DATABASE_URL must target a test database (got "${testDsn}").`,
  )
}

let submitterId: string
let managerId: string
let devId: string
let projectId: string

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
    data: { email: 'submitter-kanban@test.dev', name: 'Submitter', passwordHash, role: 'SUBMITTER' },
  })
  const manager = await db.user.create({
    data: { email: 'manager-kanban@test.dev', name: 'Manager', passwordHash, role: 'MANAGER' },
  })
  const dev = await db.user.create({
    data: { email: 'dev-kanban@test.dev', name: 'Dev', passwordHash, role: 'DEVELOPER' },
  })
  submitterId = submitter.id
  managerId = manager.id
  devId = dev.id

  const p = await db.project.create({
    data: {
      name: 'Kanban Test',
      slug: 'kanban-test',
      lastRequirementNumber: 0,
      members: {
        create: [
          { userId: manager.id, role: 'OWNER' },
          { userId: dev.id, role: 'MEMBER' },
          { userId: submitter.id, role: 'MEMBER' },
        ],
      },
    },
  })
  projectId = p.id
})

afterAll(async () => {
  await db.$disconnect()
})

let globalCounter = 0
async function makeReq(status: ReqStatus = 'SUBMITTED') {
  globalCounter += 1
  return db.requirement.create({
    data: {
      projectId,
      authorId: submitterId,
      globalNumber: globalCounter,
      number: globalCounter,
      title: `req ${globalCounter}`,
      status,
    },
  })
}

beforeEach(async () => {
  await db.statusLog.deleteMany()
  await db.requirement.deleteMany()
  globalCounter = 0
})

describe('Kanban transition matrix', () => {
  it('allows SUBMITTED → IN_DEVELOPMENT for MANAGER (quick path)', async () => {
    expect(canTransition('SUBMITTED', 'IN_DEVELOPMENT')).toBe(true)
    expect(hasTransitionPermission('SUBMITTED', 'IN_DEVELOPMENT', 'MANAGER')).toBe(true)

    const r = await makeReq('SUBMITTED')
    await requirementService.transition(r.id, managerId, 'MANAGER', 'IN_DEVELOPMENT')
    const updated = await db.requirement.findUnique({ where: { id: r.id } })
    expect(updated?.status).toBe('IN_DEVELOPMENT')
  })

  it('rejects SUBMITTED → ACCEPTED for SUBMITTER (illegal jump)', async () => {
    expect(canTransition('SUBMITTED', 'ACCEPTED')).toBe(false)

    const r = await makeReq('SUBMITTED')
    await expect(
      requirementService.transition(r.id, submitterId, 'SUBMITTER', 'ACCEPTED'),
    ).rejects.toBeInstanceOf(Error)
  })

  it('allows SUBMITTED → UNDER_REVIEW for MANAGER but not DEVELOPER', async () => {
    expect(hasTransitionPermission('SUBMITTED', 'UNDER_REVIEW', 'MANAGER')).toBe(true)
    expect(hasTransitionPermission('SUBMITTED', 'UNDER_REVIEW', 'DEVELOPER')).toBe(false)
  })

  it('allows DELIVERED → ACCEPTED for SUBMITTER (verifies own work)', async () => {
    expect(hasTransitionPermission('DELIVERED', 'ACCEPTED', 'SUBMITTER')).toBe(true)
  })

  it('IN_DEVELOPMENT → DELIVERED is quick path: only MANAGER/ADMIN', () => {
    // IN_DEVELOPMENT → DELIVERED skips IN_TESTING (quick path)
    // So DEVELOPER cannot do it — only MANAGER/ADMIN
    expect(hasTransitionPermission('IN_DEVELOPMENT', 'DELIVERED', 'DEVELOPER')).toBe(false)
    expect(hasTransitionPermission('IN_DEVELOPMENT', 'DELIVERED', 'MANAGER')).toBe(true)
    expect(hasTransitionPermission('IN_DEVELOPMENT', 'DELIVERED', 'SUBMITTER')).toBe(false)
  })

  it('IN_DEVELOPMENT → IN_TESTING is the standard path for DEVELOPER', () => {
    expect(canTransition('IN_DEVELOPMENT', 'IN_TESTING')).toBe(true)
    expect(hasTransitionPermission('IN_DEVELOPMENT', 'IN_TESTING', 'DEVELOPER')).toBe(true)
  })
})

describe('Kanban getAvailableTransitions', () => {
  it('returns the expected targets for SUBMITTED as MANAGER', () => {
    const targets = getAvailableTransitions('SUBMITTED', 'MANAGER')
    expect(targets).toContain('UNDER_REVIEW')
    expect(targets).toContain('PLANNED')
    expect(targets).toContain('IN_DEVELOPMENT')
  })

  it('returns no transitions for SUBMITTER from IN_DEVELOPMENT', () => {
    expect(getAvailableTransitions('IN_DEVELOPMENT', 'SUBMITTER')).toEqual([])
  })

  it('SUBMITTER can RESUBMIT (REJECTED → SUBMITTED)', () => {
    expect(hasTransitionPermission('REJECTED', 'SUBMITTED', 'SUBMITTER')).toBe(true)
  })
})

describe('Kanban drag-and-drop sequence', () => {
  it('walks SUBMITTED → IN_DEVELOPMENT → IN_TESTING → DELIVERED → ACCEPTED end-to-end', async () => {
    const r = await makeReq('SUBMITTED')

    await requirementService.transition(r.id, managerId, 'MANAGER', 'IN_DEVELOPMENT')
    await requirementService.transition(r.id, devId, 'DEVELOPER', 'IN_TESTING')
    await requirementService.transition(r.id, managerId, 'MANAGER', 'DELIVERED')
    await requirementService.transition(r.id, submitterId, 'SUBMITTER', 'ACCEPTED')

    const updated = await db.requirement.findUnique({ where: { id: r.id } })
    expect(updated?.status).toBe('ACCEPTED')

    const logs = await db.statusLog.findMany({
      where: { requirementId: r.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(logs.map((l) => l.toStatus)).toEqual([
      'IN_DEVELOPMENT',
      'IN_TESTING',
      'DELIVERED',
      'ACCEPTED',
    ])
  })

  it('creates a StatusLog entry with isQuickPath flag for the quick path', async () => {
    const r = await makeReq('SUBMITTED')
    await requirementService.transition(r.id, managerId, 'MANAGER', 'IN_DEVELOPMENT')

    const log = await db.statusLog.findFirst({
      where: { requirementId: r.id, toStatus: 'IN_DEVELOPMENT' },
    })
    expect(log?.isQuickPath).toBe(true) // SUBMITTED→IN_DEVELOPMENT is a quick path
  })
})