import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/projects')
}

async function transitionTo(page: Page, label: string) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/requirements/') && resp.url().endsWith('/transition'),
    { timeout: 10000 },
  )
  const button = page.locator('button', { hasText: label }).first()
  await button.click()

  // IN_DEVELOPMENT and REJECTED open a note dialog
  if (label === '开发中' || label === '已驳回') {
    await page.locator('button:has-text("确认")').click()
  }

  await responsePromise
}

async function expectStatus(page: Page, label: string) {
  await page.waitForFunction((statusLabel) => document.body.textContent?.includes(statusLabel), label)
}

test('standard IPD path: submit → review → plan → dev → test → deliver → accept', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')

  await page.goto('/projects/internal-portal')
  await page.fill('input[placeholder*="标题"]', 'E2E standard path')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects\/internal-portal\/requirements\/.+/)

  const detailText = await page.textContent('h1')
  expect(detailText).toContain('E2E standard path')
  const reqUrl = page.url()

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '评审中')
  await expectStatus(page, '评审中')

  await transitionTo(page, '已规划')
  await expectStatus(page, '已规划')

  await login(page, 'dev@easyreq.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '开发中')
  await expectStatus(page, '开发中')

  await transitionTo(page, '测试中')
  await expectStatus(page, '测试中')

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '已交付')
  await expectStatus(page, '已交付')

  await login(page, 'submitter@company.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '已验收')
  await expectStatus(page, '已验收')
})

test('quick path: submit → directly develop → deliver → accept', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')

  await page.goto('/projects/internal-portal')
  await page.fill('input[placeholder*="标题"]', 'E2E quick path')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects\/internal-portal\/requirements\/.+/)

  const reqUrl = page.url()

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '开发中')
  await expectStatus(page, '开发中')

  await transitionTo(page, '已交付')
  await expectStatus(page, '已交付')

  await login(page, 'submitter@company.dev', 'password123')
  await page.goto(reqUrl)

  await transitionTo(page, '已验收')
  await expectStatus(page, '已验收')
})
