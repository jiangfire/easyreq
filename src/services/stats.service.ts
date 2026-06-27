import { db } from '@/lib/db'
import { STATUS_CONFIG } from '@/lib/constants'

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
