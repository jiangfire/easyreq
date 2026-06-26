import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { CreateProjectDialog } from '@/components/requirement/create-project-dialog'
import Link from 'next/link'

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const projects = await projectService.listForUser(user.id)
  const canCreate = user.role === 'MANAGER' || user.role === 'ADMIN'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">项目</h1>
          <p className="mt-1 text-sm text-gray-500">选择一个项目查看需求</p>
        </div>
        {canCreate && <CreateProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">暂无项目</p>
          {canCreate && <p className="mt-1 text-xs text-gray-400">点击右上角创建项目</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-sm font-bold text-blue-700">
                  {p.name.charAt(0)}
                </span>
                <h3 className="font-medium text-gray-900">{p.name}</h3>
              </div>
              {p.description && (
                <p className="mb-3 line-clamp-2 text-sm text-gray-500">{p.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {p._count.requirements} 需求
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
