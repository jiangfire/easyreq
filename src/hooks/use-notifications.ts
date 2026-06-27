'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type SSENotification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

const MAX_BACKOFF_MS = 30000
const BACKOFF_STEPS = [1000, 2000, 4000, 8000, MAX_BACKOFF_MS]
const MAX_RECONNECT_ATTEMPTS = BACKOFF_STEPS.length

/**
 * Subscribe to /api/sse. Returns the accumulated live notifications plus a
 * way to replace the whole list (e.g. after fetching the paginated history).
 *
 * Backoff per spec (1s/2s/4s/8s/max 30s). The EventSource is tracked in a ref
 * so cleanup actually closes it, and reconnection stops once the server
 * rejects the session (readyState === CLOSED) to avoid a reconnect storm.
 */
export function useSSENotifications() {
  const [notifications, setNotifications] = useState<SSENotification[]>([])
  const [requirementUpdate, setRequirementUpdate] = useState<{
    id: string
    projectId: string
    field: string
  } | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)
  const stoppedRef = useRef(false)

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    stoppedRef.current = false

    const connect = () => {
      if (stoppedRef.current) return
      const es = new EventSource('/api/sse')
      eventSourceRef.current = es

      es.addEventListener('open', () => {
        attemptsRef.current = 0
      })

      es.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          const next: SSENotification = { ...data, isRead: false }
          setNotifications((prev) => [next, ...prev.filter((n) => n.id !== next.id)])
        } catch {
          // Ignore malformed payloads.
        }
      })

      es.addEventListener('requirement_updated', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          setRequirementUpdate(data)
        } catch {
          // Ignore malformed payloads.
        }
      })

      es.addEventListener('error', () => {
        if (es.readyState === EventSource.CLOSED) {
          es.close()
          eventSourceRef.current = null
          return
        }
        es.close()
        eventSourceRef.current = null
        if (stoppedRef.current) return
        if (attemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return
        const delay = BACKOFF_STEPS[Math.min(attemptsRef.current, BACKOFF_STEPS.length - 1)]
        attemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      })
    }

    connect()

    return () => {
      stoppedRef.current = true
      cleanup()
    }
  }, [cleanup])

  const replaceNotifications = useCallback(
    (next: SSENotification[]) => setNotifications(next),
    [],
  )

  const markAllRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true }))),
    [],
  )

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return { notifications, unreadCount, replaceNotifications, markAllRead, requirementUpdate }
}

