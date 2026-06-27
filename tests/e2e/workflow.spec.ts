import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/projects')
}

test('standard IPD path: submit → review → plan → dev → test → deliver → accept', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')

  await page.goto('/projects/internal-portal')
  await page.fill('input[placeholder*="标题"]', 'E2E standard path')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects\/internal-portal\/requirements\/.+/)

  const detailText = await page.textContent('h1')
  expect(detailText).toContain('E2E standard path')

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("评审中")')
  await page.waitForFunction(() => document.body.textContent?.includes('评审中'))

  await page.click('button:has-text("已规划")')
  await page.waitForFunction(() => document.body.textContent?.includes('已规划'))

  await login(page, 'dev@easyreq.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("开发中")')
  await page.waitForFunction(() => document.body.textContent?.includes('开发中'))

  await page.click('button:has-text("测试中")')
  await page.waitForFunction(() => document.body.textContent?.includes('测试中'))

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("已交付")')
  await page.waitForFunction(() => document.body.textContent?.includes('已交付'))

  await login(page, 'submitter@company.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("已验收")')
  await page.waitForFunction(() => document.body.textContent?.includes('已验收'))
})

test('quick path: submit → directly develop → deliver → accept', async ({ page }) => {
  await login(page, 'submitter@company.dev', 'password123')

  await page.goto('/projects/internal-portal')
  await page.fill('input[placeholder*="标题"]', 'E2E quick path')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/projects\/internal-portal\/requirements\/.+/)

  await login(page, 'manager@easyreq.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("开发中")')
  await page.waitForFunction(() => document.body.textContent?.includes('开发中'))

  await page.click('button:has-text("已交付")')
  await page.waitForFunction(() => document.body.textContent?.includes('已交付'))

  await login(page, 'submitter@company.dev', 'password123')
  await page.reload()

  await page.click('button:has-text("已验收")')
  await page.waitForFunction(() => document.body.textContent?.includes('已验收'))
})
