import Link from 'next/link'
import { SearchBar } from './search-bar'

import { signOut } from '@/lib/auth'
import { notificationService } from '@/services/notification.service'
import { NotificationBell } from './notification-bell'

type HeaderUser = {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
}

const ROLE_LABELS: Record<string, string> = {
  SUBMITTER: '提交者',
  MANAGER: '管理者',
  DEVELOPER: '开发者',
  ADMIN: '管理员',
}

export async function Header({ user }: { user: HeaderUser }) {
  const unreadCount = await notificationService.countUnread(user.id)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-2 lg:ml-0 ml-12">
        <SearchBar />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/admin" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:block">
          后台
        </Link>
        <NotificationBell initialCount={unreadCount} />

        {/* User info */}
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium text-gray-700 sm:block">{user.name}</span>
          <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:block">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {user.name.charAt(0)}
          </div>
        </div>

        {/* Logout */}
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            title="登出"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  )
}
