import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { parsePagination } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { page, pageSize } = parsePagination(request.nextUrl.searchParams)
  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true'

  const [result, unreadCount] = await Promise.all([
    notificationService.list(user.id, { unreadOnly, page, pageSize }),
    notificationService.countUnread(user.id),
  ])

  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
    unreadCount,
  })
}
