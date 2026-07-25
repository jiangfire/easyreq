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

// ───── Interface ────────────────────────────────────────────────

export interface INotificationChannel {
  publish(userId: string, event: SSEEvent): void
  publishToUsers(userIds: string[], event: SSEEvent): void
  publishNotification(userId: string, notification: NotificationEvent): void
  subscribe(userId: string, handler: (event: SSEEvent) => void): () => void
  getStreamCount(userId?: string): number
}

// ──── In-memory EventEmitter backend ───────────────────────────

class EventEmitterChannel extends EventEmitter implements INotificationChannel {
  private activeStreams = new Map<string, number>()

  publish(userId: string, event: SSEEvent) {
    this.emit(`event:${userId}`, event)
  }

  publishToUsers(userIds: string[], event: SSEEvent) {
    for (const userId of userIds) {
      this.publish(userId, event)
    }
  }

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

// ──── Redis pub/sub backend for cross-instance SSE ─────────────

/**
 * Redis-backed notification channel.
 *
 * Publishing happens via `PUBLISH easyreq:notifications <JSON>`,
 * subscribing receives via `SUBSCRIBE easyreq:notifications` and
 * dispatches to local listener callbacks.
 *
 * Every message carries the publisher's `instanceId` so we can
 * skip redelivery to the publishing instance (avoids duplicates).
 */
class RedisChannel implements INotificationChannel {
  private listeners = new Map<string, Set<(event: SSEEvent) => void>>()
  private pubSub: { publish: (channel: string, message: string) => Promise<number> } | null = null
  private subscriber: { on: (event: string, cb: (...args: unknown[]) => void) => void } | null = null
  private instanceId: string
  private connected = false
  private fallback: EventEmitterChannel
  private connectPromise: Promise<void> | null = null

  constructor() {
    this.instanceId = Math.random().toString(36).slice(2, 10)
    this.fallback = new EventEmitterChannel()
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = (async () => {
      const url = process.env.REDIS_URL
      if (!url) {
        console.warn('[sse] REDIS_URL not set, falling back to in-memory SSE')
        return
      }
      try {
        const { default: IORedis } = await import('ioredis')
        const pub = new IORedis(url)
        const sub = pub.duplicate()

        await Promise.all([
          pub.ping(),
          sub.ping(),
        ])

        this.pubSub = pub
        this.subscriber = sub

        await sub.subscribe('easyreq:notifications')
        sub.on('message', (_channel: unknown, message: string) => {
          try {
            const { event, userId, data, sender } = JSON.parse(message) as {
              event: SSEEventType
              userId: string
              data: Record<string, unknown>
              sender: string
            }
            // Skip self
            if (sender === this.instanceId) return
            // Deliver to local subscribers
            const handlers = this.listeners.get(userId)
            if (handlers) {
              for (const handler of handlers) {
                handler({ event, data })
              }
            }
          } catch {
            // malformed message — ignore
          }
        })

        this.connected = true
        console.log(`[sse] Redis connected (instance ${this.instanceId})`)
      } catch (err) {
        console.warn('[sse] Redis unavailable, falling back to in-memory SSE:', (err as Error).message)
      }
    })()

    await this.connectPromise
  }

  publish(userId: string, event: SSEEvent) {
    // Always dispatch locally immediately (no latency)
    this.fallback.publish(userId, event)
    // Also broadcast via Redis if connected
    if (this.pubSub) {
      this.pubSub.publish(
        'easyreq:notifications',
        JSON.stringify({ event: event.event, userId, data: event.data, sender: this.instanceId }),
      ).catch(() => {})
    }
  }

  publishToUsers(userIds: string[], event: SSEEvent) {
    for (const userId of userIds) {
      this.publish(userId, event)
    }
  }

  publishNotification(userId: string, notification: NotificationEvent) {
    this.publish(userId, {
      event: 'notification',
      data: { ...notification },
    })
  }

  subscribe(userId: string, handler: (event: SSEEvent) => void) {
    const unsubFallback = this.fallback.subscribe(userId, handler)
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set())
    }
    this.listeners.get(userId)!.add(handler)

    return () => {
      unsubFallback()
      const handlers = this.listeners.get(userId)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) this.listeners.delete(userId)
      }
    }
  }

  getStreamCount(userId?: string): number {
    if (userId) {
      return this.listeners.get(userId)?.size ?? 0
    }
    let total = 0
    for (const handlers of this.listeners.values()) {
      total += handlers.size
    }
    return total
  }

  /**
   * Eagerly connect when called from server bootstrap. Optional — the
   * channel works lazily too (first publish triggers connect).
   */
  async connect() {
    await this.ensureConnected()
  }
}

// ──── Factory ──────────────────────────────────────────────────

/**
 * Creates the appropriate channel singleton.
 *
 * - `REDIS_URL` set   → `RedisChannel` (falls back to in-memory if connection fails)
 * - `REDIS_URL` unset → `EventEmitterChannel` (single-instance, no external dep)
 */
export function createNotificationChannel(): INotificationChannel {
  if (process.env.REDIS_URL) {
    const redis = new RedisChannel()
    redis.connect().catch(() => {})
    return redis
  }
  return new EventEmitterChannel()
}

export const notificationChannel = createNotificationChannel()