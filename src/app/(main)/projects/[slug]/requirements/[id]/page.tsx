import { getCurrentUser } from '@/services/auth.service'
import { requirementService } from '@/services/requirement.service'
import { projectService } from '@/services/project.service'
import { labelService } from '@/services/label.service'
import { StatusBadge, PriorityBadge } from '@/components/requirement/status-badge'
import { StatusTimeline } from '@/components/requirement/status-timeline'
import { StatusActions } from '@/components/requirement/status-actions'
import { VoteButton } from '@/components/requirement/vote-button'
import { CommentSection } from '@/components/comment/comment-section'
import { EditableTitle, EditableBody, EditablePriority, EditableExpectedDate, EditableAcceptanceCriteria } from '@/components/requirement/editable-fields'
import { getAvailableTransitions, type ReqStatus } from '@/lib/transitions'
import Image from 'next/image'
import { LabelSelector } from '@/components/requirement/label-selector'
import { AssigneeSelector } from '@/components/requirement/assignee-selector'
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
    user.role,
  )

  const [members, labels] = await Promise.all([
    projectService.listMembers(requirement.project.id, user.id),
    labelService.list(requirement.project.id),
  ])

  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN'
  const isAuthor = requirement.authorId === user.id

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
            <h1 className="text-2xl font-bold text-gray-900">
              <EditableTitle
                requirementId={requirement.id}
                initialTitle={requirement.title}
                canEdit={isAuthor}
              />
            </h1>
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
          <EditableBody
            requirementId={requirement.id}
            initialBody={requirement.body}
            canEdit={isAuthor}
          />

          {/* Attachments */}
          {requirement.attachments.length > 0 && (
            <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">附件 ({requirement.attachments.length})</h3>
              <div className="flex flex-wrap gap-3">
                {requirement.attachments.map((a) => {
                  const url = `/api/attachments/${a.id}`
                  const isImage = a.mimeType.startsWith('image/')
                  return (
                    <a
                      key={a.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex max-w-[200px] flex-col overflow-hidden rounded-md border border-gray-200 bg-white hover:border-blue-300"
                    >
                      {isImage ? (
                        <Image
                          src={url}
                          alt={a.fileName}
                          width={200}
                          height={96}
                          unoptimized
                          className="h-24 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center bg-gray-100">
                          <span className="text-2xl">📄</span>
                        </div>
                      )}
                      <div className="truncate px-2 py-1.5 text-xs text-gray-700">
                        {a.fileName}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Acceptance Criteria */}
          <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">验收标准</h3>
            <EditableAcceptanceCriteria
              requirementId={requirement.id}
              initialAcceptanceCriteria={requirement.acceptanceCriteria}
              canEdit={isManager}
            />
          </div>

          {/* Comments */}
          <div className="mt-8 border-t border-gray-200 pt-4">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              评论 ({requirement._count.comments})
            </h3>
            <CommentSection
              requirementId={requirement.id}
              initialComments={requirement.comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              }))}
              currentUserId={user.id}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <SidebarItem label="状态">
              <StatusBadge status={requirement.status} />
            </SidebarItem>
            <SidebarItem label="优先级">
              <EditablePriority
                requirementId={requirement.id}
                initialPriority={requirement.priority}
                canEdit={isManager}
              />
            </SidebarItem>
            <SidebarItem label="指派给">
              <AssigneeSelector
                requirementId={requirement.id}
                members={members.map((m) => ({ userId: m.userId, name: m.user.name }))}
                assignee={requirement.assignee ? { userId: requirement.assignee.id, name: requirement.assignee.name } : null}
                canEdit={isManager}
              />
            </SidebarItem>
            <SidebarItem label="标签">
              <LabelSelector
                requirementId={requirement.id}
                labels={labels}
                selected={requirement.labels.map((l) => l.label)}
                canEdit={isManager || isAuthor}
              />
            </SidebarItem>
            <SidebarItem label="期望日期">
              <EditableExpectedDate
                requirementId={requirement.id}
                initialExpectedDate={requirement.expectedDate?.toISOString() ?? null}
                canEdit={isManager}
              />
            </SidebarItem>
            <SidebarItem label="投票">
              <VoteButton
                requirementId={requirement.id}
                initialVoted={requirement.votes.length > 0}
                initialCount={requirement._count.votes}
              />
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
