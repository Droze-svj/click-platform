'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  History,
  Activity,
  Layers,
  ArrowUpRight,
  Search,
  Pin,
  X,
  Command,
  Keyboard,
  Lock,
  Sparkles,
  Library,
  Wand2,
  Type,
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import { CATEGORIES } from '../../utils/editorConstants'
import { EDITOR_GROUPS, groupForCategory, type EditorGroupId } from '../../utils/editorGroups'
import { formatTime, loadEditorContentPreferences } from '../../utils/editorUtils'
import { IconButton, Input, Badge } from '../ui'
import { cn } from '../../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditorSidebarProps {
  deviceView: 'desktop' | 'tablet' | 'mobile'
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  activeCategory: EditorCategory
  setActiveCategory: (category: EditorCategory) => void
  videoDuration: number
  isOledTheme?: boolean
  /** Current user tier — used to render lock badges on gated categories */
  userTier?: 'free' | 'creator' | 'pro' | 'team' | 'elite'
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Keyboard shortcut map (shown in tooltip when sidebar is expanded)
const KB_SHORTCUTS: Record<string, string> = {
  'ai-edit': '1', 'edit': '2', 'timeline': '3', 'effects': '4',
  'color': '5', 'assets': '6', 'export': '7',
  'stock-library': 'L', 'creative-packs': 'P', 'creative-tools': 'C', 'text-motion': 'X',
}

// Tier requirement per category — empty in the lean sidebar; everything
// in CATEGORIES is unlocked. Keep the type so the tier-gating logic still works
// if you re-add gated categories later.
const CATEGORY_TIER: Partial<Record<EditorCategory, 'creator' | 'pro' | 'team' | 'elite'>> = {}

const TIER_ORDER = ['free', 'creator', 'pro', 'team', 'elite'] as const
type Tier = typeof TIER_ORDER[number]

function tierUnlocks(userTier: Tier, required: Tier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(required)
}

// 2026 categories — kept lean. Removed: spatial, agent, dub (orphaned views
// that fell through to BasicEditorView). Thumbnail AI moved out of sidebar
// since it's accessible via the dashboard's Studio zone.
const NEW_2026_CATEGORIES = [
  {
    id: 'stock-library' as EditorCategory,
    label: 'Stock Library',
    icon: Library,
    color: 'from-rose-500 to-fuchsia-600',
    bgColor: 'bg-rose-900/20',
    textColor: 'text-rose-400',
    description: 'B-roll · music · GIFs · stickers · transitions · SFX',
    badge: 'NEW',
  },
  {
    id: 'creative-packs' as EditorCategory,
    label: 'Creative Packs',
    icon: Wand2,
    color: 'from-amber-500 to-rose-500',
    bgColor: 'bg-amber-900/20',
    textColor: 'text-amber-400',
    description: 'One-click style bundles',
    badge: 'NEW',
  },
  {
    id: 'text-motion' as EditorCategory,
    label: 'Text & Motion',
    icon: Type,
    color: 'from-fuchsia-500 to-purple-700',
    bgColor: 'bg-fuchsia-900/20',
    textColor: 'text-fuchsia-400',
    description: 'Captions · animations · motion · fonts',
    badge: 'NEW',
  },
  {
    id: 'creative-tools' as EditorCategory,
    label: 'AI Tools',
    icon: Sparkles,
    color: 'from-fuchsia-600 to-purple-700',
    bgColor: 'bg-fuchsia-900/20',
    textColor: 'text-fuchsia-400',
    description: 'Hooks · beats · engagement predictor',
  },
]

// Merge CATEGORIES and new 2026 ones (avoid duplicates)
const ALL_CATEGORIES = [
  ...CATEGORIES,
  ...NEW_2026_CATEGORIES.filter(n => !CATEGORIES.find(c => c.id === n.id)),
]

