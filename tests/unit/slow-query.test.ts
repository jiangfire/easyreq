import { describe, expect, it } from 'vitest'
import { getSlowQueryThreshold, isSlowQuery } from '@/lib/observability/slow-query'

describe('slow query configuration', () => {
  it('parses a positive integer threshold', () => {
    expect(getSlowQueryThreshold('750')).toBe(750)
  })

  it('disables monitoring for missing or invalid thresholds', () => {
    expect(getSlowQueryThreshold(undefined)).toBeNull()
    expect(getSlowQueryThreshold('')).toBeNull()
    expect(getSlowQueryThreshold('0')).toBeNull()
    expect(getSlowQueryThreshold('not-a-number')).toBeNull()
  })

  it('marks queries at or above the threshold as slow', () => {
    expect(isSlowQuery(749, 750)).toBe(false)
    expect(isSlowQuery(750, 750)).toBe(true)
  })
})
