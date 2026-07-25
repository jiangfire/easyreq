import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { parsePagination } from '@/lib/api-helpers'
import type { NotificationType } from '@/generated/prisma/client'
import { z } from 'zod'
import { AppError } from '@/lib/errors'

const VALID_TYPES: NotificationType[] = [
  'STATUS_CHANGE',
  'COMMENT',
  'VOTE_MILESTONE',
  'ASSIGNMENT',
  'REJECTED',
]

const deleteSchema = z.object({
  mode: z.enum(['all', 'read']).default('read'),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { page, pageSize } = parsePagination(request.nextUrl.searchParams)
  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true'
  const typesParam = request.nextUrl.searchParams.get('types')
  const types = typesParam
    ? (typesParam
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is NotificationType => VALID_TYPES.includes(t as NotificationType)))
    : undefined

  const [result, unreadCount] = await Promise.all([
    notificationService.list(user.id, { unreadOnly, page, pageSize, types }),
    notificationService.countUnread(user.id),
  ])

  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
    unreadCount,
  })
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  let body: z.infer<typeof deleteSchema> = { mode: 'read' }
  try {
    const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})))
    if (parsed.success) body = parsed.data
  } catch {
    // body parsing failed — fall back to defaults
  }

  try {
    const result = await notificationService.deleteMany(user.id, { mode: body.mode })
    return NextResponse.json({ success: true, deletedCount: result.count })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
