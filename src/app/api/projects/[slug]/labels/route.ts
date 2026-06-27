import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { labelService } from '@/services/label.service'
import { AppError } from '@/lib/errors'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { slug } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)
    const labels = await labelService.list(project.id)
    return NextResponse.json(labels)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const { slug } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)
    const body = await request.json()
    const label = await labelService.create(
      project.id,
      body?.name,
      body?.color,
      user.id,
      user.role,
    )
    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
