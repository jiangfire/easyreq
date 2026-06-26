import { getCurrentUser } from '@/services/auth.service'
import { requirementService } from '@/services/requirement.service'
import { StatusBadge, PriorityBadge } from '@/components/requirement/status-badge'
import { StatusTimeline } from '@/components/requirement/status-timeline'
import { StatusActions } from '@/components/requirement/status-actions'
import { PRIORITY_CONFIG } from '@/lib/constants'
import { getAvailableTransitions, type ReqStatus } from '@/lib/transitions'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  let requirement
  try {
    requirement = await requirementService.getById(id, user.id)
  } catch {
    notFound()
  }

  const availableTargets = getAvailableTransitions(
    requirement.status as ReqStatus,
    user.role as never,
  )

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/projects/${slug}`} className="hover:text-gray-700">
          {requirement.project.slug}
        </Link>
        <span>/</span>
        <span>#{requirement.number}</span>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="mb-6 border-b border-gray-200 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg font-bold text-gray-400">#{requirement.number}</span>
              <StatusBadge status={requirement.status} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{requirement.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span>
                由 <strong className="text-gray-700">{requirement.author.name}</strong> 提交于{' '}
                {formatDate(requirement.createdAt)}
              </span>
              <PriorityBadge priority={requirement.priority} />
            </div>
          </div>

          {/* Status Actions */}
          {availableTargets.length > 0 && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500">状态操作</p>
              <StatusActions
                requirementId={requirement.id}
                availableTargets={availableTargets}
              />
            </div>
          )}

          {/* Body */}
          {requirement.body ? (
            <div className="mb-6 prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {requirement.body}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="mb-6 text-sm text-gray-400 italic">暂无详细描述</p>
          )}

          {/* Acceptance Criteria */}
          {requirement.acceptanceCriteria && (
            <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">验收标准</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{requirement.acceptanceCriteria}</p>
            </div>
          )}

          {/* Comments placeholder */}
          <div className="mt-8 border-t border-gray-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              评论 ({requirement._count.comments})
            </h3>
            <p className="text-sm text-gray-400">评论功能即将实现</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <SidebarItem label="状态">
              <StatusBadge status={requirement.status} />
            </SidebarItem>
            <SidebarItem label="优先级">
              <span className={`text-sm font-medium ${PRIORITY_CONFIG[requirement.priority]?.color}`}>
                {PRIORITY_CONFIG[requirement.priority]?.label}
              </span>
            </SidebarItem>
            <SidebarItem label="指派给">
              {requirement.assignee ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
                    {requirement.assignee.name.charAt(0)}
                  </span>
                  {requirement.assignee.name}
                </span>
              ) : (
                <span className="text-sm text-gray-400">未指派</span>
              )}
            </SidebarItem>
            <SidebarItem label="期望日期">
              {requirement.expectedDate ? (
                <span className="text-sm text-gray-600">
                  {new Date(requirement.expectedDate).toLocaleDateString('zh-CN')}
                </span>
              ) : (
                <span className="text-sm text-gray-400">未设置</span>
              )}
            </SidebarItem>
            <SidebarItem label="投票">
              <span className="text-sm font-medium text-gray-700">
                {requirement._count.votes} 票
              </span>
            </SidebarItem>

            {/* Status Timeline */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                状态时间线
              </h4>
              <StatusTimeline logs={requirement.statusLogs} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      {children}
    </div>
  )
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
