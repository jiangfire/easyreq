import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { requirementService } from '@/services/requirement.service'
import { AppError } from '@/lib/errors'
import { z } from 'zod'

const assignProjectSchema = z.object({
  projectId: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const body = await request.json()
    const result = assignProjectSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
        { status: 422 },
      )
    }

    const updated = await requirementService.assignToProject(
      id,
      result.data.projectId,
      user.id,
      user.role,
    )
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
