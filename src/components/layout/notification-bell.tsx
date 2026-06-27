'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSSENotifications, type SSENotification } from '@/hooks/use-notifications'

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const { notifications, unreadCount, replaceNotifications, markAllRead } =
    useSSENotifications()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // Keep the server-provided initial count until the first SSE event or load.
  const displayCount = notifications.length > 0 ? unreadCount : initialCount

  async function loadNotifications() {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      replaceNotifications(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAllRead() {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' })
    if (res.ok) {
      markAllRead()
    }
  }

  function handleOpen() {
    const next = !open
    setOpen(next)
    if (next && notifications.length === 0) {
      loadNotifications()
    }
  }

  const showCount = notifications.length > 0 ? unreadCount : displayCount

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        title="通知"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {showCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {showCount > 99 ? '99+' : showCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold text-gray-700">通知</span>
            {showCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                全部已读
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-3 text-sm text-gray-400">加载中...</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">暂无通知</p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href="/notifications"
              className="block text-center text-xs text-blue-600 hover:text-blue-700"
              onClick={() => setOpen(false)}
            >
              查看全部通知
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({ notification }: { notification: SSENotification }) {
  const content = (
    <div className={`px-4 py-3 text-sm ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}>
      <p className="font-medium text-gray-800">{notification.title}</p>
      {notification.body && (
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{notification.body}</p>
      )}
      <p className="mt-1 text-xs text-gray-400">
        {new Date(notification.createdAt).toLocaleString('zh-CN')}
      </p>
    </div>
  )

  if (notification.link) {
    return (
      <Link href={notification.link} className="block hover:bg-gray-50">
        {content}
      </Link>
    )
  }

  return content
}
