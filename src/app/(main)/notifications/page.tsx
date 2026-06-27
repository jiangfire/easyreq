import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const result = await notificationService.list(user.id, { pageSize: 50 })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">通知</h1>
        <form action={markAllReadAction}>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            全部已读
          </button>
        </form>
      </div>

      {result.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {result.data.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationCard({
  notification,
}: {
  notification: {
    id: string
    type: string
    title: string
    body: string | null
    link: string | null
    isRead: boolean
    createdAt: Date
  }
}) {
  const content = (
    <div className={`rounded-lg border border-gray-200 p-4 ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{notification.title}</p>
          {notification.body && (
            <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {new Date(notification.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
        {!notification.isRead && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500"></span>
        )}
      </div>
    </div>
  )

  if (notification.link) {
    return <Link href={notification.link} className="block hover:opacity-80">{content}</Link>
  }

  return content
}

async function markAllReadAction() {
  'use server'
  const user = await getCurrentUser()
  if (!user) return
  await notificationService.markAllRead(user.id)
}
