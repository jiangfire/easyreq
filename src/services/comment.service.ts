import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'

export class CommentService {
  async list(requirementId: string, userId: string) {
    await this.checkAccess(requirementId, userId)

    return db.comment.findMany({
      where: { requirementId, isDeleted: false },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(requirementId: string, authorId: string, body: string) {
    await this.checkAccess(requirementId, authorId)

    return db.comment.create({
      data: { requirementId, authorId, body },
      include: {
        author: { select: { id: true, name: true } },
      },
    })
  }

  async softDelete(commentId: string, userId: string, userRole: string) {
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: { requirement: { select: { id: true } } },
    })

    if (!comment) {
      throw new AppError('NOT_FOUND', '评论不存在')
    }

    const isAuthor = comment.authorId === userId
    const isManager = userRole === 'MANAGER' || userRole === 'ADMIN'
    if (!isAuthor && !isManager) {
      throw new AppError('FORBIDDEN', '只能删除自己的评论')
    }

    return db.comment.update({
      where: { id: commentId },
      data: { isDeleted: true },
    })
  }

  private async checkAccess(requirementId: string, userId: string) {
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
  }
}

export const commentService = new CommentService()
