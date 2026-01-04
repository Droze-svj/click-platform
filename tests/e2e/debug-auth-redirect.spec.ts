import { test, expect } from '@playwright/test'

const INGEST =
  'http://127.0.0.1:7243/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a'

function log(message: string, data: Record<string, any> = {}, location = 'tests/e2e/debug-auth-redirect.spec.ts') {
  // #region agent log
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run19',
      hypothesisId: 'H19',
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

test('debug: dashboard navigation should not redirect to /login and should not call Render API', async ({
  page,
  request,
}) => {
  log('pw_test_start', {}, 'tests/e2e/debug-auth-redirect.spec.ts:start')

  const email = `pw_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
  // Must satisfy server validator: at least one uppercase, one lowercase, one number.
  const password = 'Pw_test_password_123'
  const name = 'Playwright Debug'

  const reg = await request.post('http://127.0.0.1:5001/api/auth/register', {
    data: { email, password, name },
  })
  const regStatus = reg.status()
  let token: string | null = null
  let regJson: any = null
  try {
    regJson = await reg.json()
    token = regJson?.data?.token || null
  } catch {}

  log(
    'pw_register_result',
    {
      status: regStatus,
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      error: String(regJson?.error || ''),
      validationMessages: Array.isArray(regJson?.details)
        ? regJson.details.map((d: any) => String(d?.msg || '')).slice(0, 5)
        : [],
    },
    'tests/e2e/debug-auth-redirect.spec.ts:register'
  )

  expect(regStatus).toBe(201)
  expect(token).toBeTruthy()

  // Inject token before any app code runs.
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('token', String(t))
    } catch {}
  }, token as string)

  const remoteRequests: string[] = []
  const authMeRequests: Array<{ url: string; hasAuthHeader: boolean; authHeaderLength: number }> = []
  const notificationsRequests: Array<{ url: string; hasAuthHeader: boolean; authHeaderLength: number }> = []

  page.on('request', (req) => {
    const url = req.url()
    const headers = req.headers()
    const auth = headers['authorization'] || headers['Authorization'] || ''
    const hasAuthHeader = !!auth
    const authHeaderLength = String(auth).length

    if (url.includes('onrender.com')) {
      remoteRequests.push(url)
      log(
        'pw_request_to_render_detected',
        { url, hasAuthHeader, authHeaderLength },
        'tests/e2e/debug-auth-redirect.spec.ts:request'
      )
    }

    if (url.includes('/api/auth/me') || url.endsWith('/auth/me') || url.includes('/auth/me')) {
      authMeRequests.push({ url, hasAuthHeader, authHeaderLength })
      log(
        'pw_request_auth_me',
        { url, hasAuthHeader, authHeaderLength },
        'tests/e2e/debug-auth-redirect.spec.ts:request'
      )
    }

    if (url.includes('/api/notifications') || url.includes('/notifications')) {
      notificationsRequests.push({ url, hasAuthHeader, authHeaderLength })
      log(
        'pw_request_notifications',
        { url, hasAuthHeader, authHeaderLength },
        'tests/e2e/debug-auth-redirect.spec.ts:request'
      )
    }
  })

  // Load dashboard
  await page.goto('http://localhost:3010/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  log(
    'pw_after_dashboard_load',
    {
      url: page.url(),
      overlayCount: await page.locator('div.fixed.inset-0').count(),
    },
    'tests/e2e/debug-auth-redirect.spec.ts:after_dashboard'
  )

  // Navigate directly to routes to avoid UI overlays intercepting clicks.
  const routeTargets = [
    'http://localhost:3010/dashboard/notifications',
    'http://localhost:3010/dashboard/scripts',
    'http://localhost:3010/dashboard',
  ]
  for (const url of routeTargets) {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    log(
      'pw_after_route_goto',
      {
        targetUrl: url,
        currentUrl: page.url(),
        overlayCount: await page.locator('div.fixed.inset-0').count(),
      },
      'tests/e2e/debug-auth-redirect.spec.ts:nav'
    )
  }

  const finalUrl = page.url()
  log(
    'pw_test_end',
    {
      finalUrl,
      remoteRequestsCount: remoteRequests.length,
      authMeRequestsCount: authMeRequests.length,
      notificationsRequestsCount: notificationsRequests.length,
    },
    'tests/e2e/debug-auth-redirect.spec.ts:end'
  )

  // If we got redirected to login, that’s the failure mode we’re debugging.
  expect(finalUrl).not.toContain('/login')
})


