'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Tab = {
  href: string
  label: string
  icon: React.ReactNode
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  {
    href: '/dashboard',
    label: '看板',
    match: (p) => p === '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    href: '/search',
    label: '搜索',
    match: (p) => p === '/search',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    href: '/notifications',
    label: '通知',
    match: (p) => p === '/notifications' || p === '/requirements/inbox' || p === '/admin' || p === '/admin/review',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    href: '/projects',
    label: '项目',
    match: (p) => p === '/projects' || p.startsWith('/projects/'),
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
    ),
  },
]

/**
 * Bottom tab bar for mobile (and any small screen).
 *
 * - Hidden on `lg` and up; the desktop sidebar takes over.
 * - 4 primary destinations as fixed-height tab bar at the bottom.
 * - "More" button opens a fullscreen drawer with the full sidebar
 *   (project list, admin, inbox, etc.).
 *
 * Receives the same `projects` list as the desktop sidebar so the
 * "more" view can show them without a second fetch.
 */
export function MobileTabBar({
  role,
  projects,
  hasUnread,
}: {
  role: string
  projects: { id: string; name: string; slug: string }[]
  hasUnread: boolean
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const lastPathname = useRef(pathname)

  // Close the "more" drawer on route change. This is a real side effect
  // (subscribing to route changes) — running setMoreOpen here is fine.
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname
      setMoreOpen(false)
    }
  }, [pathname])

  // Lock body scroll when the fullscreen menu is open.
  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [moreOpen])

  const isManager = role === 'MANAGER' || role === 'ADMIN'

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white lg:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = tab.match(pathname)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="relative">
                  {tab.icon}
                  {tab.href === '/notifications' && hasUnread && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                </span>
                {tab.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] text-gray-500 hover:text-gray-700"
            aria-label="更多"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
            更多
          </button>
        </div>
        {/* Bottom padding to account for safe area on iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-white lg:hidden"
          role="dialog"
          aria-label="导航菜单"
        >
          <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
            <span className="text-lg font-semibold text-gray-900">更多</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto p-4 pb-20">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              项目
            </h3>
            {projects.length === 0 ? (
              <p className="px-2 text-sm text-gray-400">暂无项目</p>
            ) : (
              <div className="space-y-1">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}`}
                    className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-1">
              {isManager && (
                <Link
                  href="/requirements/inbox"
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  需求池
                </Link>
              )}
              {isManager && (
                <Link
                  href="/admin"
                  className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  后台
                </Link>
              )}
              <Link
                href="/notifications"
                className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                通知
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}