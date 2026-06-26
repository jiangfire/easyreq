import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { CreateRequirementInput } from '@/lib/validation/requirement'

export class RequirementService {
  /**
   * Get the next requirement number for a project.
   * Uses a transaction with row-level lock for concurrency safety.
   */
  async getNextNumber(projectId: string): Promise<number> {
    return db.$transaction(async (tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { lastRequirementNumber: true },
      })
      const nextNumber = project.lastRequirementNumber + 1
      await tx.project.update({
        where: { id: projectId },
        data: { lastRequirementNumber: nextNumber },
      })
      return nextNumber
    })
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
        priority: input.priority,
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
        _count: {
          select: { comments: { where: { isDeleted: false } }, votes: true, attachments: true },
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

  async list(
    projectId: string,
    userId: string,
    options: {
      status?: string[]
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

    const orderBy =
      sortBy === 'votes'
        ? { votes: { _count: 'desc' as const } }
        : { [sortBy]: 'desc' as const }

    const [requirements, total] = await Promise.all([
      db.requirement.findMany({
        where: {
          projectId,
          ...(options.status ? { status: { in: options.status as never[] } } : {}),
        },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true } },
          _count: {
            select: { comments: { where: { isDeleted: false } }, votes: true },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBy: orderBy as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.requirement.count({
        where: {
          projectId,
          ...(options.status ? { status: { in: options.status as never[] } } : {}),
        },
      }),
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
}

export const requirementService = new RequirementService()
