import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getSlowQueryThreshold, isSlowQuery } from '@/lib/observability/slow-query'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const slowQueryThreshold = getSlowQueryThreshold(process.env.PRISMA_SLOW_QUERY_MS)
  const client = new PrismaClient({
    adapter,
    log: slowQueryThreshold !== null
      ? ['error', { emit: 'event' as const, level: 'query' as const }]
      : process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

  if (slowQueryThreshold !== null) {
    client.$on('query', (event) => {
      if (isSlowQuery(event.duration, slowQueryThreshold)) {
        console.warn(JSON.stringify({
          event: 'slow_query',
          durationMs: event.duration,
          target: event.target,
          query: event.query,
        }))
      }
    })
  }

  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
