import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { attachmentService } from '@/services/attachment.service'
import { AppError } from '@/lib/errors'

const MAX_FILE_SIZE = Number(process.env.STORAGE_MAX_FILE_SIZE) || 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const requirementId = formData.get('requirementId')
    const file = formData.get('file')

    if (typeof requirementId !== 'string' || !requirementId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少 requirementId' } },
        { status: 422 },
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '缺少文件' } },
        { status: 422 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '文件大小超过 10MB 限制' } },
        { status: 422 },
      )
    }

    const bytes = await file.arrayBuffer()

    const attachment = await attachmentService.create(requirementId, user.id, {
      buffer: Buffer.from(bytes),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
