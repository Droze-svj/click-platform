/**
 * The routes added when the built-but-unreachable features were wired up must
 * actually RENDER.
 *
 * tsc and `next build` prove those pages compile and that their imports resolve.
 * Neither proves the component tree survives a first paint — a bad prop, a
 * missing context or a null-deref in a mount effect compiles perfectly and then
 * throws in the browser. Mounting a feature nobody had ever mounted is exactly
 * where that risk lives, so each new surface gets one render.
 *
 * Deliberately shallow: every network call resolves empty, so this asserts "the
 * page renders its loading/empty state without throwing", which is the state a
 * real user hits first. It is not a test of what the features do.
 */
import { render, screen } from '@testing-library/react'
import React from 'react'

// ── Every page under test is a client component with the same ambient needs.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>,
}))
jest.mock('next/image', () => ({
  __esModule: true,
  default: (p: any) => <img alt={p.alt ?? ''} src={typeof p.src === 'string' ? p.src : ''} />,
}))

// Resolve every request empty — the point is the first paint, not the data.
jest.mock('../lib/api', () => ({
  apiGet: jest.fn().mockResolvedValue({ success: true, data: {} }),
  apiPost: jest.fn().mockResolvedValue({ success: true, data: {} }),
  apiPut: jest.fn().mockResolvedValue({ success: true, data: {} }),
  apiDelete: jest.fn().mockResolvedValue({ success: true, data: {} }),
  apiPatch: jest.fn().mockResolvedValue({ success: true, data: {} }),
  handleApiError: (e: any) => String(e?.message ?? e),
}))

jest.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'en', setLanguage: jest.fn(), isLoading: false }),
}))
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn(), toasts: [], removeToast: jest.fn() }),
  ToastProvider: ({ children }: any) => <>{children}</>,
}))
jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { _id: 'u1', name: 'Dev', email: 'dev@example.com' }, loading: false, logout: jest.fn(), refresh: jest.fn() }),
}))
jest.mock('../hooks/useEntitlements', () => ({
  useEntitlements: () => ({ tier: 'agency', isEarlyAccess: true, loading: false, has: () => true }),
}))
// Mock the FULL UseSocketReturn shape. An earlier version returned only
// { socket, connected }; AIContentOperationsDashboard destructures
// { socket, connected, on, off } and calls on() in an effect, so the omission
// threw — and the page's ErrorBoundary swallowed it into a fallback that a
// `not.toThrow()` assertion would have called a pass. A partial mock of a hook
// is its own bug class.
jest.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ socket: null, connected: false, on: jest.fn(), off: jest.fn() }),
}))
jest.mock('../hooks/useUserSocket', () => ({ useUserSocket: () => ({ socket: null, connected: false }) }))

// framer-motion: `m` proxies to plain elements (LazyMotion is not mounted here).
jest.mock('framer-motion', () => ({
  m: new Proxy({}, { get: () => ({ children, ...p }: any) => <div {...p}>{children}</div> }),
  motion: new Proxy({}, { get: () => ({ children, ...p }: any) => <div {...p}>{children}</div> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  LazyMotion: ({ children }: any) => <>{children}</>,
  domMax: {},
  domAnimation: {},
  useReducedMotion: () => true,
}))

// recharts needs a real layout box; jsdom has none.
jest.mock('recharts', () => new Proxy({}, {
  get: () => ({ children }: any) => <div>{children}</div>,
}))

const ROUTES: [string, string][] = [
  ['/dashboard/ops', '../app/dashboard/ops/page'],
  ['/dashboard/toolbox', '../app/dashboard/toolbox/page'],
  ['/dashboard/neural', '../app/dashboard/neural/page'],
  ['/dashboard/suggestions', '../app/dashboard/suggestions/page'],
  ['/dashboard/content/operations', '../app/dashboard/content/operations/page'],
  ['/dashboard/onboarding/wizard', '../app/dashboard/onboarding/wizard/page'],
]

describe('routes added when the unreachable features were wired', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  afterAll(() => errorSpy.mockRestore())

  it.each(ROUTES)('%s renders without throwing', (_route, modulePath) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const Page = require(modulePath).default
    const { container } = render(<Page />)

    // `not.toThrow()` alone would be worthless here: every one of these pages
    // wraps its feature in an ErrorBoundary, which CATCHES a render error and
    // returns a fallback — so a component that throws still renders "fine".
    // Assert the fallback is absent instead.
    expect(screen.queryByText('Component Error')).toBeNull()
    expect(container.textContent).not.toContain('An unexpected error occurred')

    // And that something actually painted, so an empty tree cannot pass either.
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('the ops page renders a tab per operational HUD', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const Page = require('../app/dashboard/ops/page').default
    render(<Page />)
    // Eleven HUDs were mounted here; the tab list is what makes them reachable.
    expect(screen.getAllByRole('tab').length).toBe(11)
  })
})
