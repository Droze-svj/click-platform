'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight,
  // Studio
  LayoutDashboard, Video, Sparkles, FileText, BookOpen, Hammer, Film, Wand2,
  // Publish
  Send, CalendarDays, Workflow,
  // Grow
  BarChart3, Flame, Brain,
  // Manage
  FolderKanban, Users, Gem, Boxes, Plug, Compass, Share2,
  // Settings
  Settings, LogOut, Sun, Moon, Eye, EyeOff,
  Search
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { useLayoutPreferences } from '../contexts/LayoutPreferencesContext'
import ClickLogo from './ClickLogo'
import { useTranslation } from '../hooks/useTranslation'

// ── Zone definitions ───────────────────────────────────────────────────────
const getZones = (t: (k: string) => string) => [
  {
    id: 'studio',
    label: t('nav.studio') || 'Studio',
    emoji: '🎬',
    gradient: 'from-primary-500/10 to-indigo-600/10',
    accent: 'text-primary-600 dark:text-primary-400',
    activeBg: 'bg-primary-500/5 dark:bg-primary-500/10 border-primary-500/10 dark:border-primary-500/20',
    items: [
      { path: '/dashboard',             label: t('nav.dashboard') || 'Home',         icon: LayoutDashboard, badge: null },
      { path: '/dashboard/onboarding',  label: t('nav.onboarding') || 'Get Started', icon: Compass,         badge: 'Start' },
      { path: '/dashboard/forge',       label: t('nav.forge') || 'AI Video Creator', icon: Hammer,       badge: 'AI' },
      { path: '/dashboard/video',       label: t('nav.videoEditor') || 'Video Editor', icon: Video,           badge: 'AI' },
      { path: '/dashboard/clips/hub',   label: t('nav.aiClips') || 'AI Clips',     icon: Film,            badge: 'New' },
      { path: '/dashboard/tools',       label: t('nav.aiTools') || 'AI Tools',     icon: Wand2,           badge: 'New' },
      { path: '/dashboard/content',     label: t('nav.content') || 'Content AI',   icon: Sparkles,        badge: null },
      { path: '/dashboard/scripts',     label: t('nav.scripts') || 'Scripts',      icon: FileText,        badge: null },
      { path: '/dashboard/library',     label: t('nav.library') || 'Asset Library',icon: BookOpen,        badge: null },
    ],
  },
  {
    id: 'publish',
    label: t('nav.publish') || 'Publish',
    emoji: '🚀',
    gradient: 'from-amber-500/10 to-orange-500/10',
    accent: 'text-amber-600 dark:text-amber-400',
    activeBg: 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/10 dark:border-amber-500/20',
    items: [
      { path: '/dashboard/social',        label: t('nav.connectAccounts') || 'Connect Accounts', icon: Share2,    badge: 'Setup' },
      { path: '/dashboard/scheduler',     label: t('nav.scheduler') || 'Scheduler',    icon: Send,         badge: null },
      { path: '/dashboard/calendar',      label: t('nav.calendar') || 'Calendar',     icon: CalendarDays, badge: null },
      { path: '/dashboard/integrations',  label: t('nav.integrations') || 'Integrations', icon: Plug,         badge: 'New' },
      { path: '/dashboard/workflows',     label: t('nav.workflows') || 'Automations',  icon: Workflow,     badge: null },
    ],
  },
  {
    id: 'grow',
    label: t('nav.grow') || 'Grow',
    emoji: '📈',
    gradient: 'from-emerald-500/10 to-teal-500/10',
    accent: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/10 dark:border-emerald-500/20',
    items: [
      { path: '/dashboard/analytics',            label: t('nav.analytics') || 'Analytics',         icon: BarChart3,  badge: null },
      { path: '/dashboard/analytics/creator',    label: t('nav.creatorStats') || 'Creator Stats',     icon: Flame,      badge: 'AI' },
      { path: '/dashboard/trends',               label: t('nav.discover') || 'Discover',          icon: Flame,      badge: 'New' },
      { path: '/dashboard/strategist',           label: t('nav.strategist') || 'Strategist',        icon: Compass,    badge: 'AI' },
      { path: '/dashboard/insights',             label: t('nav.aiInsights') || 'AI Insights',       icon: Brain,      badge: null },
      { path: '/dashboard/roadmap',              label: t('nav.roadmap') || 'Roadmap',           icon: Sparkles,   badge: null },
    ],
  },
  {
    id: 'manage',
    label: t('nav.manage') || 'Manage',
    emoji: '⚙️',
    gradient: 'from-sky-500/10 to-blue-600/10',
    accent: 'text-sky-600 dark:text-sky-400',
    activeBg: 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/10 dark:border-sky-500/20',
    items: [
      { path: '/dashboard/workspaces',   label: t('nav.workspaces') || 'Workspaces',    icon: Boxes,        badge: 'New' },
      { path: '/dashboard/projects',     label: t('nav.projects') || 'Projects',      icon: FolderKanban, badge: null },
      { path: '/dashboard/teams',        label: t('nav.teams') || 'Team',          icon: Users,        badge: null },
      { path: '/dashboard/billing',      label: t('nav.billing') || 'Billing',       icon: Gem,          badge: null },
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
  
  const ZONES = getZones(t)

  const [expandedZone, setExpandedZone] = useState<string | null>(() => {
    return ZONES.find(z => z.items.some(i => pathname?.startsWith(i.path) && i.path !== '/dashboard')) ?.id ?? 'studio'
  })

  const isActive = (path: string) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname?.startsWith(path)

  if (pathname === '/login' || pathname === '/register' || pathname === '/') return null
  if (pathname != null && /^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null

  const MOBILE_TABS = [
    { path: '/dashboard',           label: t('nav.dashboard') || 'Home',    icon: LayoutDashboard },
    { path: '/dashboard/video',     label: t('nav.studio') || 'Studio',  icon: Video },
    { path: '/dashboard/scheduler', label: t('nav.publish') || 'Publish', icon: Send },
    { path: '/dashboard/settings',  label: t('nav.settings') || 'Settings', icon: Settings },
  ]

  return (
    <>
    <motion.aside
      animate={{ width: collapsed ? 84 : 280 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="relative hidden lg:flex flex-shrink-0 h-screen flex-col bg-surface-card/95 dark:bg-surface-900/95 backdrop-blur-xl border-r border-surface-200/50 dark:border-surface-800/50 overflow-hidden z-40 transition-all duration-500 shadow-2xl"
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center justify-between px-7 py-8 border-b border-surface-100 dark:border-white/5 bg-surface-page/50 dark:bg-black/20 backdrop-blur-3xl">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              <ClickLogo size={36} showWordmark wordmarkClassName={isDark ? 'text-white' : 'text-slate-900'} />
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && <div className="mx-auto"><ClickLogo size={36} /></div>}
        {!collapsed && (
          <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="w-10 h-10 rounded-2xl bg-surface-page dark:bg-white/5 hover:bg-surface-card dark:hover:bg-white/10 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all ml-auto group active:scale-90">
            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      {collapsed && (
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="absolute -right-4 top-20 z-50 w-9 h-9 rounded-full bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 shadow-2xl transition-all active:scale-90">
          <ChevronRight size={18} />
        </button>
      )}

      {/* ── Search Trigger ── */}
      {!collapsed && (
        <div className="px-5 pt-8 pb-4">
          <button 
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('click-cmdk-open'))}
            className="w-full flex items-center gap-4 px-5 py-3.5 rounded-[1.5rem] bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/5 text-surface-400 hover:bg-surface-card dark:hover:bg-white/10 hover:border-primary-500/20 transition-all text-xs font-bold group shadow-inner"
          >
            <Search size={16} className="group-hover:scale-110 transition-transform group-hover:text-primary-500" />
            <span className="flex-1 text-left italic uppercase tracking-widest opacity-60">{t('common.search')}...</span>
            <span className="text-[10px] font-black bg-surface-card dark:bg-white/10 px-2 py-1 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity">⌘K</span>
          </button>
        </div>
      )}

      {/* ── Zone Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-3 px-4 custom-scrollbar scroll-smooth">
        {ZONES.map(zone => {
          const isExpanded = expandedZone === zone.id && !collapsed
          const zoneActive = zone.items.some(i => isActive(i.path))

          return (
            <div key={zone.id} className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (collapsed) { setCollapsed(false); setExpandedZone(zone.id) }
                  else setExpandedZone(isExpanded ? null : zone.id)
                }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-[1.8rem] transition-all duration-300 ease-out group relative overflow-hidden ${
                  zoneActive ? 'bg-surface-page dark:bg-white/10 border-2 border-surface-200 dark:border-white/20 text-surface-900 dark:text-white shadow-md ring-1 ring-primary-500/20 scale-[1.02] z-10' : 'text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-page dark:hover:bg-white/[0.04]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${zone.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />
                <span className="text-xl relative z-10 group-hover:scale-110 transition-transform">{zone.emoji}</span>
                {!collapsed && (
                  <>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] italic flex-1 text-left relative z-10">{zone.label}</span>
                    <ChevronRight size={14} className={`transition-transform duration-500 relative z-10 ${isExpanded ? 'rotate-90' : 'opacity-40 group-hover:opacity-100'}`} />
                  </>
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }} 
                    className="overflow-hidden space-y-1.5 pl-4"
                  >
                    {zone.items.map(item => {
                      const active = isActive(item.path)
                      return (
                        <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} 
                          title={item.label} aria-label={item.label}
                          className={`flex items-center gap-4 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest italic transition-all border-2 group/item ${active ? `${zone.activeBg} ${zone.accent} shadow-inner` : 'text-surface-400 border-transparent hover:text-surface-900 dark:hover:text-white hover:bg-surface-page'}`}
                        >
                          <item.icon size={16} className={`transition-all duration-500 ${active ? `${zone.accent} scale-110` : 'text-surface-300 dark:text-slate-800 group-hover/item:scale-110 group-hover/item:text-primary-500'}`} aria-hidden="true" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && <span className="px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-500 text-[8px] font-black uppercase tracking-tighter border border-primary-500/20">{item.badge}</span>}
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
      <div className="p-7 space-y-5 border-t border-surface-100 dark:border-white/5 bg-surface-page/50 dark:bg-black/20 backdrop-blur-3xl">
        <div className="grid grid-cols-2 gap-4">
          <button 
            type="button" 
            onClick={toggle} 
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} 
            className="flex items-center justify-center p-3.5 rounded-2xl bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 text-surface-400 hover:text-primary-500 hover:border-primary-500/20 hover:bg-white dark:hover:bg-white/10 transition-all shadow-inner active:scale-95 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            {isDark ? (
              <Sun size={18} className="relative z-10 group-hover:rotate-45 transition-transform duration-500" />
            ) : (
              <Moon size={18} className="relative z-10 group-hover:-rotate-12 transition-transform duration-500" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleFocusMode}
            aria-label={focusMode ? 'Focus mode on — click to disable' : 'Focus mode off — click to enable'}
            className={`flex items-center justify-center p-3.5 rounded-2xl border-2 transition-all active:scale-90 shadow-inner ${focusMode ? 'bg-primary-500/10 border-primary-500/30 text-primary-500 animate-pulse' : 'bg-surface-page dark:bg-white/5 border-surface-100 dark:border-white/10 text-surface-400 hover:text-primary-500 hover:border-primary-500/20'}`}
          >
            {focusMode ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        <div className={`flex items-center gap-4 px-4 py-4 rounded-[2rem] bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 shadow-inner ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-xl shadow-primary-500/20 ring-2 ring-white/10">{user?.name?.charAt(0) || 'U'}</div>
            {user?.email_verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-surface-card dark:border-surface-900 flex items-center justify-center shadow-lg" title="Email verified">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-surface-900 dark:text-white truncate leading-none mb-1.5 italic uppercase tracking-tighter">{user?.name || 'Creator'}</p>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />
                 <p className="text-[9px] font-black text-emerald-500 truncate uppercase tracking-widest italic leading-none">
                   {user?.subscription?.plan || 'Creator'}
                 </p>
              </div>
            </div>
          )}
          {!collapsed && (
            <button type="button" onClick={logout} aria-label="Log out" className="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
      `}</style>
    </motion.aside>

    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-card/80 backdrop-blur-3xl border-t border-surface-100 dark:border-surface-800 flex items-center justify-around px-4 py-4 safe-area-pb transition-all duration-500 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
      {MOBILE_TABS.map(item => {
        const active = isActive(item.path)
        return (
          <Link key={item.path} href={item.path} aria-current={active ? 'page' : undefined} 
            className={`flex flex-col items-center gap-2 px-6 py-2.5 rounded-[1.5rem] transition-all ${active ? 'bg-primary-500/10 text-primary-500 shadow-inner border border-primary-500/20' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}>
            <item.icon size={22} className={active ? 'animate-pulse' : ''} />
            <span className="text-[9px] font-black uppercase tracking-widest italic">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  </>
  )
}
