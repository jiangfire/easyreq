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
        globalNumber: number
        number: number | null
        title: string
        status: string
        priority: string
        createdAt: Date
        updatedAt: Date
        project: { slug: string; name: string } | null
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
          <p className="text-sm text-gray-400">还没有需求</p>
          <p className="mt-2 text-xs text-gray-400">
            点击右下角的 <span className="font-medium text-blue-600">+</span> 按钮或按 <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs">N</kbd> 键提交第一个需求
          </p>
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
                  href={r.project ? `/projects/${r.project.slug}/requirements/${r.id}` : `/requirements/${r.id}`}
                  className="block rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        #{r.globalNumber} {r.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {r.project ? `${r.project.name} · ` : ''}
                        {new Date(r.updatedAt).toLocaleDateString('zh-CN')} 更新
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
