import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const target = new URL('/api/sse', request.nextUrl)
  return NextResponse.redirect(target, { status: 308 })
}
