import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { authConfig } from '@/lib/auth.config'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'

const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 10 attempts per 15 minutes per email

export class RateLimitedError extends Error {
  readonly retryAfter: number
  constructor(retryAfter: number) {
    super('RATE_LIMITED')
    this.name = 'RateLimitedError'
    this.retryAfter = retryAfter
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) {
          return null
        }

        // Normalize the email once and use it consistently for both rate
        // limiting and the DB lookup. Otherwise mixed-case variants of the
        // same address would dodge the per-email limiter and could also miss
        // the stored (lowercased) row.
        const lowerEmail = email.trim().toLowerCase()
        const limit = rateLimit(`login:${lowerEmail}`, {
          max: LOGIN_MAX_ATTEMPTS,
          windowMs: LOGIN_WINDOW_MS,
        })
        if (!limit.allowed) {
          const retryAfterSec = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
          throw new RateLimitedError(retryAfterSec)
        }

        const user = await db.user.findUnique({
          where: { email: lowerEmail },
        })

        if (!user) {
          return null
        }

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          return null
        }

        resetRateLimit(`login:${lowerEmail}`)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
})
