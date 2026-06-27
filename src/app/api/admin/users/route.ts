import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { db } from '@/lib/db'
import { userService } from '@/services/user.service'
import { z } from 'zod'
import { AppError } from '@/lib/errors'

const createUserSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  name: z.string().min(1, '请输入姓名').max(50),
  password: z.string().min(8, '密码至少 8 位').max(128),
  role: z.enum(['SUBMITTER', 'MANAGER', 'DEVELOPER', 'ADMIN']),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: { requirements: true, comments: true },
      },
    },
  })

  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
  }

  const body = await request.json()
  const result = createUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: '输入有误', details: result.error.flatten() } },
      { status: 422 },
    )
  }

  try {
    const created = await userService.create(result.data)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
