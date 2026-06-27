import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/services/auth.service'
import { searchService } from '@/services/search.service'
import { parsePagination } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未登录' } }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q') ?? ''
  const pagination = parsePagination(request.nextUrl.searchParams)
  const result = await searchService.searchRequirements(user.id, q, pagination)
  return NextResponse.json(result)
}
