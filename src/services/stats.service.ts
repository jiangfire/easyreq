import { db } from '@/lib/db'
import { STATUS_CONFIG } from '@/lib/constants'
import type { RequirementStatus } from '@/generated/prisma/client'

/**
 * Time window for stats queries. Used by the admin dashboard filter
 * and exported so the UI can construct the same labels.
 */
export type StatsWindow = 'all' | 'week' | 'month' | 'quarter'

export const STATS_WINDOW_LABELS: Record<StatsWindow, string> = {
  all: '全部时间',
  week: '本周',
  month: '本月',
  quarter: '本季度',
}

const OPEN_STATUSES: RequirementStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'PLANNED',
  'IN_DEVELOPMENT',
  'IN_TESTING',
]

const CLOSED_STATUSES: RequirementStatus[] = ['ACCEPTED', 'REJECTED']

export class StatsService {
  async getAdminStats() {
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
          globalNumber: true,
          number: true,
          title: true,
          status: true,
          project: { select: { slug: true } },
          _count: { select: { votes: true } },
        },
      }),
      this.getAvgCycleTimes(),
      db.user.count(),
    ])

    const statusData = statusCounts.map((s) => ({
      status: s.status,
      label: STATUS_CONFIG[s.status]?.label ?? s.status,
      count: s._count.status,
    }))

    return {
      statusData,
      priorityCounts,
      topVoted,
      avgCycleTimes,
      totalUsers,
    }
  }

  /**
   * Per-project backlog: how many OPEN requirements each project has, with
   * the dominant status shown. Answers "which project is the most stuck".
   * Includes unassigned requirements under a virtual "未归集" bucket.
   */
  async getProjectBacklog() {
    const groups = await db.requirement.groupBy({
      by: ['projectId', 'status'],
      where: { status: { in: OPEN_STATUSES } },
      _count: { _all: true },
    })

    const byProject = new Map<
      string | null,
      { projectSlug: string | null; projectName: string; totalOpen: number; byStatus: Record<string, number> }
    >()

    for (const row of groups) {
      const key = row.projectId
      let entry = byProject.get(key)
      if (!entry) {
        entry = {
          projectSlug: null,
          projectName: key ? '' : '未归集',
          totalOpen: 0,
          byStatus: {},
        }
        byProject.set(key, entry)
      }
      entry.totalOpen += row._count._all
      entry.byStatus[row.status] = row._count._all
    }

    // Hydrate project names for the non-null projectIds
    const projectIds = [...byProject.keys()].filter((k): k is string => !!k)
    if (projectIds.length > 0) {
      const projects = await db.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true, slug: true },
      })
      const byId = new Map(projects.map((p) => [p.id, p]))
      for (const [id, entry] of byProject.entries()) {
        if (!id) continue
        const p = byId.get(id)
        if (p) {
          entry.projectName = p.name
          entry.projectSlug = p.slug
        }
      }
    }

    return [...byProject.entries()]
      .map(([id, v]) => ({ projectId: id, ...v }))
      .sort((a, b) => b.totalOpen - a.totalOpen)
  }

  /**
   * Time-windowed stat counts. The window applies to `createdAt` on the
   * Requirement table (i.e. "X requirements submitted in the last 7 days").
   */
  async getWindowedStats(window: StatsWindow) {
    if (window === 'all') {
      const [total, open, closed] = await Promise.all([
        db.requirement.count(),
        db.requirement.count({ where: { status: { in: OPEN_STATUSES } } }),
        db.requirement.count({ where: { status: { in: CLOSED_STATUSES } } }),
      ])
      return { window, total, open, closed }
    }

    const since = windowStart(window)
    const [total, open, closed] = await Promise.all([
      db.requirement.count({ where: { createdAt: { gte: since } } }),
      db.requirement.count({
        where: { createdAt: { gte: since }, status: { in: OPEN_STATUSES } },
      }),
      db.requirement.count({
        where: { createdAt: { gte: since }, status: { in: CLOSED_STATUSES } },
      }),
    ])
    return { window, total, open, closed }
  }

  /**
   * User leaderboard: top submitters (most requirements created) and top
   * closers (most requirements that reached ACCEPTED). Two ranked lists.
   */
  async getUserLeaderboard(window: StatsWindow = 'all') {
    const since = window === 'all' ? undefined : windowStart(window)

    const topSubmitters = await db.requirement.groupBy({
      by: ['authorId'],
      where: since ? { createdAt: { gte: since } } : undefined,
      _count: { _all: true },
      orderBy: { _count: { authorId: 'desc' } },
      take: 5,
    })

    const topClosers = await db.requirement.groupBy({
      by: ['authorId'],
      where: {
        status: 'ACCEPTED',
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { authorId: 'desc' } },
      take: 5,
    })

    // Resolve user info for the top IDs.
    const ids = [...new Set([...topSubmitters, ...topClosers].map((r) => r.authorId))]
    const users = ids.length
      ? await db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, role: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))

    return {
      window,
      topSubmitters: topSubmitters.map((r) => ({
        user: byId.get(r.authorId)!,
        count: r._count._all,
      })),
      topClosers: topClosers.map((r) => ({
        user: byId.get(r.authorId)!,
        count: r._count._all,
      })),
    }
  }

  private async getAvgCycleTimes() {
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

function windowStart(window: Exclude<StatsWindow, 'all'>): Date {
  const now = new Date()
  const start = new Date(now)
  if (window === 'week') {
    start.setDate(now.getDate() - 7)
  } else if (window === 'month') {
    start.setDate(now.getDate() - 30)
  } else {
    // quarter
    start.setDate(now.getDate() - 90)
  }
  return start
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

export const statsService = new StatsService()
