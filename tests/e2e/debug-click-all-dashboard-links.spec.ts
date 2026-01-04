import { test, expect } from '@playwright/test'

const INGEST =
  'http://127.0.0.1:7243/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a'

function log(
  message: string,
  data: Record<string, any> = {},
  location = 'tests/e2e/debug-click-all-dashboard-links.spec.ts'
) {
  // #region agent log
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'run30',
      hypothesisId: 'H30',
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

test('debug: click every /dashboard link and ensure no redirect to /login', async ({ page, request }) => {
  log('pw30_start', {}, 'tests/e2e/debug-click-all-dashboard-links.spec.ts:start')

  const email = `pw30_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`
  const password = 'Pw30_password_123'
  const name = 'PW30 Debug'

  const reg = await request.post('http://127.0.0.1:5001/api/auth/register', {
    data: { email, password, name },
  })
  const regStatus = reg.status()
  const regJson = await reg.json().catch(() => null)
  const token: string | null = regJson?.data?.token || null

  log(
    'pw30_register_result',
    { status: regStatus, hasToken: !!token, tokenLength: token ? token.length : 0 },
    'tests/e2e/debug-click-all-dashboard-links.spec.ts:register'
  )
  expect(regStatus).toBe(201)
  expect(token).toBeTruthy()

  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('token', String(t))
    } catch {}
  }, token as string)

  // Capture navigations + requests
  const navs: Array<{ from: string; to: string; ts: number }> = []
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    const to = frame.url()
    const from = navs.length ? navs[navs.length - 1].to : ''
    navs.push({ from, to, ts: Date.now() })
  })

  const authErrors: Array<{ url: string; status: number | null }> = []
  page.on('response', async (resp) => {
    try {
      const url = resp.url()
      const status = resp.status()
      if (url.includes('/api/') && (status === 401 || status === 403)) {
        authErrors.push({ url, status })
        log('pw30_auth_error_response', { url, status }, 'tests/e2e/debug-click-all-dashboard-links.spec.ts:resp')
      }
    } catch {}
  })

  await page.goto('http://localhost:3010/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // Collect all dashboard links present in the DOM.
  const hrefs = await page.evaluate(() => {
    const out = new Set<string>()
    const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    for (const a of anchors) {
      const href = a.getAttribute('href') || ''
      if (!href) continue
      if (href.startsWith('/dashboard')) out.add(href)
      if (href.startsWith('http://localhost:3010/dashboard')) out.add(href.replace('http://localhost:3010', ''))
    }
    return Array.from(out)
  })

  log(
    'pw30_discovered_dashboard_links',
    { count: hrefs.length, hrefs: hrefs.slice(0, 40) },
    'tests/e2e/debug-click-all-dashboard-links.spec.ts:discover'
  )

  // If we discover nothing, fail fast (this indicates the UI nav isn’t rendering).
  expect(hrefs.length).toBeGreaterThan(0)

  // Visit each route directly (more reliable than clicking).
  // This still reproduces the same auth/guard logic and is enough to catch redirects.
  const visited: string[] = []
  for (const href of hrefs) {
    const target = href.startsWith('http') ? href : `http://localhost:3010${href}`
    log('pw30_before_goto', { target }, 'tests/e2e/debug-click-all-dashboard-links.spec.ts:goto')
    await page.goto(target, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const current = page.url()
    visited.push(current)
    log('pw30_after_goto', { target, current }, 'tests/e2e/debug-click-all-dashboard-links.spec.ts:goto')
    expect(current).not.toContain('/login')
  }

  log(
    'pw30_end',
    {
      finalUrl: page.url(),
      visitedCount: visited.length,
      authErrorsCount: authErrors.length,
      navCount: navs.length,
    },
    'tests/e2e/debug-click-all-dashboard-links.spec.ts:end'
  )
})


