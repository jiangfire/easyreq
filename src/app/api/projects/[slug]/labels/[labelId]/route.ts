import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { labelService } from '@/services/label.service'
import { AppError } from '@/lib/errors'

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; labelId: string }> },
) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const { slug, labelId } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)
    const body = await request.json()
    const label = await labelService.update(
      labelId,
      project.id,
      body?.name,
      body?.color,
      user.id,
      user.role,
    )
    return NextResponse.json(label)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; labelId: string }> },
) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const { slug, labelId } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)
    await labelService.delete(labelId, project.id, user.id, user.role)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
