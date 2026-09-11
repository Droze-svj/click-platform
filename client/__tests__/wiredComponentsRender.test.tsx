/**
 * Every component that was mounted for the first time must survive a render.
 *
 * These 22 had been built, shipped in the bundle, and never rendered by anything
 * — no page, no test. Wiring them up is exactly when a bad prop or a null-deref
 * in a mount effect first gets to fire, and the pages that host them wrap them in
 * ErrorBoundaries, so in the product a failure shows as a small red card rather
 * than anything that reaches a log.
 *
 * Rendered directly here, with no boundary, so a throw fails the test outright.
 *
 * Shallow by design: every request resolves empty, so this asserts "renders its
 * first paint without throwing", which is the state a real user hits before any
 * data arrives. It is not a test of behaviour.
 */
import { render } from '@testing-library/react'
import React from 'react'

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
// FULL hook shapes — a partial mock is its own bug class: an earlier version of
// the sibling route test returned { socket, connected } while a consumer
// destructured { socket, connected, on, off } and called on() in an effect.
jest.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ socket: null, connected: false, on: jest.fn(), off: jest.fn() }),
}))
jest.mock('../hooks/useUserSocket', () => ({
  useUserSocket: () => ({ socket: null, connected: false, on: jest.fn(), off: jest.fn() }),
}))

jest.mock('framer-motion', () => ({
  m: new Proxy({}, { get: () => ({ children, ...p }: any) => <div {...p}>{children}</div> }),
  motion: new Proxy({}, { get: () => ({ children, ...p }: any) => <div {...p}>{children}</div> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  LazyMotion: ({ children }: any) => <>{children}</>,
  domMax: {}, domAnimation: {}, useReducedMotion: () => true,
}))
jest.mock('recharts', () => new Proxy({}, { get: () => ({ children }: any) => <div>{children}</div> }))

/** [label, module path, named export or null for default, props] */
const CASES: [string, string, string | null, Record<string, any>][] = [
  ['OverlordDashboard', '../components/OverlordDashboard', null, {}],
  ['Click12Dashboard', '../components/Click12Dashboard', null, {}],
  ['IntelligenceEngine', '../components/IntelligenceEngine', null, {}],
  ['RevenueOracle', '../components/RevenueOracle', null, {}],
  ['DailyChallenges', '../components/DailyChallenges', null, {}],
  ['ActivityFeed', '../components/ActivityFeed', null, {}],
  ['QuickTemplateAccess', '../components/QuickTemplateAccess', null, {}],
  ['NextStepsPanel', '../components/NextStepsPanel', null, {}],
  ['GetStartedStrip', '../components/GetStartedStrip', null, {}],
  ['AILearningIndicator', '../components/AILearningIndicator', null, {}],
  ['EnhancedWorkflowBuilder', '../components/EnhancedWorkflowBuilder', null, {}],
  ['SubscriptionStatus', '../components/SubscriptionStatus', null, {}],
  ['AdvancedSchedulingHub', '../components/scheduler/AdvancedSchedulingHub', null, {}],
  ['GovernanceDashboard', '../components/editor/views/GovernanceDashboard', 'GovernanceDashboard', {}],

  // Prop-taking ones get the minimum their host actually supplies.
  ['ContentBenchmarking', '../components/ContentBenchmarking', null, { contentId: 'c1' }],
  ['VideoCaptionEditor', '../components/VideoCaptionEditor', null, { contentId: 'c1' }],
  ['RemediationHUD', '../components/editor/views/RemediationHUD', 'RemediationHUD', { contentId: 'c1' }],
  ['AssetLibrary', '../components/AssetLibrary', null, { onSelectAsset: jest.fn() }],
  ['PerformancePredictor', '../components/PerformancePredictor', null, { content: { text: 'hi', type: 'post', platform: 'tiktok', tags: [] } }],
  ['AIContentAnalysis', '../components/AIContentAnalysis', null, { videoUrl: 'https://example.test/v.mp4', videoId: 'c1' }],
  ['AIAssistView', '../components/editor/views/AIAssistView', null, {
    videoId: 'c1', transcript: 'hello', aiSuggestions: [], setAiSuggestions: jest.fn(),
    setActiveCategory: jest.fn(), showToast: jest.fn(),
  }],
  ['MonetizationHub', '../components/editor/views/MonetizationHub', null, {
    contentId: 'c1', initialProducts: [], transcript: 'hello', onClose: jest.fn(),
  }],
  ['AdaptiveCritiquePanel', '../components/editor/AdaptiveCritiquePanel', null, {
    videoId: 'c1', suggestions: [], onOverride: jest.fn(), showToast: jest.fn(),
  }],
]

describe('components mounted for the first time', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  afterAll(() => errorSpy.mockRestore())

  it.each(CASES)('%s renders', (_label, modulePath, exportName, props) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require(modulePath)
    const Component = exportName ? mod[exportName] : mod.default
    expect(typeof Component).toBe('function')

    // No ErrorBoundary here on purpose: a throw during render propagates and
    // fails this test, which is the whole point. In the product these sit inside
    // boundaries, so the same failure would show as a small red card and reach
    // no log at all.
    const { container } = render(<Component {...props} />)
    expect(container).toBeInstanceOf(HTMLElement)

    // Deliberately NOT asserting that text was painted. Eight of these render a
    // skeleton (divs, no text) or return null until their first response
    // arrives — `if (entries.length === 0) return null` and friends — which is
    // correct behaviour for a panel with no data yet, and an earlier version of
    // this test failed all eight for it.
  })
})
