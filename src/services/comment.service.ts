import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import {
  notificationService,
  requirementLink,
} from '@/services/notification.service'

export class CommentService {
  async list(
    requirementId: string,
    userId: string,
    options: { page?: number; pageSize?: number } = {},
  ) {
    await this.checkAccess(requirementId, userId)

    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25

    const [comments, total] = await Promise.all([
      db.comment.findMany({
        where: { requirementId, isDeleted: false },
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.comment.count({ where: { requirementId, isDeleted: false } }),
    ])

    return {
      data: comments,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  async create(requirementId: string, authorId: string, body: string) {
    await this.checkAccess(requirementId, authorId)

    const comment = await db.comment.create({
      data: { requirementId, authorId, body },
      include: {
        author: { select: { id: true, name: true } },
        requirement: {
          select: {
            number: true,
            title: true,
            authorId: true,
            assigneeId: true,
            project: { select: { slug: true } },
            comments: {
              where: { isDeleted: false },
              select: { authorId: true },
              distinct: ['authorId'],
            },
          },
        },
      },
    })

    const r = comment.requirement
    const notifiedUserIds = new Set<string>()
    const targets = []

    if (r.authorId !== authorId) {
      notifiedUserIds.add(r.authorId)
      targets.push({
        userId: r.authorId,
        type: 'COMMENT' as const,
        title: `${comment.author.name} 评论了你的需求 #${r.number}`,
        body: r.title,
        link: requirementLink(r.project.slug, r.number),
      })
    }

    for (const c of r.comments) {
      if (c.authorId !== authorId && !notifiedUserIds.has(c.authorId)) {
        notifiedUserIds.add(c.authorId)
        targets.push({
          userId: c.authorId,
          type: 'COMMENT' as const,
          title: `${comment.author.name} 回复了需求 #${r.number}`,
          body: r.title,
          link: requirementLink(r.project.slug, r.number),
        })
      }
    }

    if (r.assigneeId && r.assigneeId !== authorId && !notifiedUserIds.has(r.assigneeId)) {
      targets.push({
        userId: r.assigneeId,
        type: 'COMMENT' as const,
        title: `${comment.author.name} 评论了指派给你的需求 #${r.number}`,
        body: r.title,
        link: requirementLink(r.project.slug, r.number),
      })
    }

    await notificationService.createMany(targets)

    return comment
  }

  async update(commentId: string, userId: string, body: string) {
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: { requirement: { select: { id: true, projectId: true } } },
    })

    if (!comment) {
      throw new AppError('NOT_FOUND', '评论不存在')
    }

    // Don't allow editing a soft-deleted comment (it should appear gone).
    if (comment.isDeleted) {
      throw new AppError('NOT_FOUND', '评论不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: comment.requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    if (comment.authorId !== userId) {
      throw new AppError('FORBIDDEN', '只能编辑自己的评论')
    }

    return db.comment.update({
      where: { id: commentId },
      data: { body },
      include: {
        author: { select: { id: true, name: true } },
      },
    })
  }

  async softDelete(commentId: string, userId: string, userRole: string) {
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: { requirement: { select: { id: true, projectId: true } } },
    })

    if (!comment) {
      throw new AppError('NOT_FOUND', '评论不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: comment.requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
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
