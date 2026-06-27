import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { requirementService } from '@/services/requirement.service'
import Link from 'next/link'
import { StatusBadge } from '@/components/requirement/status-badge'
import { PriorityBadge } from '@/components/requirement/status-badge'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const requirements = await requirementService.listForUser(user.id)

  const grouped = requirements.reduce(
    (acc, r) => {
      acc[r.status] = acc[r.status] ?? []
      acc[r.status].push(r)
      return acc
    },
    {} as Record<
      string,
      Array<{
        id: string
        number: number
        title: string
        status: string
        priority: string
        createdAt: Date
        updatedAt: Date
        project: { slug: string; name: string }
        _count: { votes: number; comments: number }
      }>
    >,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">我的看板</h1>
        <p className="mt-1 text-sm text-gray-500">你提交的需求和指派给你的需求</p>
      </div>

      {requirements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">暂无相关需求</p>
          <Link href="/projects" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            浏览项目
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([status, items]) => (
          <div key={status}>
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((r) => (
                <Link
                  key={r.id}
                  href={`/projects/${r.project.slug}/requirements/${r.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        #{r.number} {r.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {r.project.name} · {new Date(r.updatedAt).toLocaleDateString('zh-CN')} 更新
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PriorityBadge priority={r.priority} />
                      <span className="text-xs text-gray-400">{r._count.votes} 票</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
