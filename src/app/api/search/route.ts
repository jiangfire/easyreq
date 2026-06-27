import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { db } from '@/lib/db'
import { AppError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')?.trim() ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const pageSize = Number(searchParams.get('pageSize') ?? '25')

  if (!q) {
    return NextResponse.json({ data: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } })
  }

  try {
    const projectIds = await db.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    })

    const ids = projectIds.map((p) => p.projectId)

    const where = {
      projectId: { in: ids },
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { body: { contains: q, mode: 'insensitive' as const } },
        { title: { search: q } },
        { body: { search: q } },
      ],
    }

    const [requirements, total] = await Promise.all([
      db.requirement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          project: { select: { slug: true, name: true } },
          _count: { select: { votes: true, comments: { where: { isDeleted: false } } } },
        },
      }),
      db.requirement.count({ where }),
    ])

    return NextResponse.json({
      data: requirements,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }
    throw error
  }
}
