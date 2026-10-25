// A signed-out visit to a dashboard page must land on /login?next=<page> so
// signing in returns there. useAuth does that, but ~24 pages also ran their
// own `router.push('/login')` guard — whichever effect fired first won, and
// when it was the page's, the return path was lost (found by the auth journey
// in tests/e2e/journeys). Pages must use loginPathForCurrentPage().
import fs from 'fs'
import path from 'path'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(p)
  }
  return out
}

describe('dashboard sign-in redirects keep the page as ?next=', () => {
  const root = path.join(__dirname, '..', 'app', 'dashboard')
  const files = walk(root)

  it('finds the dashboard pages', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('no dashboard page sends a signed-out visitor to a bare /login', () => {
    const offenders: string[] = []
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!/router\.(push|replace)\(\s*['"`]\/login['"`]\s*\)/.test(line)) return
        // Deliberate: after deactivating the account there is nothing to return to.
        if (/setTimeout\(\(\) => router\.push\('\/login'\), 800\)/.test(line)) return
        offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
