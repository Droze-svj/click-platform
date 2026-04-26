'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight,
  // Studio
  LayoutDashboard, Video, Sparkles, FileText, Quote, BookOpen, Wand2, Hammer, Palette,
  // Publish
  Send, CalendarDays, Workflow, RefreshCw,
  // Grow
  BarChart3, TrendingUp, Target, Flame, Brain, Activity, Megaphone,
  // Manage
  FolderKanban, Users, CheckSquare, ThumbsUp, Gem, Trophy, Boxes, Plug, Compass,
  // Settings
  Settings, Bell, LogOut, HelpCircle, Sun, Moon, Monitor, Search,
} from 'lucide-react'
import ThemeToggle from './DarkModeToggle'
import { useTheme } from './ThemeProvider'
import ClickLogo from './ClickLogo'

// ── Zone definitions ───────────────────────────────────────────────────────
const ZONES = [
  {
    id: 'studio',
    label: 'Studio',
    emoji: '🎬',
    gradient: 'from-violet-600 to-purple-600',
    accent: 'text-violet-400',
    activeBg: 'bg-violet-600/15 border-violet-500/30',
    items: [
      { path: '/dashboard',             label: 'Home',         icon: LayoutDashboard, badge: null },
      { path: '/dashboard/onboarding',  label: 'Get Started',  icon: Compass,         badge: 'Start' },
      { path: '/dashboard/forge',       label: 'One-Click Forge', icon: Hammer,       badge: 'AI' },
      { path: '/dashboard/video',       label: 'Video Editor', icon: Video,           badge: 'AI' },
      { path: '/dashboard/content',     label: 'Content AI',   icon: Sparkles,        badge: null },
      { path: '/dashboard/scripts',     label: 'Scripts',      icon: FileText,        badge: null },
      { path: '/dashboard/quotes',      label: 'Quote Cards',  icon: Quote,           badge: null },
      { path: '/dashboard/library',     label: 'Asset Library',icon: BookOpen,        badge: null },
      { path: '/dashboard/templates',   label: 'Templates',    icon: Wand2,           badge: null },
      { path: '/dashboard/brand-kit',   label: 'Brand Kit',    icon: Palette,         badge: null },
    ],
  },
  {
    id: 'publish',
    label: 'Publish',
    emoji: '🚀',
    gradient: 'from-amber-500 to-orange-500',
    accent: 'text-amber-400',
    activeBg: 'bg-amber-600/15 border-amber-500/30',
    items: [
      { path: '/dashboard/scheduler',     label: 'Scheduler',    icon: Send,         badge: null },
      { path: '/dashboard/calendar',      label: 'Calendar',     icon: CalendarDays, badge: null },
      { path: '/dashboard/integrations',  label: 'Integrations', icon: Plug,         badge: 'New' },
      { path: '/dashboard/workflows',     label: 'Automations',  icon: Workflow,     badge: null },
      { path: '/dashboard/recycling',     label: 'Content Remix',icon: RefreshCw,    badge: null },
    ],
  },
  {
    id: 'grow',
    label: 'Grow',
    emoji: '📈',
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'text-emerald-400',
    activeBg: 'bg-emerald-600/15 border-emerald-500/30',
    items: [
      { path: '/dashboard/analytics',            label: 'Analytics',         icon: BarChart3,  badge: null },
      { path: '/dashboard/analytics/creator',    label: 'Creator Stats',     icon: Flame,      badge: 'AI' },
      { path: '/dashboard/analytics/engagement', label: 'Command Center',    icon: Activity,   badge: 'Live' },
      { path: '/dashboard/trends',               label: 'Discover',          icon: Flame,      badge: 'New' },
      { path: '/dashboard/insights',             label: 'AI Insights',       icon: Brain,      badge: null },
      { path: '/dashboard/marketing-ai',         label: 'Marketing Oracle',  icon: Megaphone,  badge: 'AI' },
      { path: '/dashboard/niche',                label: 'Niche Intel',       icon: Target,     badge: null },
      { path: '/dashboard/social',               label: 'Social Sync',       icon: TrendingUp, badge: null },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    emoji: '⚙️',
    gradient: 'from-sky-500 to-blue-600',
    accent: 'text-sky-400',
    activeBg: 'bg-sky-600/15 border-sky-500/30',
    items: [
      { path: '/dashboard/workspaces',   label: 'Workspaces',    icon: Boxes,        badge: 'New' },
      { path: '/dashboard/posts',        label: 'Posts',         icon: BookOpen,     badge: null },
      { path: '/dashboard/projects',     label: 'Projects',      icon: FolderKanban, badge: null },
      { path: '/dashboard/teams',        label: 'Team',          icon: Users,        badge: null },
      { path: '/dashboard/tasks',        label: 'Tasks',         icon: CheckSquare,  badge: null },
      { path: '/dashboard/approvals',    label: 'Approvals',     icon: ThumbsUp,     badge: null },
      { path: '/dashboard/achievements', label: 'Achievements',  icon: Trophy,       badge: null },
      { path: '/dashboard/billing',      label: 'Billing',       icon: Gem,          badge: null },
      { path: '/dashboard/membership',   label: 'Membership',    icon: Gem,          badge: null },
    ],
  },
]

const BOTTOM_ITEMS = [
  { path: '/dashboard/search',        label: 'Search',   icon: Search,      badge: null },
  { path: '/dashboard/notifications', label: 'Alerts',   icon: Bell,        badge: null },
  { path: '/dashboard/settings',      label: 'Settings', icon: Settings,    badge: null },
  { path: '/dashboard/ai',            label: 'AI Help',  icon: HelpCircle,  badge: null },
]

// ── Component ──────────────────────────────────────────────────────────────
export default function SidebarNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedZone, setExpandedZone] = useState<string | null>(() => {
    // Auto-expand the zone that matches current route
    return ZONES.find(z => z.items.some(i => pathname?.startsWith(i.path) && i.path !== '/dashboard')) ?.id ?? 'studio'
  })

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(path)

  if (pathname === '/login' || pathname === '/register' || pathname === '/') return null
  // Hide on the video edit full-screen page
  if (pathname != null && /^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null

  // ── Mobile bottom items ──
  const MOBILE_TABS = [
    { path: '/dashboard',           label: 'Home',    icon: LayoutDashboard },
    { path: '/dashboard/video',     label: 'Studio',  icon: Video },
    { path: '/dashboard/scheduler', label: 'Publish', icon: Send },
    { path: '/dashboard/analytics', label: 'Grow',    icon: BarChart3 },
    { path: '/dashboard/settings',  label: 'More',    icon: Settings },
  ]

  return (
    <>
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="relative hidden lg:flex flex-shrink-0 h-screen flex-col backdrop-blur-3xl bg-white/[0.02] border-r border-white-[0.05] overflow-hidden z-40"
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.06]">
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ClickLogo
                size={32}
                showWordmark
                wordmarkClassName={isDark ? 'text-white' : 'text-slate-900'}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="mx-auto">
            <ClickLogo size={28} />
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all ml-auto"
            title="Collapse sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {/* Expand button (only visible when collapsed) */}
      {collapsed && (
        <button onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-[72px] z-10 w-6 h-6 rounded-full bg-[#080810] border border-white/20 flex items-center justify-center text-slate-400 hover:text-white shadow-xl transition-all"
          title="Expand sidebar"
        >
          <ChevronRight size={11} />
        </button>
      )}

      {/* ── Zone Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 px-2 custom-scrollbar">
        {ZONES.map(zone => {
          const isExpanded = expandedZone === zone.id && !collapsed
          const zoneActive = zone.items.some(i => isActive(i.path))

          return (
            <div key={zone.id}>
              {/* Zone header pill */}
              <button
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setExpandedZone(zone.id) }
                  else setExpandedZone(isExpanded ? null : zone.id)
                }}
                title={zone.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all group ${
                  zoneActive
                    ? isDark
                      ? `bg-white/[0.03] border border-white/10 text-white shadow-lg`
                      : `bg-white shadow-sm border border-black/5 text-slate-900`
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.02]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span className={`text-base ${collapsed ? '' : 'shrink-0'}`}>{zone.emoji}</span>
                {!collapsed && (
                  <>
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] flex-1 text-left ${zoneActive ? isDark ? 'text-white' : 'text-slate-900' : ''}`}>
                      {zone.label}
                    </span>
                    <ChevronRight size={11} className={`transition-transform duration-200 text-slate-600 ${isExpanded ? 'rotate-90' : ''}`} />
                  </>
                )}
              </button>

              {/* Zone items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden mt-0.5 space-y-0.5 pl-2"
                  >
                    {zone.items.map(item => {
                      const active = isActive(item.path)
                      return (
                        <Link key={item.path} href={item.path}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all group border ${
                            active
                              ? `bg-white/[0.05] border-white/10 text-white shadow-md`
                              : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.02] border-transparent'
                          }`}
                        >
                          <item.icon size={13} className={active ? zone.accent : 'text-slate-600 group-hover:text-slate-400'} />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                              item.badge === 'AI'   ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' :
                              item.badge === 'New'  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                              item.badge === 'Live' ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20 animate-pulse' :
                              'bg-white/5 text-slate-500'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* ── Cmd+K hint ── */}
      <div className="border-t border-white/[0.06] px-2 pt-3 pb-1">
        <button
          type="button"
          onClick={() => {
            // Same key combo we listen for in GlobalCommandPalette
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))
          }}
          title="Open command palette (⌘K)"
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-colors text-slate-500 hover:text-white hover:bg-white/[0.04] ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Search size={13} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Quick search</span>
              <kbd className="text-[9px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Bottom Items ── */}
      <div className="px-2 py-3 space-y-0.5 relative group/bottom">
        {BOTTOM_ITEMS.map(item => {
          const active = isActive(item.path)
          return (
            <Link key={item.path} href={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                collapsed ? 'justify-center' : ''
              } ${active ? 'bg-white/[0.08] text-white shadow-sm' : 'text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]'}`}
            >
              <item.icon size={13} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* Theme toggle integrated into bottom */}
        <div className={`mt-2 flex items-center ${collapsed ? 'justify-center' : 'px-3 gap-2.5'}`}>
          <ThemeToggle size="sm" showLabel={false} />
          {!collapsed && <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Theme</span>}
        </div>
      </div>

      {/* ── User Profile Strip ── */}
      <div className={`flex items-center gap-2.5 px-3 py-3 border-t border-white/[0.06] ${collapsed ? 'justify-center' : ''}`}>
        <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${isDark ? 'from-indigo-400 to-purple-600' : 'from-indigo-600 to-purple-800'} flex items-center justify-center text-white font-black text-xs shadow-md flex-shrink-0`}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black ${isDark ? 'text-white' : 'text-slate-900'} truncate leading-tight`}>{user?.name || 'Creator'}</p>
            <p className={`text-[8px] font-bold truncate ${
              user?.subscription?.status === 'active' ? 'text-emerald-400' :
              user?.subscription?.status === 'trial'  ? 'text-amber-400' : 'text-slate-600'
            }`}>
              {user?.subscription?.plan || 'Free Plan'}
            </p>
          </div>
        )}
        {!collapsed && (
          <button onClick={logout} title="Sign out"
            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0"
          >
            <LogOut size={12} />
          </button>
        )}
      </div>
    </motion.aside>

    {/* ── Mobile Bottom Tab Bar ── */}
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 click-sidebar backdrop-blur-xl border-t safe-area-pb flex items-center justify-around px-2 py-2">
      {MOBILE_TABS.map(item => {
        const active = isActive(item.path)
        return (
          <Link key={item.path} href={item.path}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
              active ? isDark ? 'text-white bg-white/[0.08]' : 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-slate-300'
            }`}
          >
            <item.icon size={18} className={active ? isDark ? 'text-indigo-400' : 'text-indigo-600' : ''} />
            <span className={`text-[8px] font-black uppercase tracking-wider ${active && !isDark ? 'text-indigo-600' : ''}`}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  </>
  )
}
