import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config.
 *
 * - Base URL: localhost:3000 (override with PLAYWRIGHT_BASE_URL)
 * - Web server: spins up `npm run dev` automatically; reuses an existing server
 *   outside CI so local iteration is fast.
 * - Browser: bundled chromium-headless-shell. Pass `PLAYWRIGHT_BROWSERS_PATH`
 *   to override the cache dir.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
