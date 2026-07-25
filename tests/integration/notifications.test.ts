import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { notificationService } from '@/services/notification.service'

// SAFETY GUARD: same pattern as requirements.test.ts
const testDsn = process.env.DATABASE_URL ?? ''
if (!/_test([-?]|$)/.test(testDsn)) {
  throw new Error(
    `Refusing to run notification tests: DATABASE_URL must target a test database (got "${testDsn}").`,
  )
}

let adminId: string
let devId: string
let submitterId: string

beforeAll(async () => {
  await db.notification.deleteMany()
  await db.user.deleteMany()

  const passwordHash = await bcrypt.hash('password123', 12)
  const admin = await db.user.create({
    data: { email: 'admin-notif@test.dev', name: 'Notif Admin', passwordHash, role: 'ADMIN' },
  })
  const dev = await db.user.create({
    data: { email: 'dev-notif@test.dev', name: 'Notif Dev', passwordHash, role: 'DEVELOPER' },
  })
  const submitter = await db.user.create({
    data: { email: 'submitter-notif@test.dev', name: 'Notif Submitter', passwordHash, role: 'SUBMITTER' },
  })
  adminId = admin.id
  devId = dev.id
  submitterId = submitter.id
})

afterAll(async () => {
  await db.$disconnect()
})

beforeEach(async () => {
  await db.notification.deleteMany()
})

describe('NotificationService', () => {
  it('list returns paginated results with unreadCount metadata', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'c1' },
      { userId: submitterId, type: 'STATUS_CHANGE', title: 's1' },
      { userId: submitterId, type: 'STATUS_CHANGE', title: 's2' },
    ])

    const result = await notificationService.list(submitterId, { pageSize: 2 })
    expect(result.data).toHaveLength(2)
    expect(result.pagination.totalItems).toBe(3)
    expect(result.pagination.totalPages).toBe(2)
  })

  it('list filters by unreadOnly', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'unread1' },
      { userId: submitterId, type: 'COMMENT', title: 'unread2' },
    ])
    const read = await db.notification.findFirst({ where: { userId: submitterId } })
    if (read) {
      await db.notification.update({
        where: { id: read.id },
        data: { isRead: true, readAt: new Date() },
      })
    }

    const all = await notificationService.list(submitterId)
    expect(all.data).toHaveLength(2)

    const unread = await notificationService.list(submitterId, { unreadOnly: true })
    expect(unread.data).toHaveLength(1)
    expect(unread.data[0].isRead).toBe(false)
  })

  it('list filters by types array', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'comment' },
      { userId: submitterId, type: 'STATUS_CHANGE', title: 'status' },
      { userId: submitterId, type: 'ASSIGNMENT', title: 'assignment' },
    ])

    const comments = await notificationService.list(submitterId, { types: ['COMMENT'] })
    expect(comments.data).toHaveLength(1)
    expect(comments.data[0].type).toBe('COMMENT')

    const multiple = await notificationService.list(submitterId, {
      types: ['COMMENT', 'ASSIGNMENT'],
    })
    expect(multiple.data).toHaveLength(2)
  })

  it('markRead is idempotent — calling twice does not double-stamp readAt', async () => {
    const [n] = await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'x' },
    ])
    const r1 = await notificationService.markRead(submitterId, n.id)
    expect(r1.count).toBe(1)
    const firstRead = await db.notification.findUnique({ where: { id: n.id } })
    const firstReadAt = firstRead?.readAt

    // Wait a millisecond to detect timestamp change
    await new Promise((r) => setTimeout(r, 5))
    const r2 = await notificationService.markRead(submitterId, n.id)
    expect(r2.count).toBe(0)
    const secondRead = await db.notification.findUnique({ where: { id: n.id } })
    expect(secondRead?.readAt?.getTime()).toBe(firstReadAt?.getTime())
  })

  it('deleteMany with mode="read" keeps unread notifications', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'will-be-read' },
      { userId: submitterId, type: 'COMMENT', title: 'will-stay-unread' },
    ])
    // Mark one as read
    const all = await db.notification.findMany({ where: { userId: submitterId } })
    await db.notification.update({
      where: { id: all[0].id },
      data: { isRead: true, readAt: new Date() },
    })

    const result = await notificationService.deleteMany(submitterId, { mode: 'read' })
    expect(result.count).toBe(1)

    const remaining = await db.notification.findMany({ where: { userId: submitterId } })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].isRead).toBe(false)
  })

  it('deleteMany with mode="all" removes everything', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'a' },
      { userId: submitterId, type: 'COMMENT', title: 'b' },
      { userId: submitterId, type: 'COMMENT', title: 'c' },
    ])
    const result = await notificationService.deleteMany(submitterId, { mode: 'all' })
    expect(result.count).toBe(3)

    const remaining = await db.notification.findMany({ where: { userId: submitterId } })
    expect(remaining).toHaveLength(0)
  })

  it('isolates notifications per user', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'for-submitter' },
      { userId: devId, type: 'COMMENT', title: 'for-dev' },
      { userId: adminId, type: 'COMMENT', title: 'for-admin' },
    ])

    const sub = await notificationService.list(submitterId)
    const dev = await notificationService.list(devId)
    const adm = await notificationService.list(adminId)

    expect(sub.data).toHaveLength(1)
    expect(dev.data).toHaveLength(1)
    expect(adm.data).toHaveLength(1)
    expect(sub.data[0].title).toBe('for-submitter')
    expect(dev.data[0].title).toBe('for-dev')
    expect(adm.data[0].title).toBe('for-admin')
  })

  it('countUnread reflects unread notifications only', async () => {
    await notificationService.createMany([
      { userId: submitterId, type: 'COMMENT', title: 'r1' },
      { userId: submitterId, type: 'COMMENT', title: 'r2' },
      { userId: submitterId, type: 'COMMENT', title: 'r3' },
    ])

    expect(await notificationService.countUnread(submitterId)).toBe(3)

    const first = await db.notification.findFirst({ where: { userId: submitterId } })
    await db.notification.update({
      where: { id: first!.id },
      data: { isRead: true, readAt: new Date() },
    })

    expect(await notificationService.countUnread(submitterId)).toBe(2)
  })
})