// ── Component ─────────────────────────────────────────────────────────────────

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  deviceView,
  mobileMenuOpen,
  setMobileMenuOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  activeCategory,
  setActiveCategory,
  videoDuration,
  isOledTheme,
  userTier = 'pro',
}) => {
  const [recentSections, setRecentSections] = useState<EditorCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedCategories, setPinnedCategories] = useState<EditorCategory[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [hoveredCategory, setHoveredCategory] = useState<EditorCategory | null>(null)
  const reduceMotion = useReducedMotion()
  const [activeGroup, setActiveGroup] = useState<EditorGroupId | 'all'>(() => {
    if (typeof window === 'undefined') return 'all'
    const saved = localStorage.getItem('click_editor_active_group')
    return (saved as EditorGroupId | 'all') || 'all'
  })
  const searchRef = useRef<HTMLInputElement>(null)

  // Persist group selection so the user's filter choice survives reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('click_editor_active_group', activeGroup)
  }, [activeGroup])

  // Load pinned + recent from localStorage
  useEffect(() => {
    try {
      const prefs = loadEditorContentPreferences()
      setRecentSections((prefs.recentSections || []).filter((id: EditorCategory) => id !== activeCategory).slice(0, 3))
      const pinned = JSON.parse(localStorage.getItem('click_pinned_categories') || '[]')
      setPinnedCategories(pinned)
    } catch { /* ignore */ }
  }, [activeCategory])

  // Keyboard shortcuts — numbers 1-9 + S/A/D switch categories
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Focus search on Cmd/Ctrl + F
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    // Don't fire if user is typing in an input
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return

    const shortcutEntry = Object.entries(KB_SHORTCUTS).find(([, key]) => key === e.key)
    if (shortcutEntry) {
      const catId = shortcutEntry[0] as EditorCategory
      const cat = ALL_CATEGORIES.find(c => c.id === catId)
      if (!cat) return
      const required = CATEGORY_TIER[catId]
      if (required && !tierUnlocks(userTier, required)) return
      setActiveCategory(catId)
    }
  }, [userTier, setActiveCategory])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Toggle pin
  const togglePin = (id: EditorCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedCategories(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      localStorage.setItem('click_pinned_categories', JSON.stringify(next))
      return next
    })
  }

  // Filter categories: text search + active group filter.
  // Group filter is bypassed during a search so users always find what they
  // typed regardless of which group it lives in.
  const filteredCategories = ALL_CATEGORIES.filter(c => {
    const matchesText =
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesText) return false
    if (searchQuery) return true
    if (activeGroup === 'all') return true
    return groupForCategory(c.id as EditorCategory) === activeGroup
  })

  // Sort: pinned first, then rest
  const sortedCategories = [
    ...filteredCategories.filter(c => pinnedCategories.includes(c.id as EditorCategory)),
    ...filteredCategories.filter(c => !pinnedCategories.includes(c.id as EditorCategory)),
  ]

  const recentCategories = recentSections
    .map(id => ALL_CATEGORIES.find(c => c.id === id))
    .filter(Boolean) as typeof ALL_CATEGORIES

  const isCollapsed = sidebarCollapsed && deviceView !== 'mobile'

  return (
    <aside className={cn(
      deviceView === 'mobile'
        ? cn('fixed inset-y-0 left-0 z-[60] w-72 transform transition-transform duration-300', mobileMenuOpen ? 'translate-x-0' : '-translate-x-full')
        : isCollapsed ? 'w-20' : 'w-72',
      'relative flex flex-col transition-all duration-300 flex-shrink-0 overflow-hidden ds-surface-card rounded-none border-y-0 border-l-0'
    )}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-4 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent-violet flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="ds-text-label text-theme-primary leading-none">Editor tools</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <Activity className="w-3 h-3 text-emerald-500" aria-hidden />
                  <span className="text-[10px] text-theme-muted leading-none">Ready</span>
                </div>
              </div>
            </div>
          )}
          {deviceView !== 'mobile' && (
            <IconButton
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              variant="secondary"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={isCollapsed ? 'mx-auto' : ''}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </IconButton>
          )}
        </div>

        {/* ── Search bar (hidden when collapsed) ─────────────────────────── */}
        {!isCollapsed && (
          <div className="mt-4 relative">
            <Search className="w-3.5 h-3.5 text-theme-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
            <Input
              ref={searchRef}
              type="text"
              placeholder="Search tools (⌘F)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-8 text-xs"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ── Group filter rail ─────────────────────────────────────────────
             Six top-level groups + an "All" pill. Hidden when collapsed or
             when the user is searching (search spans all groups). Persists
             to localStorage so the user's pick survives reloads. */}
        {!isCollapsed && !searchQuery && (
          <div className="mt-3 -mx-1 flex flex-wrap gap-1">
            <button
             type="button"
              onClick={() => setActiveGroup('all')}
              className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                activeGroup === 'all'
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'ds-surface-subtle text-theme-secondary border-subtle hover:text-theme-primary'
              )}
            >
              All
            </button>
            {EDITOR_GROUPS.map(g => {
              const isOn = activeGroup === g.id
              return (
                <button type="button"
                  key={g.id}
                  title={g.description}
                  onClick={() => setActiveGroup(g.id)}
                  className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                    isOn
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : 'ds-surface-subtle text-theme-secondary border-subtle hover:text-theme-primary'
                  )}
                >
                  {g.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Recent History ─────────────────────────────────────────────────── */}
      {!isCollapsed && !searchQuery && recentCategories.length > 0 && (
        <div className="px-4 pb-4 flex-shrink-0 relative z-10">
          <p className="ds-text-label text-theme-muted mb-3 flex items-center gap-2">
            <History className="w-3 h-3" aria-hidden /> Recent
          </p>
          <div className="flex flex-col gap-1.5">
            {recentCategories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id as EditorCategory)
                    if (deviceView === 'mobile') setMobileMenuOpen(false)
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl ds-surface-subtle text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-3.5 h-3.5 group-hover:text-primary transition-colors" aria-hidden />
                    <span className="truncate">{category.label}</span>
                  </div>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Category Navigation ────────────────────────────────────────────── */}
      <div className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto custom-scrollbar relative z-10">

        {/* No-results state */}
        {searchQuery && sortedCategories.length === 0 && (
          <div className="text-center py-10 text-theme-muted">
            <Search className="w-6 h-6 mx-auto mb-2 opacity-40" aria-hidden />
            <p className="text-xs">No tools found</p>
          </div>
        )}

        {/* Pin header */}
        {!searchQuery && pinnedCategories.length > 0 && !isCollapsed && (
          <div className="px-3 pt-1 pb-2">
            <p className="ds-text-label text-theme-muted flex items-center gap-2">
              <Pin className="w-2.5 h-2.5" aria-hidden /> Pinned
            </p>
          </div>
        )}

        {sortedCategories.map((category, globalIdx) => {
          const Icon = category.icon
          const isActive = activeCategory === category.id
          const isPinned = pinnedCategories.includes(category.id as EditorCategory)
          const requiredTier = CATEGORY_TIER[category.id as EditorCategory]
          const isLocked = requiredTier ? !tierUnlocks(userTier, requiredTier) : false
          const shortcut = KB_SHORTCUTS[category.id]

          // Add "All panels" divider after pinned block
          const showDivider = !searchQuery && pinnedCategories.length > 0 && globalIdx === pinnedCategories.length && !isCollapsed

          return (
            <React.Fragment key={category.id}>
              {showDivider && (
                <div className="px-3 pt-3 pb-2">
                  <p className="ds-text-label text-theme-muted flex items-center gap-2">
                    <Layers className="w-2.5 h-2.5" aria-hidden /> All tools
                  </p>
                </div>
              )}
              <div
                className="relative"
                onMouseEnter={() => setHoveredCategory(category.id as EditorCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isLocked) return
                    setActiveCategory(category.id as EditorCategory)
                    if (deviceView === 'mobile') setMobileMenuOpen(false)
                  }}
                  disabled={isLocked}
                  className={cn('w-full group relative overflow-hidden rounded-xl transition-colors text-left border',
                    isActive
                      ? 'bg-primary text-primary-foreground border-transparent'
                      : isLocked
                      ? 'ds-surface-subtle text-theme-muted opacity-50 cursor-not-allowed'
                      : 'ds-surface-subtle text-theme-secondary hover:text-theme-primary'
                  )}
                >
                  <div className={cn('flex items-center gap-3', isCollapsed ? 'p-3 justify-center' : 'px-4 py-3')}>
                    <div className={cn(isCollapsed ? 'w-10 h-10' : 'w-8 h-8', 'rounded-lg transition-colors flex items-center justify-center flex-shrink-0',
                      isActive ? 'bg-white/20' : 'bg-black/10 dark:bg-white/5',
                      isLocked && 'opacity-40'
                    )}>
                      {isLocked
                        ? <Lock className="w-3.5 h-3.5" aria-hidden />
                        : <Icon className={cn(isCollapsed ? 'w-5 h-5' : 'w-4 h-4', isActive ? 'text-primary-foreground' : 'text-theme-secondary group-hover:text-primary')} aria-hidden />
                      }
                    </div>

                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13px] leading-none truncate">
                            {category.label}
                          </span>
                          {/* Badges */}
                          {(category as any).badge && (
                            <Badge
                              variant="secondary"
                              className={cn('px-1.5 py-0 text-[9px] font-medium normal-case',
                                (category as any).badge === '2026' ? 'bg-fuchsia-500/15 text-fuchsia-500'
                                : (category as any).badge === 'PRO' ? 'bg-amber-500/15 text-amber-500'
                                : (category as any).badge === 'BETA' ? 'bg-rose-500/15 text-rose-500'
                                : 'bg-emerald-500/15 text-emerald-500'
                              )}
                            >
                              {(category as any).badge}
                            </Badge>
                          )}
                          {isLocked && requiredTier && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-medium bg-amber-500/15 text-amber-500 normal-case">
                              {requiredTier}+
                            </Badge>
                          )}
                        </div>
                        <div className={cn('text-[11px] mt-0.5 leading-tight truncate', isActive ? 'text-primary-foreground/80' : 'text-theme-muted')}>
                          {category.description}
                        </div>
                      </div>
                    )}

                    {/* Keyboard shortcut badge */}
                    {!isCollapsed && shortcut && !isLocked && (
                      <span className={cn('shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-medium font-mono transition-colors',
                        isActive ? 'bg-white/20 text-primary-foreground' : 'bg-black/10 dark:bg-white/5 text-theme-muted'
                      )}>
                        {shortcut}
                      </span>
                    )}
                  </div>
                </button>

                {/* Pin button (hover) */}
                {!isCollapsed && !isLocked && hoveredCategory === category.id && (
                  <motion.button
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => togglePin(category.id as EditorCategory, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg ds-surface-elevated flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors z-10"
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin className={cn('w-3 h-3', isPinned && 'text-primary fill-primary')} aria-hidden />
                  </motion.button>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-subtle flex-shrink-0 relative z-20 space-y-3">
        {/* Device + duration row */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg ds-surface-subtle flex items-center justify-center text-theme-secondary">
                {deviceView === 'desktop' && <Monitor className="w-3.5 h-3.5" aria-hidden />}
                {deviceView === 'tablet' && <Tablet className="w-3.5 h-3.5" aria-hidden />}
                {deviceView === 'mobile' && <Smartphone className="w-3.5 h-3.5" aria-hidden />}
              </div>
              <span className="text-[11px] font-medium capitalize text-theme-muted">{deviceView}</span>
            </div>
            <div className="text-xs font-medium text-primary font-mono tabular-nums">{formatTime(videoDuration)}</div>
          </div>
        )}

        {/* Status + shortcuts row */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl ds-surface-subtle">
          <Activity className="w-3.5 h-3.5 text-emerald-500" aria-hidden />
          {!isCollapsed && (
            <>
              <span className="text-[11px] font-medium text-theme-muted flex-1 leading-none">Ready</span>
              <button
                type="button"
                onClick={() => setShowShortcuts(v => !v)}
                title="Keyboard shortcuts"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg ds-surface-elevated text-theme-muted hover:text-theme-primary transition-colors"
              >
                <Keyboard className="w-3 h-3" aria-hidden />
                <span className="text-[10px] font-medium">⌘</span>
              </button>
            </>
          )}
        </div>

        {/* Keyboard shortcuts popover */}
        <AnimatePresence>
          {showShortcuts && !isCollapsed && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              className="absolute bottom-full left-3 right-3 mb-2 p-4 rounded-2xl ds-surface-elevated z-50"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="ds-text-label text-theme-primary flex items-center gap-2">
                  <Command className="w-3 h-3 text-primary" aria-hidden /> Keyboard shortcuts
                </p>
                <button type="button" onClick={() => setShowShortcuts(false)} title="Close shortcuts" className="text-theme-muted hover:text-theme-primary">
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(KB_SHORTCUTS).map(([catId, key]) => {
                  const cat = ALL_CATEGORIES.find(c => c.id === catId)
                  if (!cat) return null
                  return (
                    <div key={catId} className="flex items-center justify-between px-2 py-1 rounded-lg ds-surface-subtle">
                      <span className="text-[11px] text-theme-secondary truncate">{cat.label}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-accent text-[10px] font-mono text-theme-primary">{key}</kbd>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between px-2 py-1 rounded-lg ds-surface-subtle col-span-2">
                  <span className="text-[11px] text-theme-secondary">Search tools</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-accent text-[10px] font-mono text-theme-primary">⌘F</kbd>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
