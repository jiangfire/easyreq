import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { STATUS_CONFIG } from '@/lib/constants'

export default async function AdminStatsPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/dashboard')
  }

  const [
    statusCounts,
    priorityCounts,
    topVoted,
    avgCycleTimes,
    totalUsers,
  ] = await Promise.all([
    db.requirement.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    db.requirement.groupBy({
      by: ['priority'],
      _count: { priority: true },
    }),
    db.requirement.findMany({
      orderBy: { votes: { _count: 'desc' } },
      take: 10,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        project: { select: { slug: true } },
        _count: { select: { votes: true } },
      },
    }),
    getAvgCycleTimes(),
    db.user.count(),
  ])

  const statusData = statusCounts.map((s) => ({
    status: s.status,
    label: STATUS_CONFIG[s.status]?.label ?? s.status,
    count: s._count.status,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="总需求" value={statusData.reduce((a, b) => a + b.count, 0)} />
        <StatCard label="评审中" value={statusData.find((s) => s.status === 'UNDER_REVIEW')?.count ?? 0} />
        <StatCard label="开发中" value={statusData.find((s) => s.status === 'IN_DEVELOPMENT')?.count ?? 0} />
        <StatCard label="总用户" value={totalUsers} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">状态分布</h2>
          <div className="space-y-2">
            {statusData.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{s.label}</span>
                <span className="font-medium text-gray-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">优先级分布</h2>
          <div className="space-y-2">
            {priorityCounts.map((p) => (
              <div key={p.priority} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{p.priority}</span>
                <span className="font-medium text-gray-900">{p._count.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">投票 Top 10</h2>
        <div className="space-y-2">
          {topVoted.map((r) => (
            <a
              key={r.id}
              href={`/projects/${r.project.slug}/requirements/${r.id}`}
              className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-gray-50"
            >
              <span className="text-gray-700">
                #{r.number} {r.title}
              </span>
              <span className="font-medium text-gray-900">{r._count.votes} 票</span>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">平均处理时长</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{avgCycleTimes.submittedToReview}</p>
            <p className="text-xs text-gray-500">提交 → 评审中</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{avgCycleTimes.devToDelivered}</p>
            <p className="text-xs text-gray-500">开发中 → 已交付</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">{avgCycleTimes.deliveredToAccepted}</p>
            <p className="text-xs text-gray-500">已交付 → 已验收</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

async function getAvgCycleTimes() {
  const logs = await db.statusLog.findMany({
    where: {
      toStatus: { in: ['UNDER_REVIEW', 'DELIVERED', 'ACCEPTED'] },
    },
    select: {
      requirementId: true,
      toStatus: true,
      createdAt: true,
      requirement: {
        select: { createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const firstReview = logs.filter((l) => l.toStatus === 'UNDER_REVIEW')
  const delivered = logs.filter((l) => l.toStatus === 'DELIVERED')
  const accepted = logs.filter((l) => l.toStatus === 'ACCEPTED')

  return {
    submittedToReview: avgHours(firstReview.map((l) => diffHours(l.requirement.createdAt, l.createdAt))),
    devToDelivered: avgHours(delivered.map((l) => diffHours(findPrevLogTime(logs, l.requirementId, 'IN_DEVELOPMENT'), l.createdAt))),
    deliveredToAccepted: avgHours(accepted.map((l) => diffHours(findPrevLogTime(logs, l.requirementId, 'DELIVERED'), l.createdAt))),
  }
}

function findPrevLogTime(
  logs: { requirementId: string; toStatus: string; createdAt: Date }[],
  requirementId: string,
  status: string,
): Date | null {
  const found = logs
    .filter((l) => l.requirementId === requirementId && l.toStatus === status)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .pop()
  return found?.createdAt ?? null
}

function diffHours(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null
  return (end.getTime() - start.getTime()) / 1000 / 60 / 60
}

function avgHours(values: (number | null)[]): string {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return '-'
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  return `${avg.toFixed(1)}h`
}
