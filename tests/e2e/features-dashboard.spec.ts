// Full E2E for the Creator Tools dashboard (app/dashboard/features).
//
// NOT part of the CI smoke gate (ci-smoke.spec.js) — this is part of the full
// tests/e2e suite, run manually against a live stack:
//   npx playwright test --config=playwright.config.no-webserver.js features-dashboard
// with the frontend on E2E_BASE_URL and backend on E2E_API_URL.
//
// It registers a fresh user, injects the token the way the app expects
// (localStorage 'token'), opens the dashboard, and asserts the composed feature
// surfaces render + one interactive tool works end to end (comment triage).

import { test, expect } from '@playwright/test'

const APP = process.env.E2E_BASE_URL || 'http://localhost:3000'
const API = process.env.E2E_API_URL || 'http://localhost:5001/api'

async function registerAndAuth(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {
  const email = `e2e_feat_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
  const reg = await request.post(`${API}/auth/register`, {
    data: { email, password: 'E2e_features_123', name: 'E2E Features' },
  })
  expect(reg.status(), 'register status').toBeLessThan(400)
  const token: string | null = (await reg.json().catch(() => null))?.data?.token || null
  expect(token, 'auth token').toBeTruthy()
  // The app reads the JWT from localStorage 'token' (matches the existing e2e auth flow).
  await page.addInitScript((t) => { try { window.localStorage.setItem('token', String(t)) } catch { /* ignore */ } }, token as string)
}

test('creator-tools dashboard renders its feature surfaces', async ({ page, request }) => {
  await registerAndAuth(page, request)
  await page.goto(`${APP}/dashboard/features`, { waitUntil: 'domcontentloaded' })

  // Landed on the dashboard (not bounced to /login).
  await expect(page).toHaveURL(/\/dashboard\/features/)
  await expect(page.getByRole('heading', { name: 'Creator tools' })).toBeVisible()
  await expect(page.getByTestId('features-dashboard')).toBeVisible()

  // The tools are grouped into labeled sections (Overview/Plan/Create/Engage).
  await expect(page.getByRole('region', { name: 'Plan' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Engage' })).toBeVisible()
})

test('comment triage ranks a pasted inbox', async ({ page, request }) => {
  await registerAndAuth(page, request)
  await page.goto(`${APP}/dashboard/features`, { waitUntil: 'domcontentloaded' })

  await page.getByTestId('triage-input').fill('this is broken, refund??\nwhat camera do you use?\nlove this 🔥')
  await page.getByTestId('triage-run').click()

  // Results render, with the high-priority group present (complaint + question).
  await expect(page.getByTestId('triage-results')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('group-high')).toBeVisible()
  expect(await page.getByTestId('triage-item').count()).toBeGreaterThanOrEqual(3)
})
