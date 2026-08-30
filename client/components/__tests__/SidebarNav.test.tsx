import { render, screen, fireEvent, within } from '@testing-library/react'
import SidebarNav from '../SidebarNav'

/**
 * The sidebar used to render all 41 destinations at once. It now shows a small
 * primary set per zone with the rest behind "More", plus user pinning.
 *
 * The invariant these tests protect: consolidation must never REMOVE a
 * destination from the product — everything is still reachable, just not all
 * shouting at once.
 */

let mockPathname = '/dashboard'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}))
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Dev' }, logout: jest.fn() }) }))
jest.mock('../ThemeProvider', () => ({ useTheme: () => ({ isDark: true, toggle: jest.fn() }) }))
jest.mock('../../contexts/LayoutPreferencesContext', () => ({
  useLayoutPreferences: () => ({ focusMode: false, toggleFocusMode: jest.fn() }),
}))
jest.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: () => '' }) }))
jest.mock('../ClickLogo', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: () => ({ children, ...p }: any) => <div {...p}>{children}</div> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Real hook, but no token → stays on the local cache, no network.
beforeEach(() => {
  mockPathname = '/dashboard'
  window.localStorage.clear()
})

const openZone = (name: RegExp) => {
  const zoneButton = screen.getAllByRole('button').find((b) => name.test(b.textContent || ''))
  if (zoneButton) fireEvent.click(zoneButton)
}

describe('SidebarNav progressive disclosure', () => {
  it('shows the primary Studio items without expanding More', () => {
    const { container } = render(<SidebarNav />)
    // Scope to the sidebar's own nav — the mobile tab bar repeats some labels.
    const nav = container.querySelector('nav') as HTMLElement
    // Studio is the default-expanded zone.
    expect(within(nav).getByRole('link', { name: /AI Video Creator/i })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Video Editor/i })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /^Clips$/i })).toBeInTheDocument()
  })

  it('keeps secondary items out of the way until More is expanded', () => {
    render(<SidebarNav />)
    expect(screen.queryByRole('link', { name: /Hook A\/B Lab/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /More \(\d+\)/ }))
    expect(screen.getByRole('link', { name: /Hook A\/B Lab/i })).toBeInTheDocument()
  })

  it('never hides the page the user is currently on behind More', () => {
    // A secondary destination.
    mockPathname = '/dashboard/scripts'
    render(<SidebarNav />)
    const link = screen.getByRole('link', { name: /Scripts/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('pinning promotes a secondary item into the always-visible set', () => {
    render(<SidebarNav />)

    fireEvent.click(screen.getByRole('button', { name: /More \(\d+\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pin Scripts to the sidebar/i }))

    // Collapse "More" again — the pinned item stays visible.
    fireEvent.click(screen.getByRole('button', { name: /Show less/i }))
    expect(screen.getByRole('link', { name: /Scripts/i })).toBeInTheDocument()
  })

  it('pins persist to the local cache so they survive a reload', () => {
    const { unmount } = render(<SidebarNav />)
    fireEvent.click(screen.getByRole('button', { name: /More \(\d+\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pin Scripts to the sidebar/i }))
    unmount()

    const cached = JSON.parse(window.localStorage.getItem('click-workspace-prefs') || '{}')
    expect(cached.pinnedNav).toContain('/dashboard/scripts')

    render(<SidebarNav />)
    expect(screen.getByRole('link', { name: /Scripts/i })).toBeInTheDocument()
  })

  it('Home cannot be pinned — it is always first', () => {
    render(<SidebarNav />)
    expect(screen.queryByRole('button', { name: /Pin Home/i })).toBeNull()
  })

  it('adopts routes that were previously unreachable from any nav', () => {
    render(<SidebarNav />)
    openZone(/Grow/i)

    // Creator DNA surfaces /api/me/creator-dna, which had no client consumer
    // at all, and leads the Grow zone.
    expect(screen.getByRole('link', { name: /Creator DNA/i })).toBeInTheDocument()

    // click-learning had zero inbound links anywhere in the app. It's adopted
    // as a secondary item beside Creator DNA, so it lives under "More".
    const moreButton = screen.getAllByRole('button').find((b) => /More \(\d+\)/.test(b.textContent || ''))
    expect(moreButton).toBeDefined()
    fireEvent.click(moreButton!)
    expect(screen.getByRole('link', { name: /What Click Learned/i })).toBeInTheDocument()
  })
})
