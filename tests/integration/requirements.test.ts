import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requirementService } from '@/services/requirement.service'
import { projectService } from '@/services/project.service'
import { commentService } from '@/services/comment.service'
import { voteService } from '@/services/vote.service'
import { AppError } from '@/lib/errors'

// SAFETY GUARD: refuse to run against any database whose name is not clearly
// a test database. This prevents cleanDatabase() from ever wiping dev/prod.
const testDsn = process.env.DATABASE_URL ?? ''
if (!/_test([-?]|$)/.test(testDsn)) {
  throw new Error(
    `Refusing to run integration tests: DATABASE_URL must target a test database (got "${testDsn}"). ` +
      'Run tests via `npm test`, which isolates the database automatically.',
  )
}

let adminId: string
let managerId: string
let developerId: string
let submitterId: string
let projectId: string

async function cleanDatabase() {
  await db.$transaction([
    db.notification.deleteMany(),
    db.statusLog.deleteMany(),
    db.attachment.deleteMany(),
    db.vote.deleteMany(),
    db.comment.deleteMany(),
    db.requirementLabel.deleteMany(),
    db.label.deleteMany(),
    db.requirement.deleteMany(),
    db.projectMember.deleteMany(),
    db.project.deleteMany(),
    db.user.deleteMany(),
  ])
}

