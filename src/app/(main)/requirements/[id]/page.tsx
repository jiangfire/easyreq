import { getCurrentUser } from '@/services/auth.service'
import { requirementService } from '@/services/requirement.service'
import { projectService } from '@/services/project.service'
import { StatusBadge, PriorityBadge } from '@/components/requirement/status-badge'
import { StatusActions } from '@/components/requirement/status-actions'
import { VoteButton } from '@/components/requirement/vote-button'
import { CommentSection } from '@/components/comment/comment-section'
import { EditableTitle, EditableBody } from '@/components/requirement/editable-fields'
import { AssignToProject } from '@/components/requirement/assign-to-project'
import { AttachmentPreview } from '@/components/attachment/attachment-preview'
import { getAvailableTransitions, type ReqStatus } from '@/lib/transitions'
import { notFound } from 'next/navigation'

export default async function UnassignedRequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  let requirement
  try {
    requirement = await requirementService.getById(id, user.id)
  } catch {
    notFound()
  }

  if (requirement.project) {
    // Assigned requirements should use the project-scoped URL.
    // We keep this page focused on unassigned requirements.
    // (A redirect could also work, but showing the same content via both URLs
    // is acceptable for now.)
  }

  const availableTargets = getAvailableTransitions(
    requirement.status as ReqStatus,
    user.role,
  ).filter((t) => {
    // Unassigned requirements: author can resubmit, manager/admin can reject.
    if (requirement.projectId) return true
    if (t === 'SUBMITTED') return requirement.authorId === user.id || user.role === 'MANAGER' || user.role === 'ADMIN'
    if (t === 'REJECTED') return user.role === 'MANAGER' || user.role === 'ADMIN'
    return false
  })

  const isManager = user.role === 'MANAGER' || user.role === 'ADMIN'
  const isAuthor = requirement.authorId === user.id

  const projects = isManager ? await projectService.listForUser(user.id) : []

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <span>未归集需求</span>
        <span>/</span>
        <span>#{requirement.globalNumber}</span>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-6 border-b border-gray-200 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg font-bold text-gray-400">#{requirement.globalNumber}</span>
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

          {availableTargets.length > 0 && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500">状态操作</p>
              <StatusActions
                requirementId={requirement.id}
                availableTargets={availableTargets}
              />
            </div>
          )}

          <EditableBody
            requirementId={requirement.id}
            initialBody={requirement.body}
            canEdit={isAuthor}
          />

          {requirement.attachments.length > 0 && (
            <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                附件 ({requirement.attachments.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {requirement.attachments.map((a) => (
                  <AttachmentPreview
                    key={a.id}
                    url={`/api/attachments/${a.id}`}
                    fileName={a.fileName}
                    mimeType={a.mimeType}
                    size={a.fileSize}
                  />
                ))}
              </div>
            </div>
          )}

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

        <div className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-4">
            <SidebarItem label="状态">
              <StatusBadge status={requirement.status} />
            </SidebarItem>
            <SidebarItem label="优先级">
              <span className="text-sm text-gray-700">{requirement.priority}</span>
            </SidebarItem>
            <SidebarItem label="投票">
              <VoteButton
                requirementId={requirement.id}
                initialVoted={requirement.votes.length > 0}
                initialCount={requirement._count.votes}
              />
            </SidebarItem>

            {isManager && !requirement.projectId && (
              <SidebarItem label="归集到项目">
                <AssignToProject
                  requirementId={requirement.id}
                  projects={projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug }))}
                />
              </SidebarItem>
            )}
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
