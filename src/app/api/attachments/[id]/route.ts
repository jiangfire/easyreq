import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { attachmentService } from '@/services/attachment.service'
import { createStorageProvider } from '@/lib/storage'
import { AppError } from '@/lib/errors'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const attachment = await attachmentService.getById(id, user.id)

    const providerName = attachment.storageProvider === 'S3' ? 's3' : 'local'
    const provider = createStorageProvider(providerName)
    const target = await provider.download(attachment.storageKey)

    if (target.type === 'redirect') {
      return NextResponse.redirect(target.url, { status: 302 })
    }

    return new NextResponse(new Uint8Array(target.body), {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Length': String(target.body.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
      },
    })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    await attachmentService.delete(id, user.id, user.role)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
