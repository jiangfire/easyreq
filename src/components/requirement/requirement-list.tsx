import Link from 'next/link'
import { StatusBadge, PriorityBadge } from './status-badge'
import { STATUS_CONFIG, STATUS_ORDER } from '@/lib/constants'

type RequirementItem = {
  id: string
  number: number
  title: string
  status: string
  priority: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string }
  _count: { comments: number; votes: number }
}

type Pagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export function RequirementList({
  requirements,
  pagination,
  projectSlug,
  searchParams,
}: {
  requirements: RequirementItem[]
  pagination: Pagination
  projectSlug: string
  searchParams: { status?: string; sortBy?: string }
}) {
  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <StatusFilter current={searchParams.status} projectSlug={projectSlug} />
        <SortFilter current={searchParams.sortBy} projectSlug={projectSlug} status={searchParams.status} />
        <span className="ml-auto text-xs text-gray-400">{pagination.totalItems} 个需求</span>
      </div>

      {/* List */}
      {requirements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">
            {searchParams.status ? '该状态下暂无需求' : '暂无需求，在上方输入框提交第一个吧'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {requirements.map((req, i) => (
            <Link
              key={req.id}
              href={`/projects/${projectSlug}/requirements/${req.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                i > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              {/* Number */}
              <span className="w-12 shrink-0 text-xs text-gray-400">#{req.number}</span>

              {/* Title + Status */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">{req.title}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <StatusBadge status={req.status} />
                  <span className="text-xs text-gray-400">
                    由 {req.author.name} 提交于 {formatDate(req.createdAt)}
                  </span>
                </div>
              </div>

              {/* Priority */}
              <div className="hidden shrink-0 sm:block">
                <PriorityBadge priority={req.priority} />
              </div>

              {/* Meta counts */}
              <div className="flex shrink-0 items-center gap-3 text-xs text-gray-400">
                {req._count.votes > 0 && (
                  <span className="flex items-center gap-0.5" title="投票">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {req._count.votes}
                  </span>
                )}
                {req._count.comments > 0 && (
                  <span className="flex items-center gap-0.5" title="评论">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {req._count.comments}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {pagination.page > 1 && (
            <PageLink page={pagination.page - 1} projectSlug={projectSlug} searchParams={searchParams}>
              ← 上一页
            </PageLink>
          )}
          <span className="text-sm text-gray-500">
            {pagination.page} / {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages && (
            <PageLink page={pagination.page + 1} projectSlug={projectSlug} searchParams={searchParams}>
              下一页 →
            </PageLink>
          )}
        </div>
      )}
    </div>
  )
}

function StatusFilter({ current, projectSlug }: { current?: string; projectSlug: string }) {
  const all = !current || current === 'all'
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/projects/${projectSlug}`}
        className={`rounded-md px-2.5 py-1 text-xs font-medium ${all ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        全部
      </Link>
      {STATUS_ORDER.filter((s) => s !== 'ACCEPTED').map((s) => {
        const config = STATUS_CONFIG[s]
        const active = current === s
        return (
          <Link
            key={s}
            href={`/projects/${projectSlug}?status=${s}`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${active ? `${config.bgColor} ${config.color}` : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {config.label}
          </Link>
        )
      })}
    </div>
  )
}

function SortFilter({
  current,
  projectSlug,
  status,
}: {
  current?: string
  projectSlug: string
  status?: string
}) {
  const sortBy = current ?? 'createdAt'
  const options = [
    { value: 'createdAt', label: '最新' },
    { value: 'votes', label: '最多投票' },
    { value: 'updatedAt', label: '最近更新' },
  ]

  return (
    <select
      value={sortBy}
      onChange={(e) => {
        const params = new URLSearchParams()
        if (status && status !== 'all') params.set('status', status)
        if (e.target.value !== 'createdAt') params.set('sortBy', e.target.value)
        window.location.href = `/projects/${projectSlug}${params.toString() ? `?${params}` : ''}`
      }}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function PageLink({
  page,
  projectSlug,
  searchParams,
  children,
}: {
  page: number
  projectSlug: string
  searchParams: { status?: string; sortBy?: string }
  children: React.ReactNode
}) {
  const params = new URLSearchParams()
  if (searchParams.status && searchParams.status !== 'all') params.set('status', searchParams.status)
  if (searchParams.sortBy) params.set('sortBy', searchParams.sortBy)
  params.set('page', String(page))
  return (
    <Link
      href={`/projects/${projectSlug}?${params}`}
      className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
    >
      {children}
    </Link>
  )
}

function formatDate(date: Date) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
