import { test, expect, type Page } from '@playwright/test'

/**
 * MANAGER end-to-end intake flow:
 *   1. SUBMITTER submits an unassigned requirement via API
 *   2. MANAGER creates a new project and batch-assigns the requirement
 *   3. MANAGER adds a DEVELOPER and the SUBMITTER as project members
 *   4. MANAGER walks the requirement through the full IPD flow
 *   5. DEVELOPER finishes development + testing
 *   6. SUBMITTER accepts
 *
 * Validates: unassigned → assigned transition, project creation with
 * requirementIds, project-scoped numbering (#1), full state matrix
 * including cross-role transitions.
 */

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.endsWith('/login'))
}

async function expectStatusOnPage(page: Page, label: string) {
  await page.waitForFunction(
    (l) => document.body.textContent?.includes(l),
    label,
    { timeout: 10_000 },
  )
}

async function transitionTo(page: Page, label: string) {
  const resp = page.waitForResponse(
    (r) => r.url().includes('/api/requirements/') && r.url().endsWith('/transition'),
    { timeout: 10_000 },
  )
  await page.getByRole('button', { name: label }).first().click()
  // IN_DEVELOPMENT and REJECTED may prompt for a note — confirm if present.
  const confirmButton = page.getByRole('button', { name: '确认' })
  if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmButton.click()
  }
  await resp
}

