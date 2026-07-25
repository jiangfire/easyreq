import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { requirementService } from '@/services/requirement.service'
import { KanbanBoard } from '@/components/requirement/kanban-board'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  let project
  try {
    project = await projectService.getBySlug(slug, user.id)
  } catch {
    notFound()
  }

  // Fetch all requirements for the project (small project assumption).
  // For larger projects we'd add a paginated / filterable endpoint.
  const result = await requirementService.list(project.id, user.id, {
    page: 1,
    pageSize: 200,
    sortBy: 'createdAt',
  })

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href={`/projects/${slug}`} className="hover:text-gray-700">
            {project.name}
          </Link>
          <span>/</span>
          <span>看板</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          {project.name} · 需求看板
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          拖动卡片到目标列以改变状态。当前 {result.pagination.totalItems} 条需求。
        </p>
      </div>

      <KanbanBoard
        projectSlug={slug}
        cards={result.data.map((r) => ({
          id: r.id,
          globalNumber: r.globalNumber,
          number: r.number,
          title: r.title,
          priority: r.priority,
          assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name } : null,
          author: { id: r.author.id, name: r.author.name },
          updatedAt: r.updatedAt.toISOString(),
        }))}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  )
}