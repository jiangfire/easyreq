import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/projects')
}

async function createRequirement(page: Page, title: string): Promise<string> {
  await page.goto('/projects/internal-portal')
  await page.fill('input[placeholder*="标题"]', title)
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects\/internal-portal\/requirements\/.+/)
  return page.url()
}

test('submitter cannot review requirements', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')
  const reqUrl = await createRequirement(page, 'Permission review test')

  await login(page, 'submitter@company.dev', 'password123')
  await page.goto(reqUrl)

  const buttons = await page.locator('button').allInnerTexts()
  expect(buttons.some((b) => b.includes('评审中'))).toBe(false)
})

test('developer cannot accept deliverables', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')
  const reqUrl = await createRequirement(page, 'Permission accept test')

  await login(page, 'dev@easyreq.dev', 'password123')
  await page.goto(reqUrl)

  const buttons = await page.locator('button').allInnerTexts()
  expect(buttons.some((b) => b.includes('已验收'))).toBe(false)
})

test('manager can access admin review queue', async ({ page }) => {
  await login(page, 'manager@easyreq.dev', 'password123')
  await page.goto('/admin/review')
  await expect(page.locator('h1')).toContainText('评审队列')
})

test('submitter is redirected from admin', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')
  await page.goto('/admin')
  await page.waitForURL('/dashboard')
})
