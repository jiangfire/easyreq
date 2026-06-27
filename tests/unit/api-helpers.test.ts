import { describe, it, expect } from 'vitest'
import { parsePagination } from '@/lib/api-helpers'

function sp(obj: Record<string, string>): URLSearchParams {
  return new URLSearchParams(obj)
}

describe('parsePagination', () => {
  it('uses defaults when no params are provided', () => {
    const result = parsePagination(sp({}))
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(25)
  })

  it('clamps non-numeric page to 1 instead of producing NaN', () => {
    const result = parsePagination(sp({ page: 'abc' }))
    expect(result.page).toBe(1)
    expect(Number.isNaN(result.page)).toBe(false)
  })

  it('clamps negative and zero page to 1', () => {
    expect(parsePagination(sp({ page: '0' })).page).toBe(1)
    expect(parsePagination(sp({ page: '-5' })).page).toBe(1)
  })

  it('caps pageSize at 100 to prevent DoS', () => {
    const result = parsePagination(sp({ pageSize: '100000' }))
    expect(result.pageSize).toBe(100)
  })

  it('falls back to default pageSize when the value is invalid', () => {
    expect(parsePagination(sp({ pageSize: 'NaN' })).pageSize).toBe(25)
    expect(parsePagination(sp({ pageSize: '-1' })).pageSize).toBe(25)
  })

  it('passes through valid values', () => {
    const result = parsePagination(sp({ page: '3', pageSize: '10' }))
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(10)
  })
})
