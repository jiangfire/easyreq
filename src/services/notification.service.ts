import { db } from '@/lib/db'
import { VOTE_MILESTONES } from '@/lib/constants'
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

  async listUnread(userId: string, limit = 50) {
    return db.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async listAll(userId: string, limit = 100) {
    return db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async markAsRead(userId: string, notificationId?: string) {
    if (notificationId) {
      return db.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true, readAt: new Date() },
      })
    }

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

export function nextVoteMilestone(count: number): number | null {
  for (const milestone of VOTE_MILESTONES) {
    if (count <= milestone) return milestone
  }
  return null
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
