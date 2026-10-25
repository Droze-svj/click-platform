// The header breadcrumb links every parent segment of the current dashboard
// URL. Folders that only group child routes have no page, so those links
// 404'd (/dashboard/growth from every growth tool — found by the every-page
// journey). crumbHasPage() must know every such folder in app/dashboard.
import fs from 'fs'
import path from 'path'
import { crumbHasPage } from '../lib/breadcrumbRoutes'

const DASHBOARD = path.join(__dirname, '..', 'app', 'dashboard')
// Folders next.config.js redirects to a real page.
const REDIRECTED = new Set(['/dashboard/clips'])

function foldersWithoutPage(dir: string, href: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const hasPage = entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(e.name))
  const children = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_') && e.name !== '__tests__' && e.name !== 'components')
  if (!hasPage && children.length > 0) out.push(href)
  for (const child of children) {
    // A dynamic segment shows up in the URL as a concrete value.
    const segment = /^\[.*\]$/.test(child.name) ? 'some-id' : child.name
    foldersWithoutPage(path.join(dir, child.name), `${href}/${segment}`, out)
  }
  return out
}

describe('breadcrumb links only point at real pages', () => {
  it('every page-less dashboard folder renders as plain text', () => {
    const missing = foldersWithoutPage(DASHBOARD, '/dashboard')
      .filter((href) => !REDIRECTED.has(href))
      .filter((href) => crumbHasPage(href))
    expect(missing).toEqual([])
  })

  it('real pages stay linked', () => {
    for (const href of ['/dashboard', '/dashboard/analytics', '/dashboard/settings', '/dashboard/clips/hub', '/dashboard/video']) {
      expect(crumbHasPage(href)).toBe(true)
    }
  })
})
