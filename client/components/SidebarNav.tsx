'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { m, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight,
  // Zone headers
  Clapperboard, Rocket, TrendingUp, SlidersHorizontal,
  // Studio
  LayoutDashboard, Video, Sparkles, FileText, BookOpen, Hammer, Film, Wand2, Scissors, SplitSquareHorizontal,
  // Publish
  Send, CalendarDays, Workflow, Bot, Gauge, MessagesSquare,
  // Grow
  BarChart3, Flame, Brain, Recycle, Award, Target, LineChart,
  // Manage
  FolderKanban, Users, Gem, Boxes, Plug, Compass, Share2, FlaskConical, Fingerprint,
  // Settings
  Settings, LogOut, Sun, Moon, Eye, EyeOff,
  Search, Pin, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useLayoutPreferences } from '../contexts/LayoutPreferencesContext'
import { useWorkspacePrefs } from '../hooks/useWorkspacePrefs'
import { Badge } from './ui'
import { cn } from '../lib/utils'
import ClickLogo from './ClickLogo'
import { useTranslation } from '../hooks/useTranslation'

// ── Zone definitions ───────────────────────────────────────────────────────
// `icon` is a lucide component (emoji zone headers were replaced for the 2026
// system). `accent` drives the active item color; it stays per-zone so each
// section keeps a subtle, calm identity.
//
// PROGRESSIVE DISCLOSURE
// The sidebar used to list all 41 destinations at once, which made the most
// common jobs no easier to find than the rarest. Each zone now shows a small
// PRIMARY set by default; everything else stays in the product, one "More"
// click away, and any of it can be pinned up into the primary set (stored
// server-side, so the arrangement follows the user across devices).
//
// Nothing was deleted. `primary: false` means "still here, just not shouting".
type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge: string | null
  /** Shown without expanding "More". */
  primary?: boolean
}
type Zone = { id: string; label: string; icon: LucideIcon; accent: string; activeBg: string; items: NavItem[] }

