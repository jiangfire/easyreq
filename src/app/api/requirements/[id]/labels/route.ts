import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { labelService } from '@/services/label.service'
import { z } from 'zod'
import { AppError } from '@/lib/errors'

const addLabelSchema = z.object({
  labelId: z.string().min(1, '请选择标签'),
})

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
  const result = addLabelSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    const label = await labelService.addToRequirement(id, result.data.labelId, user.id)
    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
