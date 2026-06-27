import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { Prisma } from '@/generated/prisma/client'
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

    // Run the entire read-toggle-count-milestone inside one transaction so
    // concurrent toggles can't produce P2002/P2025 errors or miscount at
    // the milestone threshold.
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.vote.findUnique({
        where: {
          requirementId_userId: { requirementId, userId },
        },
      })

      const prevCount = await tx.vote.count({ where: { requirementId } })

      let voted: boolean
      try {
        if (existing) {
          await tx.vote.delete({ where: { id: existing.id } })
          voted = false
        } else {
          await tx.vote.create({ data: { requirementId, userId } })
          voted = true
        }
      } catch (error) {
        // Race between two concurrent toggles: translate Prisma unique/
        // not-found errors into a clean conflict so callers see 409 not 500.
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002' || error.code === 'P2025') {
            throw new AppError('CONFLICT', '投票状态刚被更新，请重试')
          }
        }
        throw error
      }

      const count = await tx.vote.count({ where: { requirementId } })
      const milestone = !existing
        ? this.getCrossedMilestone(prevCount, count)
        : null

      return { voted, count, milestone }
    })

    if (result.milestone) {
      await this.notifyMilestone(
        requirementId,
        requirement,
        result.milestone,
        result.count,
      )
    }

    return result
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
