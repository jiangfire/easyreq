import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { VOTE_MILESTONES } from '@/lib/constants'
import {
  notificationService,
  requirementLink,
} from '@/services/notification.service'

export class VoteService {
  async toggle(requirementId: string, userId: string) {
    const requirement = await db.requirement.findUnique({
      where: { id: requirementId },
      select: {
        projectId: true,
        number: true,
        title: true,
        authorId: true,
        project: { select: { slug: true } },
      },
    })
    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const existing = await db.vote.findUnique({
      where: {
        requirementId_userId: { requirementId, userId },
      },
    })

    const prevCount = await db.vote.count({ where: { requirementId } })

    if (existing) {
      await db.vote.delete({ where: { id: existing.id } })
    } else {
      await db.vote.create({ data: { requirementId, userId } })
    }

    const count = await db.vote.count({ where: { requirementId } })
    const milestone = existing
      ? null
      : this.getCrossedMilestone(prevCount, count)

    if (milestone) {
      await this.notifyMilestone(requirementId, requirement, milestone, count)
    }

    return { voted: !existing, count, milestone }
  }

  /**
   * Check if the current vote count crosses a milestone.
   * Returns the milestone if crossed, null otherwise.
   */
  getCrossedMilestone(prevCount: number, newCount: number): number | null {
    for (const threshold of VOTE_MILESTONES) {
      if (prevCount < threshold && newCount >= threshold) {
        return threshold
      }
    }
    return null
  }

  private async notifyMilestone(
    requirementId: string,
    requirement: {
      projectId: string
      number: number
      title: string
      authorId: string
      project: { slug: string }
    },
    milestone: number,
    count: number,
  ) {
    const managers = await db.projectMember.findMany({
      where: {
        projectId: requirement.projectId,
        user: { role: { in: ['MANAGER', 'ADMIN'] } },
      },
      select: { userId: true },
    })

    const notified = new Set<string>()
    const targets = []

    for (const m of managers) {
      if (!notified.has(m.userId)) {
        notified.add(m.userId)
        targets.push({
          userId: m.userId,
          type: 'VOTE_MILESTONE' as const,
          title: `需求 #${requirement.number} 达到 ${milestone} 票`,
          body: `${requirement.title} 当前共 ${count} 票`,
          link: requirementLink(requirement.project.slug, requirement.number),
        })
      }
    }

    await notificationService.createMany(targets)
  }
}

export const voteService = new VoteService()
