import { db } from '@/lib/db'
import { notificationChannel } from '@/lib/notifications/channel'
import type { NotificationType } from '@/generated/prisma/client'
import type { ReqStatus } from '@/lib/transitions'

type NotifyTarget = {
  userId: string
  type: NotificationType
  title: string
  body?: string
  link?: string
}

export class NotificationService {
  async createMany(notifications: NotifyTarget[]) {
    if (notifications.length === 0) return []

    const created = await db.$transaction(
      notifications.map((n) =>
        db.notification.create({
          data: {
            userId: n.userId,
            type: n.type,
            title: n.title,
            body: n.body ?? null,
            link: n.link ?? null,
          },
        }),
      ),
    )

    for (const n of created) {
      notificationChannel.publishNotification(n.userId, {
        userId: n.userId,
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
      })
    }

    return created
  }

  async list(
    userId: string,
    options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
  ) {
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const where = { userId, ...(options.unreadOnly ? { isRead: false } : {}) }
    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.notification.count({ where }),
    ])
    return {
      data: items,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  async markOneRead(userId: string, notificationId: string) {
    return db.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async countUnread(userId: string) {
    return db.notification.count({
      where: { userId, isRead: false },
    })
  }
}

export function requirementLink(projectSlug: string, requirementNumber: number) {
  return `/projects/${projectSlug}/requirements/${requirementNumber}`
}

export function statusLabel(status: ReqStatus): string {
  const labels: Record<ReqStatus, string> = {
    SUBMITTED: '已提交',
    UNDER_REVIEW: '评审中',
    PLANNED: '已规划',
    IN_DEVELOPMENT: '开发中',
    IN_TESTING: '测试中',
    DELIVERED: '已交付',
    ACCEPTED: '已验收',
    REJECTED: '已驳回',
  }
  return labels[status] ?? status
}

export const notificationService = new NotificationService()
