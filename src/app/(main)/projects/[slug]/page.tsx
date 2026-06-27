import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { requirementService } from '@/services/requirement.service'
import { labelService } from '@/services/label.service'
import { RequirementList } from '@/components/requirement/requirement-list'
import { QuickSubmit } from '@/components/requirement/quick-submit'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    status?: string
    priority?: string
    sortBy?: string
    page?: string
    assigneeId?: string
    labelIds?: string
  }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const user = await getCurrentUser()
  if (!user) return null

  let project
  try {
    project = await projectService.getBySlug(slug, user.id)
  } catch {
    notFound()
  }

  const labelIds = sp.labelIds ? sp.labelIds.split(',').filter(Boolean) : undefined

  const [result, labels, members] = await Promise.all([
    requirementService.list(project.id, user.id, {
      status: sp.status && sp.status !== 'all' ? [sp.status] : undefined,
      priority: sp.priority ? sp.priority.split(',').filter(Boolean) : undefined,
      assigneeId: sp.assigneeId || undefined,
      labelIds,
      sortBy: sp.sortBy ?? 'createdAt',
      page: sp.page ? parseInt(sp.page, 10) : 1,
      pageSize: 25,
    }),
    labelService.list(project.id),
    db.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/projects" className="hover:text-gray-700">项目</Link>
          <span>/</span>
          <span className="text-gray-700">{project.name}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{project.name}</h1>
        {project.description && <p className="mt-1 text-sm text-gray-500">{project.description}</p>}
      </div>

      {/* Quick submit */}
      <div className="mb-6">
        <QuickSubmit projectSlug={slug} />
      </div>

      {/* Requirements list */}
      <RequirementList
        requirements={result.data}
        pagination={result.pagination}
        projectSlug={slug}
        labels={labels}
        members={members.map((m) => m.user)}
        searchParams={{
          status: sp.status,
          priority: sp.priority,
          sortBy: sp.sortBy,
          assigneeId: sp.assigneeId,
          labelIds: sp.labelIds,
        }}
      />

      {/* Members */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">
          项目成员 ({project.members.length})
        </summary>
        <div className="mt-3 space-y-2">
          {project.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                {m.user.name.charAt(0)}
              </div>
              <span className="text-gray-700">{m.user.name}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {m.role === 'OWNER' ? '负责人' : '成员'}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
