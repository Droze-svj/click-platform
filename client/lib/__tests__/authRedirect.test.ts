import { safeNextPath, loginPathForCurrentPage } from '../authRedirect'

describe('safeNextPath', () => {
  it.each([
    ['/dashboard/settings?tab=notifications', '/dashboard/settings?tab=notifications'],
    ['%2Fdashboard%2Fvideo', '/dashboard/video'],
    ['/dashboard/features#brief', '/dashboard/features#brief'],
  ])('keeps same-site path %s', (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected)
  })

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['/\\evil.example'],
    ['%2F%2Fevil.example'],
    ['javascript:alert(1)'],
    ['/login?next=/dashboard'],
    ['/reset-password?token=x'],
    ['/dash\nboard'],
    ['%E0%A4%A'], // malformed escape
    [''],
    [null],
  ])('falls back for unsafe or pointless %p', (raw) => {
    expect(safeNextPath(raw as any)).toBe('/dashboard')
  })

  it('uses the given fallback', () => {
    expect(safeNextPath('//x', '/home')).toBe('/home')
  })
})

describe('loginPathForCurrentPage', () => {
  it('carries the current page as ?next=', () => {
    window.history.pushState({}, '', '/dashboard/settings?tab=security')
    expect(loginPathForCurrentPage()).toBe('/login?next=%2Fdashboard%2Fsettings%3Ftab%3Dsecurity')
  })
  it('plain /login from the home page or an auth page', () => {
    window.history.pushState({}, '', '/')
    expect(loginPathForCurrentPage()).toBe('/login')
    window.history.pushState({}, '', '/login')
    expect(loginPathForCurrentPage()).toBe('/login')
  })
})