const getZones = (t: (k: string) => string): Zone[] => [
  {
    id: 'studio',
    label: t('nav.studio') || 'Studio',
    icon: Clapperboard,
    accent: 'text-primary-600 dark:text-primary-400',
    activeBg: 'bg-primary-500/10 border-primary-500/20',
    items: [
      { path: '/dashboard',             label: t('nav.dashboard') || 'Home',         icon: LayoutDashboard, badge: null,  primary: true },
      { path: '/dashboard/forge',       label: t('nav.forge') || 'AI Video Creator', icon: Hammer,          badge: 'AI',  primary: true },
      { path: '/dashboard/video',       label: t('nav.videoEditor') || 'Video Editor', icon: Video,         badge: 'AI',  primary: true },
      // One Clips destination. /clips/auto and the /clips landing are reachable
      // as modes inside the hub rather than as three sidebar siblings.
      { path: '/dashboard/clips/hub',   label: t('nav.clips') || 'Clips',            icon: Film,            badge: 'New', primary: true },
      { path: '/dashboard/library',     label: t('nav.library') || 'Asset Library',  icon: BookOpen,        badge: null,  primary: true },

      { path: '/dashboard/onboarding',  label: t('nav.onboarding') || 'Get Started', icon: Compass,         badge: 'Start' },
      { path: '/dashboard/content',     label: t('nav.content') || 'Content AI',     icon: Sparkles,        badge: null },
      { path: '/dashboard/scripts',     label: t('nav.scripts') || 'Scripts',        icon: FileText,        badge: null },
      { path: '/dashboard/tools',       label: t('nav.aiTools') || 'AI Tools',       icon: Wand2,           badge: 'New' },
      { path: '/dashboard/tools/hook-ab', label: t('nav.hookAb') || 'Hook A/B Lab',  icon: SplitSquareHorizontal, badge: 'AI' },
      // GET /api/toolbox + POST /api/toolbox/execute — live endpoints whose only
      // client was never imported.
      { path: '/dashboard/toolbox',     label: t('nav.toolbox') || 'Toolbox',        icon: Wand2,           badge: 'New' },
      { path: '/dashboard/clips/auto',  label: t('nav.autoClips') || 'Auto Clips',   icon: Scissors,        badge: 'AI' },
    ],
  },
  {
    id: 'publish',
    label: t('nav.publish') || 'Publish',
    icon: Rocket,
    accent: 'text-amber-600 dark:text-amber-400',
    activeBg: 'bg-amber-500/10 border-amber-500/20',
    items: [
      { path: '/dashboard/scheduler',     label: t('nav.scheduler') || 'Scheduler',  icon: Send,         badge: null,   primary: true },
      { path: '/dashboard/calendar',      label: t('nav.calendar') || 'Calendar',    icon: CalendarDays, badge: null,   primary: true },
      { path: '/dashboard/autopilot',     label: t('nav.autopilot') || 'Autopilot',  icon: Bot,          badge: 'AI',   primary: true },
      { path: '/dashboard/social',        label: t('nav.connectAccounts') || 'Connect Accounts', icon: Share2, badge: 'Setup', primary: true },

      { path: '/dashboard/features',      label: t('nav.creatorTools') || 'Creator Tools', icon: Sparkles, badge: 'New' },
      { path: '/dashboard/calendar/capacity', label: t('nav.capacity') || 'Capacity', icon: Gauge,       badge: 'New' },
      { path: '/dashboard/approvals/collaborate', label: t('nav.approvalThreads') || 'Approval Threads', icon: MessagesSquare, badge: null },
      { path: '/dashboard/recurring',     label: t('nav.recurring') || 'Recurring Posts', icon: Recycle,  badge: null },
      { path: '/dashboard/integrations',  label: t('nav.integrations') || 'Integrations', icon: Plug,    badge: 'New' },
      { path: '/dashboard/workflows',     label: t('nav.workflows') || 'Automations', icon: Workflow,    badge: null },
    ],
  },
  {
    id: 'grow',
    label: t('nav.grow') || 'Grow',
    icon: TrendingUp,
    accent: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-500/10 border-emerald-500/20',
    items: [
      { path: '/dashboard/analytics',            label: t('nav.analytics') || 'Analytics',   icon: BarChart3, badge: null, primary: true },
      { path: '/dashboard/trends',               label: t('nav.discover') || 'Discover',     icon: Flame,     badge: 'New', primary: true },
      { path: '/dashboard/strategist',           label: t('nav.strategist') || 'Strategist', icon: Compass,   badge: 'AI',  primary: true },
      // Was reachable only by typing the URL — the page that shows a creator
      // what Click has actually learned about them.
      { path: '/dashboard/creator-dna',          label: t('nav.creatorDna') || 'Creator DNA', icon: Fingerprint, badge: 'New', primary: true },
      // Trend intelligence + success prediction (/api/video/neural/*), built and
      // unreachable until 2026-08.
      { path: '/dashboard/neural',               label: t('nav.neural') || 'Trend Intelligence', icon: Brain, badge: 'AI' },
      { path: '/dashboard/click-learning',       label: t('nav.clickLearning') || 'What Click Learned', icon: Brain, badge: null },
      // /api/suggestions/enhanced/* — four live endpoints whose only client was
      // never imported. SmartSuggestions already linked here before the route existed.
      { path: '/dashboard/suggestions',          label: t('nav.suggestions') || 'Suggestions', icon: Sparkles, badge: 'AI' },

      { path: '/dashboard/analytics/creator',    label: t('nav.creatorStats') || 'Creator Stats', icon: Flame, badge: 'AI' },
      { path: '/dashboard/analytics/engagement', label: t('nav.engagement') || 'Engagement',  icon: LineChart, badge: null },
      { path: '/dashboard/insights',             label: t('nav.aiInsights') || 'AI Insights', icon: Brain,     badge: null },
      // Built (28KB, ten /api/content-operations endpoints) and imported by nothing
      // until 2026-08 — benchmarks, competitor compare, content gaps, portfolio
      // health, next-week planning.
      { path: '/dashboard/content/operations',   label: t('nav.contentOps') || 'Content Ops', icon: Gauge,     badge: 'New' },
      { path: '/dashboard/trends/repurpose',     label: t('nav.trendRepurpose') || 'Trend Repurpose', icon: Recycle, badge: 'AI' },
      { path: '/dashboard/growth/seo',           label: t('nav.seoScorecard') || 'SEO Scorecard', icon: Award, badge: 'New' },
      { path: '/dashboard/growth/keywords',      label: t('nav.keywords') || 'Keywords',      icon: Target,    badge: 'New' },
      { path: '/dashboard/growth/outliers',      label: t('nav.outliers') || 'Outliers',      icon: LineChart, badge: 'AI' },
      { path: '/dashboard/growth/channel',       label: t('nav.channelAudit') || 'Channel Audit', icon: Gauge, badge: 'New' },
      { path: '/dashboard/roadmap',              label: t('nav.roadmap') || 'Roadmap',        icon: Sparkles,  badge: null },
    ],
  },
  {
    id: 'manage',
    label: t('nav.manage') || 'Manage',
    icon: SlidersHorizontal,
    accent: 'text-sky-600 dark:text-sky-400',
    activeBg: 'bg-sky-500/10 border-sky-500/20',
    items: [
      { path: '/dashboard/projects',     label: t('nav.projects') || 'Projects',   icon: FolderKanban, badge: null,    primary: true },
      { path: '/dashboard/teams',        label: t('nav.teams') || 'Team',          icon: Users,        badge: null,    primary: true },
      { path: '/dashboard/billing',      label: t('nav.billing') || 'Billing',     icon: Gem,          badge: null,    primary: true },

      { path: '/dashboard/workspaces',   label: t('nav.workspaces') || 'Workspaces', icon: Boxes,      badge: 'New' },
      { path: '/dashboard/jobs',         label: t('nav.jobs') || 'Jobs',           icon: Workflow,     badge: null },
      { path: '/dashboard/membership',   label: t('nav.membership') || 'Membership', icon: Gem,        badge: null },
      // Experimental surfaces, gathered here instead of scattered or unreachable.
      { path: '/dashboard/labs',         label: t('nav.labs') || 'Labs',           icon: FlaskConical, badge: 'Early' },
    ],
  },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isDark, toggle } = useTheme()
  const { t } = useTranslation()
  const { focusMode, toggleFocusMode } = useLayoutPreferences()
  const [collapsed, setCollapsed] = useState(false)
  // Zones whose "More" section is expanded this session.
  const [showAll, setShowAll] = useState<string[]>([])
  const { prefs, isPinned, togglePin } = useWorkspacePrefs()
  
  const ZONES = getZones(t)

  const [expandedZone, setExpandedZone] = useState<string | null>(() => {
    return ZONES.find(z => z.items.some(i => pathname?.startsWith(i.path) && i.path !== '/dashboard')) ?.id ?? 'studio'
  })

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(path)

  // ── Progressive disclosure ───────────────────────────────────────────────
  // An item shows in the collapsed zone if it's PRIMARY, the user PINNED it, or
  // it's the page they're currently on (so the active item is never hidden
  // behind "More" — that would leave the sidebar with nothing highlighted).
  const isVisible = (zone: Zone, item: NavItem) =>
    Boolean(item.primary) || isPinned(item.path) || Boolean(isActive(item.path))

  const visibleItems = (zone: Zone) => {
    const items = zone.items.filter(i => isVisible(zone, i))
    // Pinned items sort to the top, in the order the user pinned them.
    return items.sort((a, b) => {
      const ai = prefs.pinnedNav.indexOf(a.path)
      const bi = prefs.pinnedNav.indexOf(b.path)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return 0
    })
  }

  const hiddenCount = (zone: Zone) => zone.items.filter(i => !isVisible(zone, i)).length

  const toggleZoneMore = (zoneId: string) =>
    setShowAll(prev => (prev.includes(zoneId) ? prev.filter(z => z !== zoneId) : [...prev, zoneId]))

  const renderItem = (zone: Zone, item: NavItem) => {
    const active = isActive(item.path)
    const ItemIcon = item.icon
    const pinned = isPinned(item.path)

    return (
      <div key={item.path} className="relative group/item">
        <Link
          href={item.path}
          aria-current={active ? 'page' : undefined}
          title={item.label}
          // Name the link by its label alone. The badge is decorative emphasis
          // ("New", "AI"); letting it into the accessible name makes every
          // destination read as "Clips New" to a screen reader.
          aria-label={item.label}
          className={cn(
            'relative flex items-center gap-3 px-3 py-2 pr-8 rounded-lg ds-text-label transition-colors',
            active
              ? cn(zone.activeBg, zone.accent, 'border')
              : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)]'
          )}
        >
          <ItemIcon size={16} className={cn('flex-shrink-0', active ? zone.accent : 'opacity-70 group-hover/item:opacity-100')} aria-hidden="true" />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <Badge
              variant="secondary"
              aria-hidden="true"
              className="px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
            >
              {item.badge}
            </Badge>
          )}
        </Link>

        {/* Pin toggle. Hidden until hover/focus so the rail stays calm, but
            always reachable by keyboard. Home is not pinnable — it's always
            first anyway. */}
        {item.path !== '/dashboard' && (
          <button
            type="button"
            onClick={() => togglePin(item.path)}
            aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label} to the sidebar`}
            aria-pressed={pinned}
            className={cn(
              'absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pinned
                ? 'opacity-100 text-[var(--text-strong)]'
                : 'opacity-0 group-hover/item:opacity-70 focus:opacity-100 hover:!opacity-100 text-[var(--text-muted)]'
            )}
          >
            <Pin size={12} className={cn(pinned && 'fill-current')} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  if (pathname === '/login' || pathname === '/register' || pathname === '/') return null
  if (pathname != null && /^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null

  const MOBILE_TABS = [
    { path: '/dashboard',           label: t('nav.dashboard') || 'Home',    icon: LayoutDashboard },
    { path: '/dashboard/video',     label: t('nav.videoEditor') || 'Video Editor',  icon: Video },
    { path: '/dashboard/scheduler', label: t('nav.publish') || 'Publish', icon: Send },
    { path: '/dashboard/settings',  label: t('nav.settings') || 'Settings', icon: Settings },
  ]

  return (
    <>
    <m.aside
      animate={{ width: collapsed ? 84 : 280 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="relative hidden lg:flex flex-shrink-0 h-screen flex-col ds-surface-card !rounded-none border-y-0 border-l-0 border-r border-[var(--glass-border)] backdrop-blur-xl overflow-hidden z-40"
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--glass-border)]">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <m.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <ClickLogo size={36} showWordmark wordmarkClassName={isDark ? 'text-white' : 'text-slate-900'} />
            </m.div>
          )}
        </AnimatePresence>
        {collapsed && <div className="mx-auto"><ClickLogo size={32} /></div>}
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} title="Collapse sidebar" aria-label="Collapse sidebar" className="w-9 h-9 rounded-lg ds-surface-subtle flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border-strong)] transition-colors ml-auto group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {collapsed && (
        <button type="button" onClick={() => setCollapsed(false)} title="Expand sidebar" aria-label="Expand sidebar" className="absolute -right-3 top-[4.5rem] z-50 w-7 h-7 rounded-full ds-surface-elevated ds-elev-2 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ChevronRight size={15} />
        </button>
      )}

      {/* ── Search Trigger ── */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('click-cmdk-open'))}
            aria-label={`${t('common.search')} (⌘K)`}
            className="w-full flex items-center gap-2.5 px-3.5 h-10 rounded-xl ds-surface-subtle text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border-strong)] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Search size={16} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left ds-text-label truncate">{t('common.search')}…</span>
            <kbd className="ds-text-caption font-mono px-1.5 py-0.5 rounded-md bg-[var(--glass-surface-heavy)] border border-[var(--glass-border)]">⌘K</kbd>
          </button>
        </div>
      )}

      {/* ── Zone Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1.5 px-3 custom-scrollbar scroll-smooth">
        {ZONES.map(zone => {
          const isExpanded = expandedZone === zone.id && !collapsed
          const zoneActive = zone.items.some(i => isActive(i.path))
          const ZoneIcon = zone.icon

          return (
            <div key={zone.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setExpandedZone(zone.id) }
                  else setExpandedZone(isExpanded ? null : zone.id)
                }}
                title={zone.label}
                aria-label={zone.label}
                aria-expanded={isExpanded}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group',
                  collapsed && 'justify-center',
                  zoneActive
                    ? 'bg-[var(--glass-surface-heavy)] text-[var(--text-strong)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)]'
                )}
              >
                <ZoneIcon size={18} className={cn('flex-shrink-0', zoneActive && zone.accent)} aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="ds-text-label flex-1 text-left">{zone.label}</span>
                    <ChevronRight size={14} className={cn('transition-transform duration-300 opacity-50', isExpanded && 'rotate-90 opacity-100')} aria-hidden="true" />
                  </>
                )}
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden space-y-0.5 pl-3"
                  >
                    {visibleItems(zone).map(item => renderItem(zone, item))}

                    {/* Everything else in this zone — still in the product, one
                        click away, and pinnable up into the list above. */}
                    {hiddenCount(zone) > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleZoneMore(zone.id)}
                          aria-expanded={showAll.includes(zone.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg ds-text-label text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] hover:bg-[var(--glass-surface-heavy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <MoreHorizontal size={16} className="flex-shrink-0 opacity-70" aria-hidden="true" />
                          <span className="flex-1 text-left">
                            {showAll.includes(zone.id)
                              ? (t('nav.showLess') || 'Show less')
                              : `${t('nav.more') || 'More'} (${hiddenCount(zone)})`}
                          </span>
                        </button>

                        {showAll.includes(zone.id) &&
                          zone.items
                            .filter(i => !isVisible(zone, i))
                            .map(item => renderItem(zone, item))}
                      </>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* ── Theme Toggle, Focus Mode & User ── */}
      <div className="p-3 space-y-2 border-t border-[var(--glass-border)]">
        <div className={cn('grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          <button
            type="button"
            onClick={toggle}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center h-10 rounded-xl ds-surface-subtle text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border-strong)] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isDark ? (
              <Sun size={18} className="group-hover:rotate-45 transition-transform duration-500" aria-hidden="true" />
            ) : (
              <Moon size={18} className="group-hover:-rotate-12 transition-transform duration-500" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFocusMode}
            title={focusMode ? 'Focus mode on — click to disable' : 'Focus mode off — click to enable'}
            aria-label={focusMode ? 'Focus mode on — click to disable' : 'Focus mode off — click to enable'}
            aria-pressed={focusMode}
            className={cn(
              'flex items-center justify-center h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              focusMode
                ? 'bg-primary-500/10 border border-primary-500/30 text-primary-600 dark:text-primary-400'
                : 'ds-surface-subtle text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:border-[var(--glass-border-strong)]'
            )}
          >
            {focusMode ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
          </button>
        </div>

        <div className={cn('flex items-center gap-3 px-2.5 py-2.5 rounded-xl ds-surface-subtle', collapsed && 'justify-center px-0')}>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            {user?.email_verified && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--glass-surface)] flex items-center justify-center" title="Email verified">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="ds-text-label text-[var(--text-strong)] truncate leading-tight">{user?.name || 'Creator'}</p>
              <p className="ds-text-caption truncate leading-tight">{user?.subscription?.plan || 'Creator'}</p>
            </div>
          )}
          {!collapsed && (
            <button type="button" onClick={logout} title="Log out" aria-label="Log out" className="w-9 h-9 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <LogOut size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.35); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
      `}</style>
    </m.aside>

    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 ds-surface-card !rounded-none border-x-0 border-b-0 border-t border-[var(--glass-border)] backdrop-blur-xl flex items-center justify-around px-3 py-2.5 safe-area-pb">
      {MOBILE_TABS.map(item => {
        const active = isActive(item.path)
        const TabIcon = item.icon
        return (
          <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-colors',
              active
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20'
                : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-strong)]'
            )}>
            <TabIcon size={20} aria-hidden="true" />
            <span className="ds-text-caption font-semibold">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  </>
  )
}
