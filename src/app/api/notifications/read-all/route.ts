import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { notificationService } from '@/services/notification.service'
import { AppError } from '@/lib/errors'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  try {
    await notificationService.markAllRead(user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
