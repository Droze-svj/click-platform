'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight,
  // Studio
  LayoutDashboard, Video, Sparkles, FileText, BookOpen, Hammer,
  // Publish
  Send, CalendarDays, Workflow,
  // Grow
  BarChart3, Flame, Brain,
  // Manage
  FolderKanban, Users, Gem, Boxes, Plug, Compass,
  // Settings
  Settings, LogOut, Sun, Moon, Eye, EyeOff,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useLayoutPreferences } from '../contexts/LayoutPreferencesContext'
import ClickLogo from './ClickLogo'

// ── Zone definitions ───────────────────────────────────────────────────────
const ZONES = [
  {
    id: 'studio',
    label: 'Studio',
    emoji: '🎬',
    gradient: 'from-violet-600 to-purple-600',
    accent: 'text-[var(--tint-indigo-fg)]',
    activeBg: 'bg-[var(--tint-indigo-bg)] border-[var(--tint-indigo-edge)]',
    items: [
      { path: '/dashboard',             label: 'Home',         icon: LayoutDashboard, badge: null },
      { path: '/dashboard/onboarding',  label: 'Get Started',  icon: Compass,         badge: 'Start' },
      { path: '/dashboard/forge',       label: 'One-Click Forge', icon: Hammer,       badge: 'AI' },
      { path: '/dashboard/video',       label: 'Video Editor', icon: Video,           badge: 'AI' },
      { path: '/dashboard/content',     label: 'Content AI',   icon: Sparkles,        badge: null },
      { path: '/dashboard/scripts',     label: 'Scripts',      icon: FileText,        badge: null },
      { path: '/dashboard/library',     label: 'Asset Library',icon: BookOpen,        badge: null },
    ],
  },
  {
    id: 'publish',
    label: 'Publish',
    emoji: '🚀',
    gradient: 'from-amber-500 to-orange-500',
    accent: 'text-[var(--tint-amber-fg)]',
    activeBg: 'bg-[var(--tint-amber-bg)] border-[var(--tint-amber-edge)]',
    items: [
      { path: '/dashboard/scheduler',     label: 'Scheduler',    icon: Send,         badge: null },
      { path: '/dashboard/calendar',      label: 'Calendar',     icon: CalendarDays, badge: null },
      { path: '/dashboard/integrations',  label: 'Integrations', icon: Plug,         badge: 'New' },
      { path: '/dashboard/workflows',     label: 'Automations',  icon: Workflow,     badge: null },
    ],
  },
  {
    id: 'grow',
    label: 'Grow',
    emoji: '📈',
    gradient: 'from-emerald-500 to-teal-500',
    accent: 'text-[var(--tint-emerald-fg)]',
    activeBg: 'bg-[var(--tint-emerald-bg)] border-[var(--tint-emerald-edge)]',
    items: [
      { path: '/dashboard/analytics',            label: 'Analytics',         icon: BarChart3,  badge: null },
      { path: '/dashboard/analytics/creator',    label: 'Creator Stats',     icon: Flame,      badge: 'AI' },
      { path: '/dashboard/trends',               label: 'Discover',          icon: Flame,      badge: 'New' },
      { path: '/dashboard/strategist',           label: 'Strategist',        icon: Compass,    badge: 'AI' },
      { path: '/dashboard/insights',             label: 'AI Insights',       icon: Brain,      badge: null },
    ],
  },
  {
    id: 'manage',
    label: 'Manage',
    emoji: '⚙️',
    gradient: 'from-sky-500 to-blue-600',
    accent: 'text-[var(--tint-sky-fg)]',
    activeBg: 'bg-[var(--tint-sky-bg)] border-[var(--tint-sky-edge)]',
    items: [
      { path: '/dashboard/workspaces',   label: 'Workspaces',    icon: Boxes,        badge: 'New' },
      { path: '/dashboard/projects',     label: 'Projects',      icon: FolderKanban, badge: null },
      { path: '/dashboard/teams',        label: 'Team',          icon: Users,        badge: null },
      { path: '/dashboard/billing',      label: 'Billing',       icon: Gem,          badge: null },
    ],
  },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isDark, toggle } = useTheme()
  const { focusMode, toggleFocusMode } = useLayoutPreferences()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedZone, setExpandedZone] = useState<string | null>(() => {
    return ZONES.find(z => z.items.some(i => pathname?.startsWith(i.path) && i.path !== '/dashboard')) ?.id ?? 'studio'
  })

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(path)

  if (pathname === '/login' || pathname === '/register' || pathname === '/') return null
  if (pathname != null && /^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null

  const MOBILE_TABS = [
    { path: '/dashboard',           label: 'Home',    icon: LayoutDashboard },
    { path: '/dashboard/video',     label: 'Studio',  icon: Video },
    { path: '/dashboard/scheduler', label: 'Publish', icon: Send },
    { path: '/dashboard/settings',  label: 'Settings', icon: Settings },
  ]

  return (
    <>
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative hidden lg:flex flex-shrink-0 h-screen flex-col backdrop-blur-[var(--glass-blur)] bg-[var(--glass-surface)] border-r border-[var(--glass-border)] overflow-hidden z-40 transition-colors duration-500"
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-[var(--glass-border)]">
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ClickLogo size={32} showWordmark wordmarkClassName={isDark ? 'text-white' : 'text-slate-900'} />
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && <div className="mx-auto"><ClickLogo size={32} /></div>}
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="w-8 h-8 rounded-xl bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-heavy)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all ml-auto">
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && (
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="absolute -right-3 top-20 z-10 w-8 h-8 rounded-full bg-[var(--page-bg)] border border-[var(--glass-border-strong)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)] shadow-xl transition-all">
          <ChevronRight size={14} />
        </button>
      )}

      {/* ── Zone Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-2 px-3 custom-scrollbar">
        {ZONES.map(zone => {
          const isExpanded = expandedZone === zone.id && !collapsed
          const zoneActive = zone.items.some(i => isActive(i.path))

          return (
            <div key={zone.id} className="space-y-1">
              <button
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setExpandedZone(zone.id) }
                  else setExpandedZone(isExpanded ? null : zone.id)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${
                  zoneActive ? 'bg-[var(--glass-surface-heavy)] border border-[var(--glass-border-strong)] text-[var(--text-main)]' : 'text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--glass-surface)]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span className="text-lg">{zone.emoji}</span>
                {!collapsed && (
                  <>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] flex-1 text-left">{zone.label}</span>
                    <ChevronRight size={12} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                  </>
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-1 pl-3">
                    {zone.items.map(item => {
                      const active = isActive(item.path)
                      return (
                        <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${active ? `${zone.activeBg} ${zone.accent}` : 'text-[var(--text-dim)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--glass-surface)]'}`}>
                          <item.icon size={14} className={active ? zone.accent : 'text-[var(--text-dim)] group-hover:text-[var(--text-main)]'} />
                          <span className="flex-1">{item.label}</span>
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

      {/* ── Theme Toggle, Focus Mode & User ── */}
      <div className="p-4 space-y-3 border-t border-[var(--glass-border)]">
        <button onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all ${collapsed ? 'justify-center' : ''}`}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest flex-1 text-left">Theme</span>}
        </button>

        <button
          type="button"
          onClick={toggleFocusMode}
          // eslint-disable-next-line jsx-a11y/aria-proptypes -- jsx-a11y can't statically verify the runtime expression; React serialises the boolean to "true"/"false" correctly.
          aria-pressed={focusMode}
          aria-label={focusMode ? 'Disable focus mode' : 'Enable focus mode'}
          title={focusMode ? 'Focus mode on — calmer animations, secondary panels hidden' : 'Focus mode off — full animation density'}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${collapsed ? 'justify-center' : ''} ${focusMode ? 'bg-[var(--tint-indigo-bg)] border-[var(--tint-indigo-edge)] text-[var(--tint-indigo-fg)]' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
        >
          {focusMode ? <Eye size={16} /> : <EyeOff size={16} />}
          {!collapsed && <span className="text-[10px] font-black uppercase tracking-widest flex-1 text-left">Focus{focusMode ? ' · On' : ''}</span>}
        </button>

        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--glass-surface-heavy)] border border-[var(--glass-border)] ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shrink-0">{user?.name?.charAt(0) || 'U'}</div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-[var(--text-main)] truncate leading-none mb-1">{user?.name || 'Creator'}</p>
              <p className="text-[8px] font-bold text-[var(--tint-emerald-fg)] truncate uppercase tracking-widest">Active Plan</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} aria-label="Log out" className="p-2 text-[var(--tint-rose-fg)] hover:bg-[var(--tint-rose-bg)] rounded-lg transition-all"><LogOut size={14} /></button>
          )}
        </div>
      </div>
    </motion.aside>

    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--glass-surface)] backdrop-blur-[var(--glass-blur)] border-t border-[var(--glass-border)] flex items-center justify-around px-2 py-3 safe-area-pb transition-colors duration-500">
      {MOBILE_TABS.map(item => {
        const active = isActive(item.path)
        return (
          <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${active ? 'text-[var(--tint-indigo-fg)]' : 'text-[var(--text-dim)]'}`}>
            <item.icon size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  </>
  )
}
