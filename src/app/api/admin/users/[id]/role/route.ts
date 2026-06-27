import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { userService } from '@/services/user.service'
import { z } from 'zod'
import { AppError } from '@/lib/errors'

const updateRoleSchema = z.object({
  role: z.enum(['SUBMITTER', 'MANAGER', 'DEVELOPER', 'ADMIN']),
})

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const result = updateRoleSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '无效的角色', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    const updated = await userService.updateRole(id, result.data.role)

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
