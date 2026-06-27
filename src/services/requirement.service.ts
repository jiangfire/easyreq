import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { CreateRequirementInput } from '@/lib/validation/requirement'
import type { Priority } from '@/generated/prisma/client'
import {
  notificationService,
  requirementLink,
  statusLabel,
} from '@/services/notification.service'
import {
  canTransition,
  isQuickPathTransition,
  hasTransitionPermission,
  type ReqStatus,
  type Role,
} from '@/lib/transitions'
import { notificationChannel } from '@/lib/notifications/channel'

export class RequirementService {
  /**
   * Broadcast a `requirement_updated` SSE event to all project members.
   */
  private async broadcastUpdated(requirementId: string, projectId: string, field: string) {
    const members = await db.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    })
    notificationChannel.publishToUsers(
      members.map((m) => m.userId),
      { event: 'requirement_updated', data: { id: requirementId, projectId, field } },
    )
  }
  /**
   * Get the next requirement number for a project.
   * Uses an atomic increment for concurrency safety.
   */
  async getNextNumber(projectId: string): Promise<number> {
    const project = await db.project.update({
      where: { id: projectId },
      data: { lastRequirementNumber: { increment: 1 } },
      select: { lastRequirementNumber: true },
    })
    return project.lastRequirementNumber
  }

  async create(projectId: string, authorId: string, input: CreateRequirementInput) {
    // Verify membership
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId: authorId, projectId } },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const number = await this.getNextNumber(projectId)

    return db.requirement.create({
      data: {
        projectId,
        authorId,
        number,
        title: input.title,
        body: input.body ?? null,
        priority: input.priority ?? 'MEDIUM',
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })
  }

  async getById(id: string, userId: string) {
    const requirement = await db.requirement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        project: {
          select: {
            id: true,
            slug: true,
            members: { select: { userId: true } },
          },
        },
        labels: {
          select: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
        statusLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            operator: { select: { id: true, name: true } },
          },
        },
        comments: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true } },
          },
        },
        votes: {
          where: { userId: userId },
          select: { id: true },
        },
        _count: {
          select: { comments: { where: { isDeleted: false } }, votes: true, attachments: true },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploader: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    // Check membership
    const isMember = requirement.project.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    return requirement
  }

  async listUnderReview(_userId: string) {
    return db.requirement.findMany({
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
  }

  async listForUser(userId: string) {
    return db.requirement.findMany({
      where: {
        OR: [{ authorId: userId }, { assigneeId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { slug: true, name: true } },
        _count: { select: { votes: true, comments: { where: { isDeleted: false } } } },
      },
    })
  }

  async list(
    projectId: string,
    userId: string,
    options: {
      status?: ReqStatus[]
      priority?: Priority[]
      assigneeId?: string
      labelIds?: string[]
      page?: number
      pageSize?: number
      sortBy?: string
    } = {},
  ) {
    // Verify membership
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 25
    const sortBy = options.sortBy ?? 'createdAt'

    const orderBy: { createdAt: 'desc' } | { updatedAt: 'desc' } | { votes: { _count: 'desc' } } =
      sortBy === 'votes'
        ? { votes: { _count: 'desc' as const } }
        : sortBy === 'updatedAt'
          ? { updatedAt: 'desc' as const }
          : { createdAt: 'desc' as const }

    const where = {
      projectId,
      ...(options.status ? { status: { in: options.status } } : {}),
      ...(options.priority ? { priority: { in: options.priority } } : {}),
      ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
      ...(options.labelIds && options.labelIds.length > 0
        ? { labels: { some: { labelId: { in: options.labelIds } } } }
        : {}),
    }

    const [requirements, total] = await Promise.all([
      db.requirement.findMany({
        where,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
          _count: {
            select: { comments: { where: { isDeleted: false } }, votes: true },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.requirement.count({ where }),
    ])

    return {
      data: requirements,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }
  async update(
    id: string,
    userId: string,
    userRole: string,
    data: Partial<{
      title: string
      body: string | null
      priority: string
      expectedDate: string | null
      acceptanceCriteria: string | null
      assigneeId: string | null
      labelIds: string[]
    }>,
  ) {
    const requirement = await db.requirement.findUniqueOrThrow({
      where: { id },
      include: {
        project: { select: { id: true, slug: true, members: { select: { userId: true } } } },
      },
    })

    const isMember = requirement.project.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const isAuthor = requirement.authorId === userId
    const isManager = userRole === 'MANAGER' || userRole === 'ADMIN'

    // Field-level permissions (spec: author 改 title/body; Manager 改 priority/assigneeId/expectedDate/acceptanceCriteria)
    const authorFields = ['title', 'body'] as const
    const managerFields = [
      'priority',
      'assigneeId',
      'expectedDate',
      'acceptanceCriteria',
      'labelIds',
    ] as const

    for (const field of authorFields) {
      if (data[field] !== undefined && !isAuthor) {
        throw new AppError('FORBIDDEN', `只能编辑自己的需求${field === 'title' ? '标题' : '描述'}`)
      }
    }
    for (const field of managerFields) {
      if (data[field] !== undefined && !isManager) {
        throw new AppError('FORBIDDEN', '只有管理者可修改该字段')
      }
    }

    // Validate assignee is a project member (or null to unassign)
    if (data.assigneeId && data.assigneeId !== requirement.assigneeId) {
      const assigneeMember = await db.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: data.assigneeId,
            projectId: requirement.project.id,
          },
        },
      })
      if (!assigneeMember) {
        throw new AppError('VALIDATION_ERROR', '指派人必须是项目成员')
      }
    }

    // Validate that all labelIds belong to the requirement's project. Without
    // this, a manager could attach labels from project A to a requirement in
    // project B (cross-project data leak via the RequirementLabel table,
    // which has no cross-project constraint).
    if (data.labelIds && data.labelIds.length > 0) {
      const ownedLabels = await db.label.findMany({
        where: {
          id: { in: data.labelIds },
          projectId: requirement.project.id,
        },
        select: { id: true },
      })
      if (ownedLabels.length !== data.labelIds.length) {
        throw new AppError('VALIDATION_ERROR', '包含不属于本项目的标签')
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.body !== undefined) updateData.body = data.body
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.expectedDate !== undefined) {
      updateData.expectedDate = data.expectedDate ? new Date(data.expectedDate) : null
    }
    if (data.acceptanceCriteria !== undefined) updateData.acceptanceCriteria = data.acceptanceCriteria
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId

    if (data.labelIds !== undefined) {
      updateData.labels = {
        deleteMany: {},
        create: data.labelIds.map((labelId) => ({ labelId })),
      }
    }

    const updated = await db.requirement.update({
      where: { id },
      data: updateData,
      include: {
        labels: {
          select: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      },
    })

    if (data.assigneeId && data.assigneeId !== requirement.assigneeId) {
      await notificationService.createMany([
        {
          userId: data.assigneeId,
          type: 'ASSIGNMENT',
          title: `需求 #${requirement.number} 被指派给你`,
          body: requirement.title,
          link: requirementLink(requirement.project.slug, requirement.number),
        },
      ])
    }

    await this.broadcastUpdated(id, requirement.project.id, 'fields')

    return updated
  }

  async transition(
    id: string,
    operatorId: string,
    operatorRole: Role,
    toStatus: ReqStatus,
    note?: string,
  ) {
    const requirement = await db.requirement.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, slug: true, members: { select: { userId: true } } } },
      },
    })

    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    const isMember = requirement.project.members.some((m) => m.userId === operatorId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const fromStatus = requirement.status as ReqStatus
    const isQuickPath = isQuickPathTransition(fromStatus, toStatus)

    if (!canTransition(fromStatus, toStatus)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `无法从 ${fromStatus} 转换到 ${toStatus}`,
      )
    }

    if (!hasTransitionPermission(fromStatus, toStatus, operatorRole)) {
      throw new AppError('FORBIDDEN', '你没有执行此操作权限')
    }

    // Optimistic lock: only apply the transition if the status is still the
    // one we validated against. Two concurrent transitions on the same
    // requirement can no longer both succeed and produce conflicting logs.
    await db.$transaction(async (tx) => {
      const result = await tx.requirement.updateMany({
        where: { id, status: requirement.status },
        data: { status: toStatus },
      })
      if (result.count === 0) {
        throw new AppError(
          'CONFLICT',
          '需求状态已被其他人更新，请刷新后重试',
        )
      }
      await tx.statusLog.create({
        data: {
          requirementId: id,
          fromStatus,
          toStatus,
          operatorId,
          note: note ?? null,
          isQuickPath,
        },
      })
    })

    // Re-fetch the updated requirement (avoid returning stale data)
    const updated = await db.requirement.findUniqueOrThrow({ where: { id } })

    // Spec: rejected transition sends REJECTED notification to author
    if (toStatus === 'REJECTED') {
      await this.notifyRejected(requirement, operatorId)
    } else {
      await this.notifyTransition(requirement, fromStatus, toStatus, operatorId)
    }

    await this.broadcastUpdated(id, requirement.project.id, 'status')

    return updated
  }

  private async notifyRejected(
    requirement: {
      id: string
      number: number
      title: string
      authorId: string
      project: { slug: string }
    },
    operatorId: string,
  ) {
    const link = requirementLink(requirement.project.slug, requirement.number)
    if (requirement.authorId !== operatorId) {
      await notificationService.createMany([
        {
          userId: requirement.authorId,
          type: 'REJECTED',
          title: `需求 #${requirement.number} 被驳回`,
          body: requirement.title,
          link,
        },
      ])
    }
  }

  private async notifyTransition(
    requirement: {
      id: string
      number: number
      title: string
      authorId: string
      assigneeId: string | null
      status: string
      project: { slug: string }
    },
    fromStatus: ReqStatus,
    toStatus: ReqStatus,
    operatorId: string,
  ) {
    // Spec: STATUS_CHANGE recipients = author + assignee only
    const notified = new Set<string>()
    const targets = []
    const link = requirementLink(requirement.project.slug, requirement.number)

    if (requirement.authorId !== operatorId) {
      notified.add(requirement.authorId)
      targets.push({
        userId: requirement.authorId,
        type: 'STATUS_CHANGE' as const,
        title: `需求 #${requirement.number} 状态变更`,
        body: `${statusLabel(fromStatus)} → ${statusLabel(toStatus)}：${requirement.title}`,
        link,
      })
    }

    if (requirement.assigneeId && requirement.assigneeId !== operatorId && !notified.has(requirement.assigneeId)) {
      notified.add(requirement.assigneeId)
      targets.push({
        userId: requirement.assigneeId,
        type: 'STATUS_CHANGE' as const,
        title: `指派给你的需求 #${requirement.number} 状态变更`,
        body: `${statusLabel(fromStatus)} → ${statusLabel(toStatus)}`,
        link,
      })
    }

    await notificationService.createMany(targets)
  }
}

export const requirementService = new RequirementService()
