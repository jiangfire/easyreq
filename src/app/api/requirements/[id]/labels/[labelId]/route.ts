import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { labelService } from '@/services/label.service'
import { AppError } from '@/lib/errors'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; labelId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id, labelId } = await ctx.params

  try {
    await labelService.removeFromRequirement(id, labelId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
