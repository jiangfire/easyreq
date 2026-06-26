import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { requirementService } from '@/services/requirement.service'
import { createRequirementSchema } from '@/lib/validation/requirement'
import { AppError } from '@/lib/errors'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { slug } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)

    const body = await request.json()
    const result = createRequirementSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
        { status: 422 },
      )
    }

    const requirement = await requirementService.create(project.id, user.id, result.data)
    return NextResponse.json(requirement, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