test('MANAGER intake flow: create project + assign → IPD walk to ACCEPTED', async ({ page, context }) => {
  const stamp = Date.now()
  const requirementTitle = `E2E manager intake ${stamp}`
  const projectName = `E2E Intake ${stamp}`
  const projectSlug = `e2e-intake-${stamp}`

  // Step 1: SUBMITTER submits an unassigned requirement via API (faster + deterministic).
  const submitterCtx = await context.browser()!.newContext()
  const submitter = await submitterCtx.newPage()
  await login(submitter, 'submitter@company.dev', 'password123')
  const apiResp = await submitter.request.post('/api/requirements', {
    data: { title: requirementTitle, body: 'E2E intake test body' },
  })
  expect(apiResp.ok()).toBeTruthy()
  const created = await apiResp.json()
  expect(created.title).toBe(requirementTitle)
  expect(created.projectId).toBeNull()
  await submitterCtx.close()

  // Step 2: MANAGER logs in.
  await login(page, 'manager@easyreq.dev', 'password123')

  // Sidebar shows projects + inbox for MANAGER
  await expect(page.getByRole('link', { name: '项目列表' })).toBeVisible()
  await expect(page.getByRole('link', { name: '需求池' })).toBeVisible()
  await expect(page.getByRole('link', { name: '后台' })).toBeVisible()

  // Step 3: open the new-project dialog via /projects (where the button lives).
  await page.goto('/projects')
  await page.getByRole('button', { name: '新建项目' }).click()
  await expect(page.getByRole('heading', { name: '新建项目' })).toBeVisible()
  await page.locator('input[name="name"]').fill(projectName)
  await page.locator('input[name="slug"]').fill(projectSlug)
  await page.locator('textarea[name="description"]').fill('E2E intake project')
  // Batch-assign checkbox — locate by associated label text.
  const assignLabel = page.locator('label', { hasText: requirementTitle })
  await assignLabel.locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: '创建' }).click()

  // Lands on /projects/<slug>; the requirement is now in it.
  await page.waitForURL(new RegExp(`/projects/${projectSlug}$`))
  await expect(page.getByText(requirementTitle)).toBeVisible()

  // Step 4: open the requirement — should now have project number #1.
  await page.getByText(requirementTitle).click()
  await page.waitForURL(/\/projects\/.+\/requirements\/.+/)
  await expect(page.locator('span', { hasText: /^#1$/ }).first()).toBeVisible()

  // Step 5: add DEVELOPER and SUBMITTER as project members so they can
  // access the detail page later. Use email lookup (avoids needing ADMIN
  // permissions just to look up user IDs).
  for (const email of ['dev@easyreq.dev', 'submitter@company.dev']) {
    const r = await page.request.post(`/api/projects/${projectSlug}/members`, {
      data: { email },
    })
    expect(r.ok(), `add member ${email}`).toBeTruthy()
  }

  // Step 6: walk IPD standard path.
  await transitionTo(page, '评审中')
  await expectStatusOnPage(page, '评审中')

  await transitionTo(page, '已规划')
  await expectStatusOnPage(page, '已规划')

  // Step 7: hand off to DEVELOPER for IN_DEVELOPMENT and IN_TESTING.
  const devCtx = await context.browser()!.newContext()
  const dev = await devCtx.newPage()
  await login(dev, 'dev@easyreq.dev', 'password123')
  await dev.goto(page.url())
  await transitionTo(dev, '开发中')
  await expectStatusOnPage(dev, '开发中')
  await transitionTo(dev, '测试中')
  await expectStatusOnPage(dev, '测试中')
  const reqUrl = dev.url()
  await devCtx.close()

  // Step 8: MANAGER delivers.
  await page.goto(reqUrl)
  await transitionTo(page, '已交付')
  await expectStatusOnPage(page, '已交付')

  // Step 9: SUBMITTER accepts.
  const submitterCtx2 = await context.browser()!.newContext()
  const submitter2 = await submitterCtx2.newPage()
  await login(submitter2, 'submitter@company.dev', 'password123')
  await submitter2.goto(reqUrl)
  await transitionTo(submitter2, '已验收')
  await expectStatusOnPage(submitter2, '已验收')
  await submitterCtx2.close()

  // Re-verify on the original tab.
  await page.goto(reqUrl)
  await expectStatusOnPage(page, '已验收')
})

test('MANAGER quick path: skip review, go straight to dev, deliver, accept', async ({ page, context }) => {
  const stamp = Date.now()
  const requirementTitle = `E2E manager quick ${stamp}`

  // Submitter creates an unassigned requirement via API.
  const submitterCtx = await context.browser()!.newContext()
  const submitter = await submitterCtx.newPage()
  await login(submitter, 'submitter@company.dev', 'password123')
  const created = await (
    await submitter.request.post('/api/requirements', { data: { title: requirementTitle } })
  ).json()
  await submitterCtx.close()

  // MANAGER creates the project via API for determinism.
  await login(page, 'manager@easyreq.dev', 'password123')
  const projectResp = await page.request.post('/api/projects', {
    data: { name: `E2E Quick ${stamp}`, slug: `e2e-quick-${stamp}` },
  })
  expect(projectResp.ok()).toBeTruthy()
  const project = await projectResp.json()

  // Single-assign via PATCH /api/requirements/:id/project.
  const assignResp = await page.request.patch(`/api/requirements/${created.id}/project`, {
    data: { projectId: project.id },
  })
  expect(assignResp.ok()).toBeTruthy()

  // Add dev and submitter to the new project.
  for (const email of ['dev@easyreq.dev', 'submitter@company.dev']) {
    const r = await page.request.post(`/api/projects/${project.slug}/members`, { data: { email } })
    expect(r.ok(), `add member ${email}`).toBeTruthy()
  }

  // Quick path: SUBMITTED → IN_DEVELOPMENT (skip UNDER_REVIEW and PLANNED).
  await page.goto(`/projects/${project.slug}/requirements/${created.id}`)
  await transitionTo(page, '开发中')
  await expectStatusOnPage(page, '开发中')

  await transitionTo(page, '已交付')
  await expectStatusOnPage(page, '已交付')

  // SUBMITTER accepts.
  const submitterCtx2 = await context.browser()!.newContext()
  const submitter2 = await submitterCtx2.newPage()
  await login(submitter2, 'submitter@company.dev', 'password123')
  await submitter2.goto(`/projects/${project.slug}/requirements/${created.id}`)
  await transitionTo(submitter2, '已验收')
  await expectStatusOnPage(submitter2, '已验收')
  await submitterCtx2.close()
})