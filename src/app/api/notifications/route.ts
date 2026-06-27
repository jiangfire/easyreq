import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { AppError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  try {
    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true'
    const [notifications, unreadCount] = await Promise.all([
      unreadOnly ? notificationService.listUnread(user.id) : notificationService.listAll(user.id),
      notificationService.countUnread(user.id),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  try {
    const body = await request.json()
    await notificationService.markAsRead(user.id, body.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
