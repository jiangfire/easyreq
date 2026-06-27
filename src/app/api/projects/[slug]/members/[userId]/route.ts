import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { AppError } from '@/lib/errors'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string; userId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { slug, userId } = await ctx.params

  try {
    const project = await projectService.getBySlug(slug, user.id)
    await projectService.removeMember(project.id, userId, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
