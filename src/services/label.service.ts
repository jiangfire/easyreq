import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'

export class LabelService {
  async list(projectId: string) {
    return db.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })
  }

  async create(projectId: string, name: string, color: string) {
    const normalized = name.trim().toLowerCase()
    if (!normalized) {
      throw new AppError('VALIDATION_ERROR', '标签名称不能为空')
    }

    const existing = await db.label.findUnique({
      where: { projectId_name: { projectId, name: normalized } },
    })
    if (existing) {
      throw new AppError('CONFLICT', '标签已存在')
    }

    return db.label.create({
      data: {
        projectId,
        name: normalized,
        color: color.startsWith('#') ? color : `#${color}`,
      },
    })
  }

  async update(labelId: string, projectId: string, name: string, color: string) {
    const normalized = name.trim().toLowerCase()
    if (!normalized) {
      throw new AppError('VALIDATION_ERROR', '标签名称不能为空')
    }

    return db.label.update({
      where: { id: labelId, projectId },
      data: {
        name: normalized,
        color: color.startsWith('#') ? color : `#${color}`,
      },
    })
  }

  async delete(labelId: string, projectId: string) {
    return db.label.delete({
      where: { id: labelId, projectId },
    })
  }

  async deleteStandalone(labelId: string, userId: string, userRole: string) {
    const label = await db.label.findUnique({
      where: { id: labelId },
      include: { project: { select: { members: { select: { userId: true } } } } },
    })
    if (!label) {
      throw new AppError('NOT_FOUND', '标签不存在')
    }

    const isMember = label.project.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const isManager = userRole === 'MANAGER' || userRole === 'ADMIN'
    if (!isManager) {
      throw new AppError('FORBIDDEN', '只有管理者可删除标签')
    }

    return db.label.delete({ where: { id: labelId } })
  }

  async addToRequirement(requirementId: string, labelId: string, userId: string) {
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

    const label = await db.label.findUnique({
      where: { id: labelId, projectId: requirement.projectId },
    })
    if (!label) {
      throw new AppError('NOT_FOUND', '标签不存在')
    }

    return db.requirementLabel
      .upsert({
        where: {
          requirementId_labelId: { requirementId, labelId },
        },
        create: { requirementId, labelId },
        update: {},
        include: { label: { select: { id: true, name: true, color: true } } },
      })
      .then((rl) => rl.label)
  }

  async removeFromRequirement(requirementId: string, labelId: string, userId: string) {
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

    try {
      await db.requirementLabel.delete({
        where: { requirementId_labelId: { requirementId, labelId } },
      })
    } catch {
      // Already removed — idempotent
    }

    return { success: true }
  }
}

export const labelService = new LabelService()
