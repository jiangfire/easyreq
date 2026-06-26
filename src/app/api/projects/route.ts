import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { projectService } from '@/services/project.service'
import { createProjectSchema } from '@/lib/validation/project'
import { AppError } from '@/lib/errors'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const projects = await projectService.listForUser(user.id)
  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权创建项目' } }, { status: 403 })
  }

  const body = await request.json()
  const result = createProjectSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    const project = await projectService.create(result.data, user.id)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
