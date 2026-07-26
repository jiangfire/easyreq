import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  useRunAfterProductionCompileHook: true,
}

export default sentryConfig.org && sentryConfig.project
  ? withSentryConfig(nextConfig, sentryConfig)
  : nextConfig
