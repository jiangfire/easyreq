import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { requirementService } from '@/services/requirement.service'
import { transitionSchema } from '@/lib/validation/requirement'
import { AppError } from '@/lib/errors'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id } = await ctx.params

  const body = await request.json()
  const result = transitionSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    // Verify access first
    await requirementService.getById(id, user.id)

    const updated = await requirementService.transition(
      id,
      user.id,
      user.role,
      result.data.toStatus,
      result.data.note,
    )
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
