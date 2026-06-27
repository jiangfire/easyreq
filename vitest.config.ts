import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import path from 'path'

// Force integration tests onto an isolated test database so `npm test` can
// never wipe the dev/prod database. Derive the test DSN from DATABASE_URL by
// appending "_test" to the database name, unless DATABASE_TEST_URL overrides.
//
// Example: postgresql://u:p@h:5432/easyreqdb  ->  .../easyreqdb_test
function resolveTestDatabaseUrl(): string {
  if (process.env.DATABASE_TEST_URL) return process.env.DATABASE_TEST_URL
  const base = process.env.DATABASE_URL
  if (!base) {
    throw new Error(
      'DATABASE_URL is not set. Provide DATABASE_TEST_URL or DATABASE_URL before running tests.',
    )
  }
  // Inject "_test" before the first query param or end of string, into the path.
  return base.replace(/(\/[^/?]+)(\?.*)?$/, '$1_test$2')
}

process.env.DATABASE_URL = resolveTestDatabaseUrl()

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.ts'],
  },
})
