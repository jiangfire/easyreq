import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import Link from 'next/link'
import { StatusBadge } from '@/components/requirement/status-badge'
import { StatusActions } from '@/components/requirement/status-actions'
import { getAvailableTransitions, type ReqStatus } from '@/lib/transitions'

export default async function ReviewQueuePage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/dashboard')
  }

  const requirements = await db.requirement.findMany({
    where: { status: 'UNDER_REVIEW' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      number: true,
      title: true,
      priority: true,
      status: true,
      createdAt: true,
      project: { select: { slug: true, name: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { votes: true } },
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">评审队列</h1>
      <p className="text-sm text-gray-500">共 {requirements.length} 条待评审需求</p>

      {requirements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">暂无待评审需求</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map((r) => {
            const targets = getAvailableTransitions(
              r.status as ReqStatus,
              user.role as never,
            )
            return (
              <div
                key={r.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-gray-400">#{r.number}</span>
                    </div>
                    <Link
                      href={`/projects/${r.project.slug}/requirements/${r.id}`}
                      className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">
                      {r.project.name} · {r.author.name} · {r._count.votes} 票 ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <StatusActions
                      requirementId={r.id}
                      availableTargets={targets}
                      compact
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
