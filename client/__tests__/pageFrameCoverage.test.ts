/**
 * Every route under app/ must render through a shell primitive.
 *
 * The shells are not decoration. PageShell supplies the max-width column, the
 * horizontal padding, `text-theme-primary`, and — through `ds-density-pad` /
 * `ds-density-stack` — the only spacing that responds to Settings → Appearance →
 * Density. A page that rolls its own wrapper opts out of all four silently: it
 * looks fine to whoever wrote it and simply ignores the user's density setting
 * forever.
 *
 * That is how the pages this test now covers drifted. Several also hardcoded
 * their colours (`bg-black`, `bg-[#0a0a0f]`, `text-white`, `text-zinc-400`), so
 * they rendered as black slabs, or with near-invisible headings, in light theme
 * — the same defect already fixed once on the legal pages.
 *
 * If this fails, either wrap the page in PageShell / AuthShell / LegalPage, or
 * add it to EXCLUDED below with the reason it is genuinely exempt.
 */

import fs from 'fs'
import path from 'path'

const APP_DIR = path.join(__dirname, '..', 'app')

// Pages that legitimately do not use a shell. Each needs a reason.
const EXCLUDED = new Map<string, string>([
  ['page.tsx', 'the marketing landing page, which owns its own full-bleed layout'],
  [
    'dashboard/clips/page.tsx',
    'calls redirect() and returns no JSX at all — there is nothing to frame',
  ],
  // Dev/test scaffolding. middleware.ts returns 404 for all of these in
  // production, so styling them is wasted effort. Keep the two lists in step:
  // anything added here that is NOT in BLOCKED_IN_PROD is reachable by real
  // users, which is exactly how /simple-register stayed live while printing the
  // API URL and "Check console (F12)" on the page.
  ['debug-dashboard/page.tsx', 'dev scaffolding, 404 in production'],
  ['test-errors/page.tsx', 'dev scaffolding, 404 in production'],
  ['test-connection/page.tsx', 'dev scaffolding, 404 in production'],
  ['test-registration/page.tsx', 'dev scaffolding, 404 in production'],
  ['auto-test-registration/page.tsx', 'dev scaffolding, 404 in production'],
  ['test-debug/page.tsx', 'dev scaffolding, 404 in production'],
  ['simple-register/page.tsx', 'dev scaffolding, 404 in production'],
])

const SHELLS = /\b(PageShell|AuthShell|LegalPage)\b/

function pages(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) pages(p, acc)
    else if (e.name === 'page.tsx') acc.push(path.relative(APP_DIR, p))
  }
  return acc
}

describe('page frame coverage', () => {
  const all = pages(APP_DIR)

  it('finds the app router pages', () => {
    // A floor, so a broken walk cannot make the real assertion vacuously pass.
    expect(all.length).toBeGreaterThan(90)
  })

  it('every page renders through a shell primitive', () => {
    const unframed = all
      .filter((rel) => !EXCLUDED.has(rel))
      .filter((rel) => !SHELLS.test(fs.readFileSync(path.join(APP_DIR, rel), 'utf8')))

    expect(unframed.sort()).toEqual([])
  })

  it('the exclusion list has no stale entries', () => {
    // A path that no longer exists means the exemption is dead and the reason
    // attached to it is no longer being read by anyone.
    const stale = [...EXCLUDED.keys()].filter((rel) => !all.includes(rel))
    expect(stale).toEqual([])
  })

  it('every dev/test page excluded here is actually blocked in production', () => {
    // The exclusion above is only honest if middleware really does 404 these.
    const middleware = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8')
    const notBlocked = [...EXCLUDED.entries()]
      .filter(([, why]) => why.includes('404 in production'))
      .map(([rel]) => `/${rel.replace(/\/page\.tsx$/, '')}`)
      .filter((route) => !middleware.includes(`'${route}'`))

    expect(notBlocked).toEqual([])
  })
})
