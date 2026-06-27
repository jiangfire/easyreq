import { EventEmitter } from 'events'

export type SSEEventType = 'notification' | 'requirement_updated' | 'ping'

export type SSEEvent = {
  event: SSEEventType
  data: Record<string, unknown>
}

export type NotificationEvent = {
  userId: string
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  createdAt: string
}

class NotificationChannel extends EventEmitter {
  private activeStreams = new Map<string, number>()

  /**
   * Publish an SSE event to a single user.
   */
  publish(userId: string, event: SSEEvent) {
    this.emit(`event:${userId}`, event)
  }

  /**
   * Publish an SSE event to multiple users (e.g. project members).
   */
  publishToUsers(userIds: string[], event: SSEEvent) {
    for (const userId of userIds) {
      this.publish(userId, event)
    }
  }

  /**
   * Publish a notification to a single user as an `event: notification` SSE event.
   * Backwards-compatible helper used by NotificationService.
   */
  publishNotification(userId: string, notification: NotificationEvent) {
    this.publish(userId, {
      event: 'notification',
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        createdAt: notification.createdAt,
      },
    })
  }

  subscribe(userId: string, handler: (event: SSEEvent) => void) {
    const eventName = `event:${userId}`
    this.on(eventName, handler)
    this.activeStreams.set(userId, (this.activeStreams.get(userId) ?? 0) + 1)

    return () => {
      this.off(eventName, handler)
      const count = (this.activeStreams.get(userId) ?? 1) - 1
      if (count <= 0) {
        this.activeStreams.delete(userId)
      } else {
        this.activeStreams.set(userId, count)
      }
    }
  }

  getStreamCount(userId?: string): number {
    if (userId) {
      return this.activeStreams.get(userId) ?? 0
    }
    return Array.from(this.activeStreams.values()).reduce((a, b) => a + b, 0)
  }
}

export const notificationChannel = new NotificationChannel()
