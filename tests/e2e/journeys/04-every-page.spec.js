// Journey: a signed-in creator opens EVERY page the app ships.
//
// The page list is crawled from client/app/**/page.tsx at run time, so a new
// page is covered the day it lands. Dynamic routes ([id]) need real ids and
// have their own journeys; dev/test scaffolding and the signed-out auth entry
// pages are skipped.
//
// Each page must:
//   - throw no uncaught exception (pageerror),
//   - log no console error (except the known keyless /health/ai 503),
//   - get no 5xx from our API,
//   - not bounce a signed-in user to /login,
//   - render no form field whose text box is shorter than its own font
//     (clientHeight − vertical padding < font-size): the "unreadable dropdown /
//     clipped input" bug class,
//   - not call any one API endpoint more than 20 times while it settles (an
//     effect loop hammering the server).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { acceptCookies, registerViaApi, useSession, watchPage, requestStorms } = require('./helpers');

const APP_DIR = path.join(__dirname, '..', '..', '..', 'client', 'app');

// Dev/test scaffolding (404 in production builds — see client/middleware.ts)
// and auth entry pages that a signed-in user is meant to bounce off.
const SKIP = [
  /^\/(debug|debug-dashboard|test-[^/]+|auto-test-registration|simple-register|__probe|probe|which-build)(\/|$)/,
  /^\/(login|register|forgot-password|reset-password|verify-email|registration-success)(\/|$)/,
  // Visiting it accepts/declines a token from the URL — no token, nothing to show.
  /^\/teams\/accept(\/|$)/,
];

function crawlPages(dir, prefix = '') {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const name = entry.name;
      // api/ = route handlers; _folders are private (not routable) in the App Router.
      if (name === 'api' || name.startsWith('_')) continue;
      // Route groups "(marketing)" don't add a path segment.
      const segment = /^\(.*\)$/.test(name) ? '' : `/${name}`;
      routes.push(...crawlPages(path.join(dir, name), `${prefix}${segment}`));
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      routes.push(prefix || '/');
    }
  }
  return routes;
}

const ROUTES = crawlPages(APP_DIR)
  .filter((r) => !r.includes('['))
  .filter((r) => !SKIP.some((re) => re.test(r)))
  .sort();

/** Form fields whose text box can't fit one line of their own font. */
async function clippedFields(page) {
  return page.evaluate(() => {
    const SKIP_TYPES = new Set(['checkbox', 'radio', 'range', 'file', 'hidden', 'color', 'submit', 'button', 'image', 'reset']);
    const out = [];
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.tagName === 'INPUT' && SKIP_TYPES.has((el.getAttribute('type') || 'text').toLowerCase())) continue;
      const rect = el.getBoundingClientRect();
      // Not rendered, or visually-hidden (sr-only 1px boxes).
      if (rect.width <= 2 || rect.height <= 2) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const fontSize = parseFloat(cs.fontSize) || 0;
      const inner = el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      if (inner + 0.5 < fontSize) {
        const label = el.getAttribute('aria-label') || el.getAttribute('name') || el.id || el.getAttribute('placeholder') || '';
        out.push(`<${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}> text box ${inner.toFixed(1)}px < font ${fontSize}px (height ${el.clientHeight}px, padding ${cs.paddingTop}/${cs.paddingBottom})`);
      }
    }
    return out;
  });
}

let account;

test.describe('every page loads signed-in', () => {
  test.beforeAll(async ({ request }) => {
    account = await registerViaApi(request, { firstName: 'Crawler', lastName: 'Walker' });
  });

  test('the crawler found the app pages', () => {
    expect(ROUTES).toContain('/dashboard');
    expect(ROUTES).toContain('/dashboard/settings');
    expect(ROUTES.length).toBeGreaterThan(60);
  });

  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      const seen = watchPage(page);
      await acceptCookies(page);
      await useSession(page, account);

      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(res && res.status(), `HTTP status of ${route}`).toBeLessThan(400);
      // Pages that poll never reach networkidle — cap the wait.
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);

      const landed = new URL(page.url()).pathname;
      expect(landed, `${route} bounced a signed-in user to /login`).not.toBe('/login');
      // The journey user is a regular creator: admin screens are SUPPOSED to be
      // refused by the API (403) — that refusal is the browser's only console line.
      const consoleErrors = /^\/dashboard\/admin(\/|$)/.test(route)
        ? seen.consoleErrors.filter((l) => !/status of 403 \(Forbidden\)/.test(l))
        : seen.consoleErrors;
      // Soft: one run reports every problem a page has, not just the first.
      expect.soft(seen.pageErrors, `uncaught exceptions on ${route}`).toEqual([]);
      expect.soft(seen.serverErrors, `5xx API responses on ${route}`).toEqual([]);
      expect.soft(consoleErrors, `console errors on ${route}`).toEqual([]);
      expect.soft(await clippedFields(page), `form fields too short for their text on ${route}`).toEqual([]);
      expect.soft(requestStorms(seen), `API endpoints called in a loop on ${route}`).toEqual([]);
    });
  }
});
