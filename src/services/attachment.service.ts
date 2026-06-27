import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'
import { createStorageProvider } from '@/lib/storage'
import type { StorageProvider } from '@/lib/storage/types'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/zip',
])

const MAX_FILE_SIZE = Number(process.env.STORAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default

export class AttachmentService {
  private storage: StorageProvider

  constructor(storage?: StorageProvider) {
    this.storage = storage ?? createStorageProvider()
  }

  async create(
    requirementId: string,
    uploaderId: string,
    file: {
      buffer: Buffer
      fileName: string
      mimeType: string
      size: number
    },
  ) {
    const requirement = await db.requirement.findUnique({
      where: { id: requirementId },
      select: { projectId: true },
    })
    if (!requirement) {
      throw new AppError('NOT_FOUND', '需求不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId: uploaderId, projectId: requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('VALIDATION_ERROR', '文件大小超过 10MB 限制')
    }

    let isAllowed = false
    if (ALLOWED_MIME_TYPES.has(file.mimeType)) {
      isAllowed = true
    }
    if (!isAllowed) {
      throw new AppError('VALIDATION_ERROR', '不支持的文件类型')
    }

    const providerName = process.env.STORAGE_PROVIDER ?? 'LOCAL'
    const storageKey = await this.storage.upload(file.buffer, {
      fileName: file.fileName,
      mimeType: file.mimeType,
      requirementId,
    })

    const attachment = await db.attachment.create({
      data: {
        requirementId,
        uploaderId,
        fileName: file.fileName,
        fileSize: file.size,
        mimeType: file.mimeType,
        storageKey,
        storageProvider: providerName === 's3' ? 'S3' : 'LOCAL',
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    })

    return {
      ...attachment,
      url: `/api/attachments/${attachment.id}`,
    }
  }

  async list(requirementId: string, userId: string) {
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

    const attachments = await db.attachment.findMany({
      where: { requirementId },
      include: {
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return attachments.map((a) => ({
      ...a,
      url: `/api/attachments/${a.id}`,
    }))
  }

  async delete(attachmentId: string, userId: string, userRole: string) {
    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: { requirement: { select: { projectId: true } } },
    })
    if (!attachment) {
      throw new AppError('NOT_FOUND', '附件不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: attachment.requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    const isAuthor = attachment.uploaderId === userId
    const isManager = userRole === 'MANAGER' || userRole === 'ADMIN'
    if (!isAuthor && !isManager) {
      throw new AppError('FORBIDDEN', '只能删除自己的附件')
    }

    const deleted = await db.attachment.delete({
      where: { id: attachmentId },
    })

    // Delete file from storage AFTER the DB record is removed so a storage
    // failure never leaves a dangling (un-deletable) DB row.
    try {
      await this.storage.delete(attachment.storageKey)
    } catch {
      // File already gone or transient error — record is removed either way.
    }

    return deleted
  }

  async getById(attachmentId: string, userId: string) {
    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
      include: { requirement: { select: { projectId: true } } },
    })
    if (!attachment) {
      throw new AppError('NOT_FOUND', '附件不存在')
    }

    const membership = await db.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId: attachment.requirement.projectId },
      },
    })
    if (!membership) {
      throw new AppError('FORBIDDEN', '你不是该项目成员')
    }

    return attachment
  }
}

export const attachmentService = new AttachmentService()
