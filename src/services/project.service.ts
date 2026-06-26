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

  async create(input: CreateProjectInput, creatorId: string) {
    const existing = await db.project.findUnique({
      where: { slug: input.slug },
    })
    if (existing) {
      throw new AppError('CONFLICT', '项目标识已存在')
    }

    return db.project.create({
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
  }

  async addMember(projectId: string, userId: string, requesterId: string) {
    const membership = await db.projectMember.findUnique({
      where: { userId_projectId: { userId: requesterId, projectId } },
    })

    if (!membership || membership.role !== 'OWNER') {
      throw new AppError('FORBIDDEN', '只有项目 OWNER 可以添加成员')
    }

    return db.projectMember.create({
      data: { userId, projectId, role: 'MEMBER' },
    })
  }
}

export const projectService = new ProjectService()
