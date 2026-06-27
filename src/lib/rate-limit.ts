/**
 * Simple in-memory rate limiter using a sliding-window counter.
 * Suitable for single-instance deployments (MVP). For multi-instance,
 * replace with Redis-backed implementation.
 */

type Bucket = {
  count: number
  resetAt: number
}

const DEFAULT_WINDOW_MS = 60 * 1000 // 1 minute
const DEFAULT_MAX = 10 // 10 attempts per window

const buckets = new Map<string, Bucket>()

// Periodically purge expired buckets to avoid memory growth
const PURGE_INTERVAL_MS = 5 * 60 * 1000
let lastPurge = Date.now()

function purge() {
  const now = Date.now()
  if (now - lastPurge < PURGE_INTERVAL_MS) return
  lastPurge = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  key: string,
  options: { max?: number; windowMs?: number } = {},
): RateLimitResult {
  purge()
  const max = options.max ?? DEFAULT_MAX
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const now = Date.now()

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: max - 1, resetAt }
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { allowed: true, remaining: max - existing.count, resetAt: existing.resetAt }
}

/**
 * Reset the counter for a key (e.g. after a successful login).
 */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}
