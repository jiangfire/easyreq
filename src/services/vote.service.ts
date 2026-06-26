import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { VOTE_MILESTONES } from '@/lib/constants'

export class VoteService {
  async toggle(requirementId: string, userId: string) {
    const requirement = await db.requirement.findUnique({
      where: { id: requirementId },
      select: { projectId: true },
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

    if (existing) {
      await db.vote.delete({ where: { id: existing.id } })
    } else {
      await db.vote.create({ data: { requirementId, userId } })
    }

    const count = await db.vote.count({ where: { requirementId } })
    return { voted: !existing, count }
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
}

export const voteService = new VoteService()
