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
  assignee?: { id: string; name: string } | null
  labels?: { label: { id: string; name: string; color: string } }[]
  _count: { comments: number; votes: number }
}

type Pagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

type SearchParams = {
  status?: string
  priority?: string
  sortBy?: string
  assigneeId?: string
  labelIds?: string
}

export function RequirementList({
  requirements,
  pagination,
  projectSlug,
  labels,
  members,
  searchParams,
}: {
  requirements: RequirementItem[]
  pagination: Pagination
  projectSlug: string
  labels: { id: string; name: string; color: string }[]
  members: { id: string; name: string }[]
  searchParams: SearchParams
}) {
  return (
    <div>
      {/* Filters */}
      <div className="mb-4 space-y-2 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusFilter current={searchParams.status} projectSlug={projectSlug} sp={searchParams} />
          <SortFilter current={searchParams.sortBy} projectSlug={projectSlug} sp={searchParams} />
          <span className="ml-auto text-xs text-gray-400">{pagination.totalItems} 个需求</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AssigneeFilter
            current={searchParams.assigneeId}
            projectSlug={projectSlug}
            members={members}
            sp={searchParams}
          />
          <LabelFilter
            current={searchParams.labelIds}
            projectSlug={projectSlug}
            labels={labels}
            sp={searchParams}
          />
        </div>
      </div>

      {/* List */}
      {requirements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">
            {searchParams.status || searchParams.assigneeId || searchParams.labelIds
              ? '当前筛选条件下暂无需求'
              : '暂无需求，在上方输入框提交第一个吧'}
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
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={req.status} />
                  {req.labels && req.labels.length > 0 && (
                    <span className="flex items-center gap-1">
                      {req.labels.map((rl) => (
                        <span
                          key={rl.label.id}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: rl.label.color }}
                        >
                          {rl.label.name}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    由 {req.author.name} 提交于 {formatDate(req.createdAt)}
                  </span>
                </div>
              </div>

              {/* Assignee */}
              {req.assignee && (
                <div className="hidden shrink-0 items-center gap-1 text-xs text-gray-500 sm:flex">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                    {req.assignee.name.charAt(0)}
                  </div>
                  {req.assignee.name}
                </div>
              )}

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
            <PageLink page={pagination.page - 1} projectSlug={projectSlug} sp={searchParams}>
              ← 上一页
            </PageLink>
          )}
          <span className="text-sm text-gray-500">
            {pagination.page} / {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages && (
            <PageLink page={pagination.page + 1} projectSlug={projectSlug} sp={searchParams}>
              下一页 →
            </PageLink>
          )}
        </div>
      )}
    </div>
  )
}

function buildHref(projectSlug: string, sp: SearchParams, overrides: Partial<SearchParams> = {}) {
  const merged = { ...sp, ...overrides }
  const params = new URLSearchParams()
  if (merged.status && merged.status !== 'all') params.set('status', merged.status)
  if (merged.priority) params.set('priority', merged.priority)
  if (merged.sortBy) params.set('sortBy', merged.sortBy)
  if (merged.assigneeId) params.set('assigneeId', merged.assigneeId)
  if (merged.labelIds) params.set('labelIds', merged.labelIds)
  return `/projects/${projectSlug}${params.toString() ? `?${params}` : ''}`
}

function StatusFilter({
  current,
  projectSlug,
  sp,
}: {
  current?: string
  projectSlug: string
  sp: SearchParams
}) {
  const all = !current || current === 'all'
  return (
    <div className="flex items-center gap-1">
      <Link
        href={buildHref(projectSlug, sp, { status: undefined })}
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
            href={buildHref(projectSlug, sp, { status: s })}
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
  sp,
}: {
  current?: string
  projectSlug: string
  sp: SearchParams
}) {
  const sortBy = current ?? 'createdAt'
  const options = [
    { value: 'createdAt', label: '最新' },
    { value: 'votes', label: '最多投票' },
    { value: 'updatedAt', label: '最近更新' },
  ]

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400">排序:</span>
      {options.map((o) => {
        const active = sortBy === o.value
        return (
          <Link
            key={o.value}
            href={buildHref(projectSlug, sp, { sortBy: o.value === 'createdAt' ? undefined : o.value })}
            className={`rounded-md px-2 py-1 text-xs font-medium ${active ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {o.label}
          </Link>
        )
      })}
    </div>
  )
}

function AssigneeFilter({
  current,
  projectSlug,
  members,
  sp,
}: {
  current?: string
  projectSlug: string
  members: { id: string; name: string }[]
  sp: SearchParams
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400">指派:</span>
      <Link
        href={buildHref(projectSlug, sp, { assigneeId: undefined })}
        className={`rounded-md px-2 py-1 text-xs font-medium ${!current ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
      >
        全部
      </Link>
      {members.map((m) => (
        <Link
          key={m.id}
          href={buildHref(projectSlug, sp, { assigneeId: m.id })}
          className={`rounded-md px-2 py-1 text-xs font-medium ${current === m.id ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          {m.name}
        </Link>
      ))}
    </div>
  )
}

function LabelFilter({
  current,
  projectSlug,
  labels,
  sp,
}: {
  current?: string
  projectSlug: string
  labels: { id: string; name: string; color: string }[]
  sp: SearchParams
}) {
  if (labels.length === 0) return null
  const currentIds = current ? current.split(',') : []

  function toggle(labelId: string) {
    const next = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId]
    return buildHref(projectSlug, sp, { labelIds: next.length > 0 ? next.join(',') : undefined })
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-400">标签:</span>
      {labels.map((l) => {
        const active = currentIds.includes(l.id)
        return (
          <Link
            key={l.id}
            href={toggle(l.id)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${active ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            style={active ? { backgroundColor: l.color } : undefined}
          >
            {l.name}
          </Link>
        )
      })}
    </div>
  )
}

function PageLink({
  page,
  projectSlug,
  sp,
  children,
}: {
  page: number
  projectSlug: string
  sp: SearchParams
  children: React.ReactNode
}) {
  return (
    <Link
      href={`${buildHref(projectSlug, sp)}${buildHref(projectSlug, sp).includes('?') ? '&' : '?'}page=${page}`}
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
