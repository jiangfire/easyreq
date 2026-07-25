import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { NotificationType } from '@/generated/prisma/client'
import { ClearReadForm } from '@/components/notifications/clear-read-form'

type NotificationListItem = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: Date
}

const TYPE_LABELS: Record<NotificationType, string> = {
  STATUS_CHANGE: '状态变更',
  COMMENT: '评论',
  VOTE_MILESTONE: '投票里程碑',
  ASSIGNMENT: '指派',
  REJECTED: '驳回',
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const activeType = isValidType(sp.type) ? sp.type : undefined

  const result = await notificationService.list(
    user.id,
    activeType ? { types: [activeType], pageSize: 100 } : { pageSize: 100 },
  )

  const groups = groupByTimeBucket(result.data)
  const hasAny = result.data.length > 0

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">通知</h1>
        <div className="flex items-center gap-2">
          <form action={markAllReadAction}>
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              全部已读
            </button>
          </form>
          <ClearReadForm />
        </div>
      </div>

      {/* Type filter chips */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterChip href="/notifications" label="全部" active={!activeType} />
        {(Object.keys(TYPE_LABELS) as NotificationType[]).map((t) => (
          <FilterChip
            key={t}
            href={`/notifications?type=${t}`}
            label={TYPE_LABELS[t]}
            active={activeType === t}
          />
        ))}
      </div>

      {!hasAny ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">
            {activeType ? `暂无「${TYPE_LABELS[activeType]}」类通知` : '暂无通知'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {group.label} · {group.items.length}
              </h2>
              <div className="space-y-2">
                {group.items.map((n) => (
                  <NotificationCard key={n.id} notification={n} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  )
}

function isValidType(value: string | undefined): value is NotificationType {
  return (
    !!value &&
    (['STATUS_CHANGE', 'COMMENT', 'VOTE_MILESTONE', 'ASSIGNMENT', 'REJECTED'] as const).includes(
      value as NotificationType,
    )
  )
}

function NotificationCard({ notification }: { notification: NotificationListItem }) {
  const typeLabel = TYPE_LABELS[notification.type as NotificationType] ?? notification.type
  const inner = (
    <div
      className={`rounded-lg border border-gray-200 p-4 transition-colors ${
        notification.isRead ? 'bg-white' : 'bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {typeLabel}
            </span>
            {!notification.isRead && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="未读" />
            )}
          </div>
          <p className="font-medium text-gray-900">{notification.title}</p>
          {notification.body && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{notification.body}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">{formatRelative(notification.createdAt)}</p>
        </div>
      </div>
    </div>
  )

  const redirectTo = notification.link ?? '/notifications'
  return (
    <form action={markReadAction} className="block">
      <input type="hidden" name="id" value={notification.id} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button type="submit" className="w-full text-left hover:opacity-90">
        {inner}
      </button>
    </form>
  )
}

async function markAllReadAction() {
  'use server'
  const user = await getCurrentUser()
  if (!user) return
  await notificationService.markAllRead(user.id)
  redirect('/notifications')
}

async function markReadAction(formData: FormData) {
  'use server'
  const user = await getCurrentUser()
  if (!user) return
  await notificationService.markRead(user.id, formData.get('id') as string)
  const redirectTo = (formData.get('redirectTo') as string | null) ?? '/notifications'
  redirect(redirectTo)
}

function groupByTimeBucket(
  items: NotificationListItem[],
): { label: string; items: NotificationListItem[] }[] {
  const today: NotificationListItem[] = []
  const yesterday: NotificationListItem[] = []
  const earlier: NotificationListItem[] = []

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  for (const n of items) {
    const t = new Date(n.createdAt)
    if (t >= todayStart) today.push(n)
    else if (t >= yesterdayStart) yesterday.push(n)
    else earlier.push(n)
  }

  const groups: { label: string; items: NotificationListItem[] }[] = []
  if (today.length > 0) groups.push({ label: '今天', items: today })
  if (yesterday.length > 0) groups.push({ label: '昨天', items: yesterday })
  if (earlier.length > 0) groups.push({ label: '更早', items: earlier })
  return groups
}

function formatRelative(date: Date) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  if (diffHr < 48) return '昨天'
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}