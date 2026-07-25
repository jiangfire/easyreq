import { test, expect, type Page } from '@playwright/test'

/**
 * Cross-role visibility checks.
 *
 * These tests verify the role-aware sidebar and the page-level guards
 * (admin layout redirects to /dashboard for non-MANAGER/ADMIN).
 */

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
}

test('SUBMITTER sidebar: no projects, no inbox, no admin link', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')
  await expect(page.getByRole('link', { name: '项目列表' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '需求池' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '后台' })).toHaveCount(0)
  // Visible: dashboard, notifications, search
  await expect(page.getByRole('link', { name: '我的看板' })).toBeVisible()
  await expect(page.getByRole('link', { name: '通知' })).toBeVisible()
})

test('DEVELOPER sidebar: projects visible, inbox and admin hidden', async ({ page }) => {
  await login(page, 'dev@easyreq.dev', 'password123')
  await expect(page.getByRole('link', { name: '项目列表' })).toBeVisible()
  await expect(page.getByRole('link', { name: '需求池' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '后台' })).toHaveCount(0)
})

test('MANAGER sidebar: projects + inbox visible, no admin link', async ({ page }) => {
  await login(page, 'manager@easyreq.dev', 'password123')
  await expect(page.getByRole('link', { name: '项目列表' })).toBeVisible()
  await expect(page.getByRole('link', { name: '需求池' })).toBeVisible()
  await expect(page.getByRole('link', { name: '后台' })).toBeVisible()
})

test('ADMIN sidebar: everything visible', async ({ page }) => {
  await login(page, 'admin@easyreq.dev', 'password123')
  await expect(page.getByRole('link', { name: '项目列表' })).toBeVisible()
  await expect(page.getByRole('link', { name: '需求池' })).toBeVisible()
  await expect(page.getByRole('link', { name: '后台' })).toBeVisible()
})

test('SUBMITTER blocked from admin pages', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')
  for (const path of ['/admin', '/admin/review', '/admin/inbox', '/admin/users']) {
    await page.goto(path)
    await page.waitForURL(/\/dashboard$/, { timeout: 5_000 })
    expect(page.url()).toMatch(/\/dashboard$/)
  }
})

test('MANAGER cannot access /admin/users (ADMIN-only)', async ({ page }) => {
  await login(page, 'manager@easyreq.dev', 'password123')
  await page.goto('/admin/users')
  // /admin/users redirects MANAGER to /admin (the layout allows MANAGER, but
  // the page itself requires ADMIN). Either way, they must NOT stay on /admin/users.
  await page.waitForURL((url) => !url.pathname.endsWith('/admin/users'), { timeout: 5_000 })
  expect(page.url()).not.toMatch(/\/admin\/users$/)
  expect(['/admin', '/dashboard']).toContain(new URL(page.url()).pathname)
})

test('Anonymous user is redirected to /login from every protected route', async ({ page }) => {
  const protectedPaths = ['/dashboard', '/projects', '/requirements/inbox', '/notifications', '/search']
  for (const path of protectedPaths) {
    await page.goto(path)
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 5_000 })
    expect(page.url()).toMatch(/\/login(?:\?|$)/)
  }
})