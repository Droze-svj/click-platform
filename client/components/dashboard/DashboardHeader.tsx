'use client'

/**
 * DashboardHeader — global top bar for the 2026 design system.
 *
 * Spans the content column (right of SidebarNav). Provides:
 *  - Left: current page title derived from the route (reuses nav.* i18n keys,
 *    falling back to the translation layer's humanise()), plus a section
 *    breadcrumb for nested routes.
 *  - Center/right: a search / command trigger that opens the EXISTING
 *    GlobalCommandPalette via the `click-cmdk-open` window event (the same
 *    mechanism the palette already listens for) — it does NOT build a new
 *    palette. ⌘K still works globally.
 *  - Right: notifications (links to /dashboard/notifications — no fabricated
 *    count), user menu (avatar → profile / settings / logout via useAuth),
 *    and the theme toggle (useTheme).
 *
 * Built on ds- surface/elevation utilities + ui primitives (IconButton).
 * Container-aware via useContainerWidth: on narrow widths the full search
 * field collapses to an icon and the trailing actions fold into an overflow
 * menu so the bar never overflows horizontally. Honors prefers-reduced-motion
 * (transitions are CSS, and the ds- utilities already neutralize motion).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Search, Command, Bell, Sun, Moon, LogOut, User as UserIcon,
  Settings, MoreHorizontal, ChevronRight,
} from 'lucide-react'
import { IconButton } from '../ui'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../ThemeProvider'
import { useTranslation } from '../../hooks/useTranslation'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { cn } from '../../lib/utils'

// Route segment → i18n key map. Keys resolve through the same nav.* catalog the
// sidebar uses; anything unmapped falls back to t()'s humanise() so we never
// leak raw slugs. This is a label derivation, NOT a routing change.
const SEGMENT_LABEL_KEY: Record<string, string> = {
  dashboard: 'nav.dashboard',
  onboarding: 'nav.onboarding',
  forge: 'nav.forge',
  video: 'nav.videoEditor',
  clips: 'nav.aiClips',
  hub: 'nav.aiClips',
  tools: 'nav.aiTools',
  content: 'nav.content',
  scripts: 'nav.scripts',
  library: 'nav.library',
  social: 'nav.connectAccounts',
  scheduler: 'nav.scheduler',
  calendar: 'nav.calendar',
  integrations: 'nav.integrations',
  workflows: 'nav.workflows',
  analytics: 'nav.analytics',
  creator: 'nav.creatorStats',
  trends: 'nav.discover',
  strategist: 'nav.strategist',
  insights: 'nav.aiInsights',
  roadmap: 'nav.roadmap',
  workspaces: 'nav.workspaces',
  projects: 'nav.projects',
  teams: 'nav.teams',
  billing: 'nav.billing',
  settings: 'nav.settings',
  notifications: 'nav.notifications',
  templates: 'nav.templates',
  quotes: 'nav.quotes',
  tasks: 'nav.tasks',
  approvals: 'nav.approvals',
  achievements: 'nav.achievements',
  jobs: 'nav.jobs',
  posts: 'nav.posts',
}

function segmentLabel(t: (k: string) => string, seg: string): string {
  const key = SEGMENT_LABEL_KEY[seg]
  // When a key exists, t() returns the translated value; when it doesn't,
  // pass the raw segment so t()'s humanise() turns e.g. "marketing-ai" into
  // a readable label rather than leaking the slug.
  return key ? t(key) : t(seg.replace(/-/g, ''))
}

export default function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { isDark, toggle } = useTheme()
  const { t } = useTranslation()
  const { ref, width } = useContainerWidth<HTMLElement>()

  const [userOpen, setUserOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Hide on auth screens + the immersive video editor (matches SidebarNav).
  const hidden =
    !pathname ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/' ||
    /^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)

  // Close popovers on outside click / route change / escape.
  useEffect(() => {
    setUserOpen(false)
    setOverflowOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!userOpen && !overflowOpen) return
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserOpen(false)
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setUserOpen(false); setOverflowOpen(false) }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [userOpen, overflowOpen])

  // Build title + breadcrumb from the route segments after /dashboard.
  const { title, crumbs } = useMemo(() => {
    if (!pathname) return { title: '', crumbs: [] as { label: string; href: string }[] }
    const segs = pathname.split('/').filter(Boolean) // e.g. ['dashboard','analytics','creator']
    if (segs.length <= 1) {
      return { title: t('nav.dashboard'), crumbs: [] }
    }
    const after = segs.slice(1) // drop the leading 'dashboard'
    const title = segmentLabel(t, after[after.length - 1])
    // Breadcrumb = the parent segments (everything before the last), each linkable.
    const crumbs: { label: string; href: string }[] = []
    let acc = '/dashboard'
    crumbs.push({ label: t('nav.dashboard'), href: acc })
    for (let i = 0; i < after.length - 1; i++) {
      acc += '/' + after[i]
      crumbs.push({ label: segmentLabel(t, after[i]), href: acc })
    }
    return { title, crumbs }
  }, [pathname, t])

  if (hidden) return null

  const openPalette = () => window.dispatchEvent(new CustomEvent('click-cmdk-open'))

  // Container breakpoints: below ~640 collapse search to an icon; below ~820
  // fold notifications + theme into an overflow menu. width===0 (pre-measure)
  // is treated as full to avoid a flash of the collapsed layout.
  const compactSearch = width > 0 && width < 640
  const compactActions = width > 0 && width < 820

  const initials = (user?.name || user?.username || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 ds-surface-card ds-elev-1 border-b border-[var(--glass-border)] !rounded-none backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16 min-w-0">
        {/* ── Title + breadcrumb ── */}
        <div className="flex flex-col min-w-0 flex-shrink">
          {crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1 ds-text-caption truncate">
              {crumbs.map((c, i) => (
                <span key={c.href} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight size={11} className="opacity-40 flex-shrink-0" aria-hidden="true" />}
                  <Link
                    href={c.href}
                    className="truncate hover:text-[var(--text-strong)] transition-colors focus-visible:outline-none focus-visible:underline"
                  >
                    {c.label}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <h1 className="ds-text-h3 text-[var(--text-strong)] truncate leading-tight">{title}</h1>
        </div>

        {/* ── Search / command trigger ── */}
        <div className="flex-1 flex justify-end min-w-0">
          {compactSearch ? (
            <IconButton
              aria-label={`${t('common.search')} (⌘K)`}
              variant="secondary"
              onClick={openPalette}
              className="ds-surface-subtle"
            >
              <Search size={18} aria-hidden="true" />
            </IconButton>
          ) : (
            <button
              type="button"
              onClick={openPalette}
              aria-label={`${t('common.search')} (⌘K)`}
              className="group w-full max-w-md flex items-center gap-2.5 px-3.5 h-10 rounded-xl ds-surface-subtle text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Search size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left ds-text-label truncate">{t('common.search')}…</span>
              <kbd className="flex items-center gap-0.5 ds-text-caption font-mono px-1.5 py-0.5 rounded-md bg-[var(--glass-surface-heavy)] border border-[var(--glass-border)]">
                <Command size={11} aria-hidden="true" />K
              </kbd>
            </button>
          )}
        </div>

        {/* ── Trailing actions ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!compactActions && (
            <>
              <IconButton
                aria-label={t('notificationsPage.title') || 'Notifications'}
                variant="ghost"
                onClick={() => router.push('/dashboard/notifications')}
              >
                <Bell size={18} aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                variant="ghost"
                onClick={toggle}
              >
                {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              </IconButton>
            </>
          )}

          {/* Overflow menu (narrow widths) */}
          {compactActions && (
            <div ref={overflowRef} className="relative">
              <IconButton
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
                variant="ghost"
                onClick={() => setOverflowOpen(v => !v)}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </IconButton>
              {overflowOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-52 p-1.5 ds-surface-elevated ds-elev-3 z-50 origin-top-right"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setOverflowOpen(false); router.push('/dashboard/notifications') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ds-text-label text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)] transition-colors"
                  >
                    <Bell size={16} aria-hidden="true" />
                    {t('notificationsPage.title') || 'Notifications'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setOverflowOpen(false); toggle() }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ds-text-label text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)] transition-colors"
                  >
                    {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                    {isDark ? 'Light mode' : 'Dark mode'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              aria-label={user?.name || user?.username || 'Account menu'}
              aria-haspopup="menu"
              aria-expanded={userOpen}
              onClick={() => setUserOpen(v => !v)}
              className={cn(
                'flex items-center gap-2 pl-1 pr-1 sm:pr-2 h-10 rounded-xl transition-colors hover:bg-[var(--glass-surface-heavy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                userOpen && 'bg-[var(--glass-surface-heavy)]'
              )}
            >
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                {initials}
              </span>
              {!compactActions && (
                <span className="hidden md:block ds-text-label text-[var(--text-strong)] max-w-[10rem] truncate">
                  {user?.name || user?.username || 'Creator'}
                </span>
              )}
            </button>
            {userOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 p-1.5 ds-surface-elevated ds-elev-3 z-50 origin-top-right"
              >
                <div className="px-3 py-2.5 mb-1 border-b border-[var(--glass-border)]">
                  <p className="ds-text-label text-[var(--text-strong)] truncate">{user?.name || user?.username || 'Creator'}</p>
                  {user?.email && <p className="ds-text-caption truncate">{user.email}</p>}
                </div>
                <Link
                  href="/dashboard/profile"
                  role="menuitem"
                  onClick={() => setUserOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ds-text-label text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)] transition-colors"
                >
                  <UserIcon size={16} aria-hidden="true" />
                  {t('profilePage.title') || 'Profile'}
                </Link>
                <Link
                  href="/dashboard/settings"
                  role="menuitem"
                  onClick={() => setUserOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg ds-text-label text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)] transition-colors"
                >
                  <Settings size={16} aria-hidden="true" />
                  {t('nav.settings')}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setUserOpen(false); logout() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg ds-text-label text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={16} aria-hidden="true" />
                  {t('common.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
