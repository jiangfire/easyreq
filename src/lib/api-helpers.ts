import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import { Prisma } from '@/generated/prisma/client'

/**
 * Wrap a Route Handler so AppError → JSON envelope, Prisma known errors →
 * AppError, and unexpected errors → a generic 500 (without leaking internals).
 * Keeps every route focused on logic instead of repeating try/catch boilerplate.
 */
export function apiHandler<TArgs extends unknown[]>(
  fn: (request: NextRequest, ...args: TArgs) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    ...args: TArgs
  ): Promise<NextResponse> => {
    try {
      return await fn(request, ...args)
    } catch (error) {
      const appError = toAppError(error)
      return NextResponse.json(appError.toJSON(), { status: appError.statusCode })
    }
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Common codes: P2002 unique constraint, P2025 record not found.
    if (error.code === 'P2002') return new AppError('CONFLICT', '资源已存在')
    if (error.code === 'P2025') return new AppError('NOT_FOUND', '资源不存在')
    return new AppError('VALIDATION_ERROR', '数据校验失败')
  }
  // Don't leak internal error details to clients.
  return new AppError('VALIDATION_ERROR', '请求处理失败')
}

export type Pagination = { page: number; pageSize: number }

/**
 * Parse and clamp pagination query params. Rejects non-numeric input (which
 * previously produced NaN → 500) and caps pageSize to prevent DoS.
 */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = searchParams.get('page')
  const rawPageSize = searchParams.get('pageSize')
  const page = rawPage === null ? 1 : Math.max(1, Math.floor(Number(rawPage)))
  const requested = rawPageSize === null ? 25 : Math.floor(Number(rawPageSize))
  const pageSize = Number.isFinite(requested) && requested > 0
    ? Math.min(Math.max(requested, 1), 100)
    : 25
  return {
    page: Number.isFinite(page) ? page : 1,
    pageSize,
  }
}
