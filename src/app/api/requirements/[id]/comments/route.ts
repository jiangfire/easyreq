import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { commentService } from '@/services/comment.service'
import { createCommentSchema } from '@/lib/validation/comment'
import { AppError } from '@/lib/errors'
import { parsePagination } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { id } = await ctx.params
  const { page, pageSize } = parsePagination(request.nextUrl.searchParams)

  try {
    const result = await commentService.list(id, user.id, { page, pageSize })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}

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
  const result = createCommentSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    const comment = await commentService.create(id, user.id, result.data.body)
    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
