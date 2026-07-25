import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { CreateRequirementInput } from '@/lib/validation/requirement'
import type { Priority } from '@/generated/prisma/client'
import {
  notificationService,
  requirementLink,
  statusLabel,
} from '@/services/notification.service'
import { counterService } from '@/services/counter.service'
import {
  canTransition,
  isQuickPathTransition,
  hasTransitionPermission,
  type ReqStatus,
  type Role,
} from '@/lib/transitions'
import { notificationChannel } from '@/lib/notifications/channel'
import { aiProvider } from '@/lib/ai'
import type { AIRequirementInput, AIRequirementCandidate } from '@/lib/ai/types'

export class RequirementService {
  /**
   * Broadcast a `requirement_updated` SSE event.
   * For unassigned requirements, only the author receives it.
   * For assigned requirements, all project members receive it.
   */
  private async broadcastUpdated(requirementId: string, projectId: string | null, authorId: string, field: string) {
    if (!projectId) {
      notificationChannel.publishToUsers([authorId], {
        event: 'requirement_updated',
        data: { id: requirementId, projectId, field },
      })
      return
    }

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
   * Decide the effective priority for a new requirement.
   *
   * If the user picked one explicitly, keep it. Otherwise ask the AI
   * provider (which itself can short-circuit to MEDIUM for the null/heuristic
   * defaults). Never blocks long — if the provider is slow or errors out we
   * keep MEDIUM so submission stays fast.
   */
  private async decidePriority(
    input: AIRequirementInput,
    userChosePriority: boolean,
    userChoice: Priority,
  ): Promise<Priority> {
    if (userChosePriority) return userChoice
    try {
      return await aiProvider.suggestPriority(input)
    } catch {
      return 'MEDIUM'
    }
  }

  /**
   * Fire-and-forget duplicate scan. Notifies the author when high-similarity
   * candidates are found. Errors are swallowed — duplicates are advisory,
   * not blocking.
   */
  private runAIDedupScan(args: {
    requirementId: string
    authorId: string
    projectId: string | null
    title: string
    body: string | null
    priority: Priority
  }): void {
    void (async () => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const candidates = await db.requirement.findMany({
          where: {
            id: { not: args.requirementId },
            authorId: args.authorId,
            createdAt: { gte: since },
            // Scan the same scope: same project (if assigned) plus the author's
            // unassigned submissions to surface cross-project dupes.
            OR: args.projectId
              ? [{ projectId: args.projectId }, { authorId: args.authorId, projectId: null }]
              : [{ projectId: null }],
          },
          select: { id: true, title: true, body: true, globalNumber: true, projectId: true },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })

        if (candidates.length === 0) return

        if (candidates.length === 0) return

        const aiCandidates: AIRequirementCandidate[] = candidates.map((c) => ({
          id: c.id,
          title: c.title,
          body: c.body,
        }))

        const scored = await aiProvider.deduplicate(
          { title: args.title, body: args.body },
          aiCandidates,
        )
        const dupes = scored.filter((s) => s.score >= 0.6).slice(0, 3)
        if (dupes.length === 0) return

        const dupMap = new Map(dupes.map((d) => [d.candidate.id, d]))
        const summary = candidates
          .filter((c) => dupMap.has(c.id))
          .map((c) => {
            const hit = dupMap.get(c.id)!
            return `#${c.globalNumber} "${c.title.slice(0, 60)}" (相似度 ${(hit.score * 100).toFixed(0)}%)`
          })
          .join('\n')

        await notificationService.createMany([
          {
            userId: args.authorId,
            type: 'STATUS_CHANGE',
            title: '可能与历史需求重复',
            body: `AI 检测到你刚提交的需求与以下需求高度相似:\n${summary}\n\n建议合并或在原需求下评论。AI 建议优先级: ${args.priority}`,
            link: `/requirements/${args.requirementId}`,
          },
        ])
      } catch {
        // Dedup is advisory. Never let it bubble up.
      }
    })()
  }

  /**
   * Write audit log entries for each changed field between old and new data.
   * Skips fields whose values haven't changed and labels (tracked differently).
   */
  private async writeAuditDiff(
    requirementId: string,
    operatorId: string,
    before: Record<string, string | null>,
    requested: Record<string, unknown>,
    applied: Record<string, unknown>,
  ) {
    const logs: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = []
    for (const [key, newVal] of Object.entries(applied)) {
      if (key === 'labels') continue
      const oldVal = before[key] ?? null
      const serialized = typeof newVal === 'string' || newVal === null ? newVal : String(newVal)
      if (oldVal !== serialized) {
        logs.push({ fieldName: key, oldValue: oldVal, newValue: serialized })
      }
    }
    if (logs.length === 0) return

    await db.auditLog.createMany({
      data: logs.map((l) => ({
        requirementId,
        operatorId,
        action: 'field_edit',
        fieldName: l.fieldName,
        oldValue: l.oldValue,
        newValue: l.newValue,
      })),
    })
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

    const userChosePriority = input.priority !== undefined
    const priority = await this.decidePriority(
      { title: input.title, body: input.body ?? null },
      userChosePriority,
      input.priority ?? 'MEDIUM',
    )

    const [globalNumber, number] = await Promise.all([
      counterService.getNextRequirementNumber(),
      this.getNextNumber(projectId),
    ])

    const created = await db.requirement.create({
      data: {
        projectId,
        authorId,
        globalNumber,
        number,
        title: input.title,
        body: input.body ?? null,
        priority,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    // Fire-and-forget dedup scan.
    this.runAIDedupScan({
      requirementId: created.id,
      authorId,
      projectId,
      title: input.title,
      body: input.body ?? null,
      priority,
    })

    return created
  }

  async createUnassigned(authorId: string, input: CreateRequirementInput) {
    const userChosePriority = input.priority !== undefined
    const priority = await this.decidePriority(
      { title: input.title, body: input.body ?? null },
      userChosePriority,
      input.priority ?? 'MEDIUM',
    )

    const globalNumber = await counterService.getNextRequirementNumber()

    const created = await db.requirement.create({
      data: {
        projectId: null,
        authorId,
        globalNumber,
        number: null,
        title: input.title,
        body: input.body ?? null,
        priority,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        acceptanceCriteria: input.acceptanceCriteria ?? null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    this.runAIDedupScan({
      requirementId: created.id,
      authorId,
      projectId: null,
      title: input.title,
      body: input.body ?? null,
      priority,
    })

    return created
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
        auditLogs: {
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

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    const userRole = user?.role

    const isAuthor = requirement.authorId === userId
    const isManagerOrAdmin = userRole === 'MANAGER' || userRole === 'ADMIN'
    const isMember = requirement.project?.members.some((m) => m.userId === userId) ?? false

    if (!isAuthor && !isManagerOrAdmin && !isMember) {
      throw new AppError('FORBIDDEN', '你没有权限查看该需求')
    }

    return requirement
  }

  async listUnderReview(_userId: string) {
    return db.requirement.findMany({
      where: { status: 'UNDER_REVIEW' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        globalNumber: true,
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

  async listUnassigned(_userId: string) {
    return db.requirement.findMany({
      where: { projectId: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        globalNumber: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
        _count: { select: { votes: true, comments: { where: { isDeleted: false } } } },
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
        globalNumber: true,
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
          globalNumber: true,
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
        project: {
          select: { id: true, slug: true, members: { select: { userId: true } } },
        },
      },
    })

    const isAuthor = requirement.authorId === userId
    const isManager = userRole === 'MANAGER' || userRole === 'ADMIN'
    const isMember = requirement.project?.members.some((m) => m.userId === userId) ?? false

    if (!isAuthor && !isManager && !isMember) {
      throw new AppError('FORBIDDEN', '你没有权限编辑该需求')
    }

    // Unassigned requirements can only have title/body edited.
    if (!requirement.projectId) {
      const allowedFields = ['title', 'body'] as const
      for (const field of Object.keys(data)) {
        if (!allowedFields.includes(field as typeof allowedFields[number])) {
          throw new AppError('VALIDATION_ERROR', `未归集需求不能修改 ${field}`)
        }
      }

      const updateData: Record<string, unknown> = {}
      if (data.title !== undefined) updateData.title = data.title
      if (data.body !== undefined) updateData.body = data.body

      const updated = await db.requirement.update({
        where: { id },
        data: updateData,
      })

      await this.writeAuditDiff(id, userId, initialValues(requirement), data, updateData)

      await this.broadcastUpdated(id, null, requirement.authorId, 'fields')
      return updated
    }

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
            projectId: requirement.project!.id,
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
          projectId: requirement.project!.id,
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

    await this.writeAuditDiff(id, userId, initialValues(requirement), data, updateData)

    if (data.assigneeId && data.assigneeId !== requirement.assigneeId) {
      await notificationService.createMany([
        {
          userId: data.assigneeId,
          type: 'ASSIGNMENT',
          title: `需求 #${requirement.number ?? requirement.globalNumber} 被指派给你`,
          body: requirement.title,
          link: requirementLink(requirement.project!.slug, requirement.number ?? requirement.globalNumber),
        },
      ])
    }

    await this.broadcastUpdated(id, requirement.projectId, requirement.authorId, 'fields')

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
        project: {
          select: { id: true, slug: true, members: { select: { userId: true } } },
        },
      },
    })

    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    const isManagerOrAdmin = operatorRole === 'MANAGER' || operatorRole === 'ADMIN'
    const isAuthor = requirement.authorId === operatorId
    const isMember = requirement.project?.members.some((m) => m.userId === operatorId) ?? false

    const fromStatus = requirement.status as ReqStatus
    const isQuickPath = isQuickPathTransition(fromStatus, toStatus)

    if (!requirement.projectId) {
      // Unassigned requirements: only author (resubmit) or manager/admin (reject) can transition.
      // These bypass the normal IPD transition matrix because they are not yet in a project.
      if (toStatus === 'SUBMITTED' && !isAuthor && !isManagerOrAdmin) {
        throw new AppError('FORBIDDEN', '你没有权限重新提交该需求')
      }
      if (toStatus === 'REJECTED' && !isManagerOrAdmin) {
        throw new AppError('FORBIDDEN', '只有管理者可驳回未归集需求')
      }
      if (toStatus !== 'SUBMITTED' && toStatus !== 'REJECTED') {
        throw new AppError('INVALID_TRANSITION', '未归集需求只能提交或驳回')
      }
    } else {
      if (!isMember && !isManagerOrAdmin) {
        throw new AppError('FORBIDDEN', '你没有权限操作该需求')
      }

      if (!canTransition(fromStatus, toStatus)) {
        throw new AppError(
          'INVALID_TRANSITION',
          `无法从 ${fromStatus} 转换到 ${toStatus}`,
        )
      }

      if (!hasTransitionPermission(fromStatus, toStatus, operatorRole)) {
        throw new AppError('FORBIDDEN', '你没有执行此操作权限')
      }
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
      await this.notifyRejected(requirement)
    } else {
      await this.notifyTransition(requirement, fromStatus, toStatus, operatorId)
    }

    await this.broadcastUpdated(id, requirement.projectId, requirement.authorId, 'status')

    return updated
  }

  async assignToProject(id: string, projectId: string, operatorId: string, operatorRole: Role) {
    const requirement = await db.requirement.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, slug: true, members: { select: { userId: true } } },
        },
      },
    })

    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    if (requirement.projectId) {
      throw new AppError('VALIDATION_ERROR', '需求已归集到项目')
    }

    if (operatorRole !== 'MANAGER' && operatorRole !== 'ADMIN') {
      throw new AppError('FORBIDDEN', '只有管理者可归集需求')
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, slug: true },
    })
    if (!project) {
      throw new AppError('NOT_FOUND', '项目不存在')
    }

    const number = await this.getNextNumber(projectId)

    const updated = await db.requirement.update({
      where: { id },
      data: {
        projectId,
        number,
      },
      include: {
        project: { select: { slug: true, name: true } },
      },
    })

    await notificationService.createMany([
      {
        userId: requirement.authorId,
        type: 'STATUS_CHANGE',
        title: `需求 #${requirement.globalNumber} 已归集到项目`,
        body: `需求已归集到 ${updated.project?.name ?? '项目'}`,
        link: `/projects/${project.slug}/requirements/${id}`,
      },
    ])

    await this.broadcastUpdated(id, projectId, requirement.authorId, 'project')

    return updated
  }

  private async notifyRejected(
    requirement: {
      id: string
      globalNumber: number
      number: number | null
      title: string
      authorId: string
      project: { slug: string } | null
    },
  ) {
    const link = requirement.project
      ? requirementLink(requirement.project.slug, requirement.number ?? requirement.globalNumber)
      : `/requirements/${requirement.id}`

    await notificationService.createMany([
      {
        userId: requirement.authorId,
        type: 'REJECTED',
        title: `需求 #${requirement.globalNumber} 被驳回`,
        body: requirement.title,
        link,
      },
    ])
  }

  private async notifyTransition(
    requirement: {
      id: string
      globalNumber: number
      number: number | null
      title: string
      authorId: string
      assigneeId: string | null
      status: string
      project: { slug: string } | null
    },
    fromStatus: ReqStatus,
    toStatus: ReqStatus,
    operatorId: string,
  ) {
    // Spec: STATUS_CHANGE recipients = author + assignee only
    const notified = new Set<string>()
    const targets = []
    const link = requirement.project
      ? requirementLink(requirement.project.slug, requirement.number ?? requirement.globalNumber)
      : `/requirements/${requirement.id}`

    if (requirement.authorId !== operatorId) {
      notified.add(requirement.authorId)
      targets.push({
        userId: requirement.authorId,
        type: 'STATUS_CHANGE' as const,
        title: `需求 #${requirement.globalNumber} 状态变更`,
        body: `${statusLabel(fromStatus)} → ${statusLabel(toStatus)}：${requirement.title}`,
        link,
      })
    }

    if (requirement.assigneeId && requirement.assigneeId !== operatorId && !notified.has(requirement.assigneeId)) {
      notified.add(requirement.assigneeId)
      targets.push({
        userId: requirement.assigneeId,
        type: 'STATUS_CHANGE' as const,
        title: `指派给你的需求 #${requirement.globalNumber} 状态变更`,
        body: `${statusLabel(fromStatus)} → ${statusLabel(toStatus)}`,
        link,
      })
    }

    await notificationService.createMany(targets)
  }
}

/**
 * Snapshot the current values of the requirement that the audit logger
 * compares against. This runs *before* the update so we have the old values.
 */
function initialValues(
  r: {
    title: string
    body: string | null
    priority: string
    assigneeId: string | null
    expectedDate: Date | null
    acceptanceCriteria: string | null
  },
): Record<string, string | null> {
  return {
    title: r.title,
    body: r.body,
    priority: r.priority,
    assigneeId: r.assigneeId,
    expectedDate: r.expectedDate?.toISOString() ?? null,
    acceptanceCriteria: r.acceptanceCriteria,
  }
}

export const requirementService = new RequirementService()
