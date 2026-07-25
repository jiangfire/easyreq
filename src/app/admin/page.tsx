import { getCurrentUser } from '@/services/auth.service'
import { redirect } from 'next/navigation'
import { statsService, type StatsWindow, STATS_WINDOW_LABELS } from '@/services/stats.service'
import { TimeWindowFilter } from '@/components/admin/time-window-filter'

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/dashboard')
  }

  const sp = await searchParams
  const window: StatsWindow = isValidWindow(sp.window) ? sp.window : 'all'

  const [
    baseStats,
    projectBacklog,
    windowedStats,
    leaderboard,
  ] = await Promise.all([
    statsService.getAdminStats(),
    statsService.getProjectBacklog(),
    statsService.getWindowedStats(window),
    statsService.getUserLeaderboard(window),
  ])

  const { statusData, priorityCounts, topVoted, avgCycleTimes, totalUsers } = baseStats
  const totalRequirements = statusData.reduce((a, b) => a + b.count, 0)
  const reviewCount = statusData.find((s) => s.status === 'UNDER_REVIEW')?.count ?? 0
  const devCount = statusData.find((s) => s.status === 'IN_DEVELOPMENT')?.count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">统计看板</h1>
        <TimeWindowFilter current={window} labels={STATS_WINDOW_LABELS} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="总需求" value={totalRequirements} />
        <StatCard label="评审中" value={reviewCount} />
        <StatCard label="开发中" value={devCount} />
        <StatCard label="总用户" value={totalUsers} />
      </div>

      {/* Windowed counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={`${STATS_WINDOW_LABELS[window]}新增`}
          value={windowedStats.total}
          subtext="提交数"
        />
        <StatCard
          label={`${STATS_WINDOW_LABELS[window]}未关闭`}
          value={windowedStats.open}
          subtext="未完成需求"
        />
        <StatCard
          label={`${STATS_WINDOW_LABELS[window]}已关闭`}
          value={windowedStats.closed}
          subtext="已验收/驳回"
        />
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

      {/* Project backlog */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">项目积压</h2>
        {projectBacklog.length === 0 ? (
          <p className="text-sm text-gray-400">暂无未关闭需求</p>
        ) : (
          <div className="space-y-2">
            {projectBacklog.slice(0, 8).map((p) => (
              <div key={p.projectId ?? 'unassigned'} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {p.projectSlug ? (
                    <a
                      href={`/projects/${p.projectSlug}`}
                      className="text-gray-700 hover:text-blue-600 hover:underline"
                    >
                      {p.projectName}
                    </a>
                  ) : (
                    <span className="text-gray-500">{p.projectName}</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatStatusBreakdown(p.byStatus)}
                  </span>
                </div>
                <span className="font-medium text-gray-900">{p.totalOpen}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User leaderboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">
            提交最多 · {STATS_WINDOW_LABELS[window]}
          </h2>
          {leaderboard.topSubmitters.length === 0 ? (
            <p className="text-sm text-gray-400">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.topSubmitters.map((s, i) => (
                <div key={s.user.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">#{i + 1}</span>
                    <span className="text-gray-700">{s.user.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">
            关闭最多 · {STATS_WINDOW_LABELS[window]}
          </h2>
          {leaderboard.topClosers.length === 0 ? (
            <p className="text-sm text-gray-400">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.topClosers.map((s, i) => (
                <div key={s.user.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">#{i + 1}</span>
                    <span className="text-gray-700">{s.user.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">投票 Top 10</h2>
        <div className="space-y-2">
          {topVoted.map((r) => (
            <a
              key={r.id}
              href={r.project ? `/projects/${r.project.slug}/requirements/${r.id}` : `/requirements/${r.id}`}
              className="flex items-center justify-between rounded-md p-2 text-sm hover:bg-gray-50"
            >
              <span className="text-gray-700">
                #{r.number ?? r.globalNumber} {r.title}
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

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string
  value: number
  subtext?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {subtext && <p className="mt-1 text-[10px] text-gray-400">{subtext}</p>}
    </div>
  )
}

function isValidWindow(v: string | undefined): v is StatsWindow {
  return v === 'all' || v === 'week' || v === 'month' || v === 'quarter'
}

const STATUS_SHORT_LABEL: Record<string, string> = {
  SUBMITTED: '提交',
  UNDER_REVIEW: '评审',
  PLANNED: '规划',
  IN_DEVELOPMENT: '开发',
  IN_TESTING: '测试',
}

function formatStatusBreakdown(byStatus: Record<string, number>): string {
  return Object.entries(byStatus)
    .map(([status, count]) => `${STATUS_SHORT_LABEL[status] ?? status}:${count}`)
    .join(' · ')
}