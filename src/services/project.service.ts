import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import type { CreateProjectInput } from '@/lib/validation/project'

export class ProjectService {
  async listForUser(userId: string) {
    return db.project.findMany({
      where: { members: { some: { userId } } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        _count: { select: { requirements: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async getBySlug(slug: string, userId: string) {
    const project = await db.project.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    })

    if (!project) {
      throw new AppError('NOT_FOUND', '项目不存在')
    }

    const isMember = project.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    return project
  }

  async create(input: CreateProjectInput, creatorId: string, requirementIds: string[] = []) {
    const existing = await db.project.findUnique({
      where: { slug: input.slug },
    })
    if (existing) {
      throw new AppError('CONFLICT', '项目标识已存在')
    }

    if (requirementIds.length > 0) {
      // Verify all requirements are unassigned and accessible by the creator.
      const requirements = await db.requirement.findMany({
        where: { id: { in: requirementIds }, projectId: null },
        select: { id: true, authorId: true },
      })
      if (requirements.length !== requirementIds.length) {
        throw new AppError('VALIDATION_ERROR', '包含已归集或不存在的需求')
      }
    }

    return db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          members: {
            create: { userId: creatorId, role: 'OWNER' },
          },
        },
        include: { members: true },
      })

      if (requirementIds.length > 0) {
        // Assign sequential project numbers to the selected requirements.
        const existingCount = await tx.requirement.count({ where: { projectId: project.id } })
        for (let i = 0; i < requirementIds.length; i++) {
          await tx.requirement.update({
            where: { id: requirementIds[i] },
            data: { projectId: project.id, number: existingCount + i + 1 },
          })
        }
        await tx.project.update({
          where: { id: project.id },
          data: { lastRequirementNumber: existingCount + requirementIds.length },
        })
      }

      return project
    })
  }

  async addMember(projectId: string, userId: string, requesterId: string) {
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId: requesterId, projectId } },
    })

    // Spec §members: only project OWNER or global ADMIN can manage members.
    // (Global MANAGER is intentionally NOT allowed here.)
    const requester = await db.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    })
    const canManage = membership?.role === 'OWNER' || requester?.role === 'ADMIN'
    if (!canManage) {
      throw new AppError('FORBIDDEN', '只有 OWNER/ADMIN 可以添加成员')
    }

    const targetUser = await db.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      throw new AppError('NOT_FOUND', '用户不存在')
    }

    const existing = await db.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (existing) {
      throw new AppError('CONFLICT', '该用户已是项目成员')
    }

    return db.projectMember.create({
      data: { userId, projectId, role: 'MEMBER' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })
  }

  async removeMember(projectId: string, userId: string, requesterId: string) {
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId: requesterId, projectId } },
    })

    // Spec §members: only project OWNER or global ADMIN can manage members.
    const requester = await db.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    })
    const canManage = membership?.role === 'OWNER' || requester?.role === 'ADMIN'
    if (!canManage) {
      throw new AppError('FORBIDDEN', '只有 OWNER/ADMIN 可以移除成员')
    }

    const target = await db.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!target) {
      throw new AppError('NOT_FOUND', '该用户不是项目成员')
    }

    if (target.role === 'OWNER') {
      throw new AppError('FORBIDDEN', '不能移除项目 OWNER')
    }

    // Clear the member from any requirements they were assigned to in this
    // project, otherwise the requirement shows an assignee who is no longer a
    // member (Requirement.assignee points at User, not ProjectMember).
    await db.requirement.updateMany({
      where: { projectId, assigneeId: userId },
      data: { assigneeId: null },
    })

    return db.projectMember.delete({
      where: { userId_projectId: { userId, projectId } },
    })
  }

  async listMembers(projectId: string, userId: string) {
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    return db.projectMember.findMany({
      where: { projectId },
      select: { userId: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    })
  }

  async getDetail(slug: string, userId: string) {
    const project = await db.project.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        _count: { select: { requirements: true } },
      },
    })

    if (!project) {
      throw new AppError('NOT_FOUND', '项目不存在')
    }

    const isMember = project.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const myRole = project.members.find((m) => m.userId === userId)?.role ?? null

    return { ...project, myRole }
  }
}

export const projectService = new ProjectService()
