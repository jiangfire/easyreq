import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()
  if (!user) return null

  let project
  try {
    project = await projectService.getBySlug(slug, user.id)
  } catch {
    notFound()
  }

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

      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
        <p className="text-sm text-gray-400">需求列表即将实现</p>
      </div>

      {/* Members */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">项目成员</h2>
        <div className="space-y-2">
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
      </div>
    </div>
  )
}