describe('Requirement Service Integration', () => {
  beforeAll(async () => {
    await cleanDatabase()

    const passwordHash = await bcrypt.hash('password123', 12)
    const admin = await db.user.create({
      data: { email: 'admin@test.dev', name: 'Admin', passwordHash, role: 'ADMIN' },
    })
    const manager = await db.user.create({
      data: { email: 'manager@test.dev', name: 'Manager', passwordHash, role: 'MANAGER' },
    })
    const developer = await db.user.create({
      data: { email: 'dev@test.dev', name: 'Developer', passwordHash, role: 'DEVELOPER' },
    })
    const submitter = await db.user.create({
      data: { email: 'submitter@test.dev', name: 'Submitter', passwordHash, role: 'SUBMITTER' },
    })

    adminId = admin.id
    managerId = manager.id
    developerId = developer.id
    submitterId = submitter.id

    const project = await projectService.create(
      {
        name: 'Test Project',
        slug: 'test-project',
        description: 'Integration test project',
      },
      manager.id,
    )
    projectId = project.id

    await db.projectMember.createMany({
      data: [
        { userId: developer.id, projectId: project.id, role: 'MEMBER' },
        { userId: submitter.id, projectId: project.id, role: 'MEMBER' },
        { userId: admin.id, projectId: project.id, role: 'MEMBER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanDatabase()
    await db.$disconnect()
  })

  beforeEach(async () => {
    await db.requirement.deleteMany({ where: { projectId } })
  })

  it('creates a requirement with auto-incrementing number', async () => {
    const r1 = await requirementService.create(projectId, submitterId, { title: 'First' })
    const r2 = await requirementService.create(projectId, submitterId, { title: 'Second' })

    expect(r1.number).toBe(1)
    expect(r2.number).toBe(2)
  })

  it('enforces membership for create', async () => {
    const outsider = await db.user.create({
      data: { email: 'outsider@test.dev', name: 'Outsider', passwordHash: await bcrypt.hash('password123', 12), role: 'SUBMITTER' },
    })

    await expect(
      requirementService.create(projectId, outsider.id, { title: 'Hacker' }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('allows manager quick-path transition', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Quick path' })
    const updated = await requirementService.transition(req.id, managerId, 'MANAGER', 'IN_DEVELOPMENT')

    expect(updated.status).toBe('IN_DEVELOPMENT')

    const logs = await db.statusLog.findMany({ where: { requirementId: req.id } })
    expect(logs.some((l) => l.isQuickPath)).toBe(true)
  })

  it('rejects illegal transition', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Illegal' })

    await expect(
      requirementService.transition(req.id, managerId, 'MANAGER', 'ACCEPTED'),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects submitter performing review', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Permission test' })

    await expect(
      requirementService.transition(req.id, submitterId, 'SUBMITTER', 'UNDER_REVIEW'),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('creates comment and sends notification', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Comment test' })
    await db.notification.deleteMany({ where: { userId: submitterId } })
    await commentService.create(req.id, managerId, 'Looks good')

    const notifications = await db.notification.findMany({ where: { userId: submitterId } })
    expect(notifications.length).toBeGreaterThan(0)
    expect(notifications[0].type).toBe('COMMENT')
  })

  it('toggles vote and detects milestone', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Vote test' })

    const milestones: number[] = []
    const voters = [managerId, developerId, adminId, submitterId]
    for (const voterId of voters) {
      const result = await voteService.toggle(req.id, voterId)
      if (result.milestone) milestones.push(result.milestone)
    }
    // Add a fifth voter by adding another project member first
    const extra = await db.user.create({
      data: { email: `extra${Date.now()}@test.dev`, name: 'Extra', passwordHash: 'x', role: 'SUBMITTER' },
    })
    await db.projectMember.create({ data: { userId: extra.id, projectId, role: 'MEMBER' } })
    const result = await voteService.toggle(req.id, extra.id)
    if (result.milestone) milestones.push(result.milestone)

    console.log('milestones detected:', milestones)

    const notifications = await db.notification.findMany({
      where: { type: 'VOTE_MILESTONE' },
    })
    expect(milestones.length).toBeGreaterThan(0)
    expect(notifications.length).toBeGreaterThan(0)
  })

  it('updates assignee and sends notification', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Assign test' })
    const updated = await requirementService.update(req.id, managerId, 'MANAGER', {
      assigneeId: developerId,
    })

    expect(updated.assigneeId).toBe(developerId)

    const notifications = await db.notification.findMany({
      where: { userId: developerId, type: 'ASSIGNMENT' },
    })
    expect(notifications.length).toBeGreaterThan(0)
  })

  it('allows author to edit title and body', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Title edit' })
    const updated = await requirementService.update(req.id, submitterId, 'SUBMITTER', {
      title: 'Edited title',
      body: 'New body',
    })

    expect(updated.title).toBe('Edited title')
    expect(updated.body).toBe('New body')
  })

  it('rejects non-author editing title or body', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Protected' })
    await expect(
      requirementService.update(req.id, managerId, 'MANAGER', { title: 'Hacked by manager' }),
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      requirementService.update(req.id, adminId, 'ADMIN', { body: 'Hacked by admin' }),
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      requirementService.update(req.id, developerId, 'DEVELOPER', { title: 'Hacked' }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects non-manager editing priority/assignee/expectedDate/acceptanceCriteria', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Mgr only' })
    await expect(
      requirementService.update(req.id, submitterId, 'SUBMITTER', { priority: 'HIGH' }),
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      requirementService.update(req.id, submitterId, 'SUBMITTER', {
        acceptanceCriteria: 'changed',
      }),
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      requirementService.update(req.id, submitterId, 'SUBMITTER', { expectedDate: null }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects assigning a non-member as assignee', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Assign guard' })
    const outsider = await db.user.create({
      data: {
        email: `nonmember${Date.now()}@test.dev`,
        name: 'NonMember',
        passwordHash: 'x',
        role: 'SUBMITTER',
      },
    })
    await expect(
      requirementService.update(req.id, managerId, 'MANAGER', { assigneeId: outsider.id }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects non-member comment deletion', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Comment guard' })
    const comment = await commentService.create(req.id, submitterId, 'my comment')
    const outsider = await db.user.create({
      data: {
        email: `outsider2${Date.now()}@test.dev`,
        name: 'Outsider2',
        passwordHash: 'x',
        role: 'MANAGER',
      },
    })
    await expect(
      commentService.softDelete(comment.id, outsider.id, 'MANAGER'),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('allows author to edit own comment', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Comment edit' })
    const comment = await commentService.create(req.id, submitterId, 'original')
    const updated = await commentService.update(comment.id, submitterId, 'edited body')
    expect(updated.body).toBe('edited body')
  })

  it('rejects non-author editing a comment', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Comment perm' })
    const comment = await commentService.create(req.id, managerId, 'manager comment')
    await expect(
      commentService.update(comment.id, submitterId, 'hacked'),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('addMember rejects duplicate and non-existent users', async () => {
    await expect(
      projectService.addMember(projectId, submitterId, managerId),
    ).rejects.toBeInstanceOf(AppError)

    await expect(
      projectService.addMember(projectId, 'nonexistent-user-id', managerId),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('removeMember prevents removing OWNER', async () => {
    await expect(
      projectService.removeMember(projectId, managerId, managerId),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects a global MANAGER (non-OWNER) managing project members', async () => {
    // manager is a global MANAGER and a project MEMBER (not OWNER) of a new
    // project. Spec §members: only project OWNER or global ADMIN may manage.
    const infra = await projectService.create(
      { name: 'Infra Guard', slug: 'infra-guard', description: '' },
      adminId,
    )
    await db.projectMember.create({
      data: { userId: managerId, projectId: infra.id, role: 'MEMBER' },
    })
    const target = await db.user.create({
      data: {
        email: `target-${Date.now()}@test.dev`,
        name: 'Target',
        passwordHash: 'x',
        role: 'SUBMITTER',
      },
    })

    await expect(
      projectService.addMember(infra.id, target.id, managerId),
    ).rejects.toBeInstanceOf(AppError)
    await db.projectMember.create({ data: { userId: target.id, projectId: infra.id } })
    await expect(
      projectService.removeMember(infra.id, target.id, managerId),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('rejects attaching labels from another project (cross-project guard)', async () => {
    const req = await requirementService.create(projectId, submitterId, {
      title: 'Cross label guard',
    })
    const other = await projectService.create(
      { name: 'Other', slug: `other-${Date.now()}`, description: '' },
      adminId,
    )
    const foreignLabel = await db.label.create({
      data: { name: 'foreign', color: '#000000', projectId: other.id },
    })

    await expect(
      requirementService.update(req.id, managerId, 'MANAGER', {
        labelIds: [foreignLabel.id],
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('vote toggle is wrapped in a transaction and never leaks raw Prisma errors', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Toggle tx' })

    // Sequential double-toggle is deterministic: vote then unvote returns to count 0.
    const on = await voteService.toggle(req.id, managerId)
    expect(on.voted).toBe(true)
    expect(on.count).toBe(1)

    const off = await voteService.toggle(req.id, managerId)
    expect(off.voted).toBe(false)
    expect(off.count).toBe(0)

    // Concurrent double-toggle by the same user must not crash the API with a
    // raw Prisma P2002. Outcome is race-dependent (1 or 2 winners), but the
    // service must resolve cleanly — either fulfilled or AppError(CONFLICT),
    // never a thrown PrismaClientKnownRequestError bubbling to the caller.
    const results = await Promise.allSettled([
      voteService.toggle(req.id, developerId),
      voteService.toggle(req.id, developerId),
    ])

    const rawPrismaErrors = results.filter(
      (r) => r.status === 'rejected' && !(r.reason instanceof AppError),
    )
    expect(rawPrismaErrors.length).toBe(0)
    // At most one vote by developer can exist (unique constraint).
    const devVotes = await db.vote.findMany({
      where: { requirementId: req.id, userId: developerId },
    })
    expect(devVotes.length).toBeLessThanOrEqual(1)
  })

  it('sends REJECTED notification to author on rejection', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Reject me' })
    await requirementService.transition(req.id, managerId, 'MANAGER', 'UNDER_REVIEW')
    await db.notification.deleteMany({ where: { userId: submitterId } })
    await requirementService.transition(req.id, managerId, 'MANAGER', 'REJECTED')

    const notifications = await db.notification.findMany({
      where: { userId: submitterId, type: 'REJECTED' },
    })
    expect(notifications.length).toBe(1)
  })

  it('STATUS_CHANGE notifies only author + assignee (not voters)', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Status scope' })
    await requirementService.update(req.id, managerId, 'MANAGER', { assigneeId: developerId })
    await voteService.toggle(req.id, adminId)
    await db.notification.deleteMany()

    await requirementService.transition(req.id, managerId, 'MANAGER', 'UNDER_REVIEW')

    const statusChange = await db.notification.findMany({ where: { type: 'STATUS_CHANGE' } })
    const notifiedIds = new Set(statusChange.map((n) => n.userId))
    // author + assignee (manager is operator, excluded)
    expect(notifiedIds.has(submitterId)).toBe(true)
    expect(notifiedIds.has(developerId)).toBe(true)
    // voter (admin) must NOT be notified
    expect(notifiedIds.has(adminId)).toBe(false)
  })

  it('VOTE_MILESTONE notifies only project managers (not author)', async () => {
    const req = await requirementService.create(projectId, submitterId, { title: 'Vote scope' })
    await db.notification.deleteMany()

    // submitter votes first (4 more needed to hit milestone of 5)
    await voteService.toggle(req.id, submitterId)
    await voteService.toggle(req.id, managerId)
    await voteService.toggle(req.id, developerId)
    await voteService.toggle(req.id, adminId)

    const extra = await db.user.create({
      data: {
        email: `voter${Date.now()}@test.dev`,
        name: 'Voter',
        passwordHash: 'x',
        role: 'DEVELOPER',
      },
    })
    await db.projectMember.create({ data: { userId: extra.id, projectId, role: 'MEMBER' } })
    await voteService.toggle(req.id, extra.id)

    const milestones = await db.notification.findMany({ where: { type: 'VOTE_MILESTONE' } })
    const notifiedIds = new Set(milestones.map((n) => n.userId))
    // submitter (author) must NOT be notified
    expect(notifiedIds.has(submitterId)).toBe(false)
    // manager + admin (managers) MUST be notified
    expect(notifiedIds.has(managerId)).toBe(true)
    expect(notifiedIds.has(adminId)).toBe(true)
  })
})
