import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimit('test:*')
  })

  it('allows up to max requests within the window', () => {
    resetRateLimit('login:a@b.com')
    expect(rateLimit('login:a@b.com', { max: 3, windowMs: 1000 }).allowed).toBe(true)
    expect(rateLimit('login:a@b.com', { max: 3, windowMs: 1000 }).allowed).toBe(true)
    expect(rateLimit('login:a@b.com', { max: 3, windowMs: 1000 }).allowed).toBe(true)
  })

  it('blocks requests exceeding max within the window', () => {
    resetRateLimit('login:blocked@test.dev')
    const opts = { max: 2, windowMs: 5000 }
    rateLimit('login:blocked@test.dev', opts)
    rateLimit('login:blocked@test.dev', opts)
    const result = rateLimit('login:blocked@test.dev', opts)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('tracks keys independently', () => {
    resetRateLimit('login:user1@test.dev')
    resetRateLimit('login:user2@test.dev')
    const opts = { max: 1, windowMs: 5000 }
    expect(rateLimit('login:user1@test.dev', opts).allowed).toBe(true)
    expect(rateLimit('login:user2@test.dev', opts).allowed).toBe(true)
    expect(rateLimit('login:user1@test.dev', opts).allowed).toBe(false)
    expect(rateLimit('login:user2@test.dev', opts).allowed).toBe(false)
  })

  it('resets after the window elapses', async () => {
    resetRateLimit('login:window@test.dev')
    const opts = { max: 1, windowMs: 50 }
    expect(rateLimit('login:window@test.dev', opts).allowed).toBe(true)
    expect(rateLimit('login:window@test.dev', opts).allowed).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(rateLimit('login:window@test.dev', opts).allowed).toBe(true)
  })

  it('resetRateLimit clears the bucket', () => {
    resetRateLimit('login:reset@test.dev')
    const opts = { max: 1, windowMs: 5000 }
    expect(rateLimit('login:reset@test.dev', opts).allowed).toBe(true)
    expect(rateLimit('login:reset@test.dev', opts).allowed).toBe(false)
    resetRateLimit('login:reset@test.dev')
    expect(rateLimit('login:reset@test.dev', opts).allowed).toBe(true)
  })
})
