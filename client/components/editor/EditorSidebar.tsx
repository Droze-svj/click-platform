'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  History,
  Orbit,
  Activity,
  Layers,
  ArrowUpRight,
  Search,
  Pin,
  X,
  Command,
  Keyboard,
  Star,
  Lock,
  Sparkles,
  Library,
  Wand2,
  Type,
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import { CATEGORIES } from '../../utils/editorConstants'
import { formatTime, loadEditorContentPreferences } from '../../utils/editorUtils'

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

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)]'

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
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Filter categories
  const filteredCategories = ALL_CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    <aside className={`
      ${deviceView === 'mobile'
        ? `fixed inset-y-0 left-0 z-[60] w-72 transform transition-all duration-500 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`
        : isCollapsed ? 'w-20' : 'w-72'
      }
      relative flex flex-col transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex-shrink-0 overflow-hidden bg-black/40 backdrop-blur-3xl border-r border-white/5
    `}>
      {/* Gradient top decoration */}
      <div className="absolute inset-x-0 top-0 h-[30rem] bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none opacity-50" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-[0.05] pointer-events-none mix-blend-overlay" />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-4 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <Orbit className="w-5 h-5 text-indigo-500 animate-spin-slow" />
              <div>
                <h2 className="text-[11px] font-black text-white italic tracking-tighter uppercase leading-none">NEURAL_CORE</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none">LATTICE_SYNCED</span>
                </div>
              </div>
            </div>
          )}
          {deviceView !== 'mobile' && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`${isCollapsed ? 'mx-auto' : ''} w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all`}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </motion.button>
          )}
        </div>

        {/* ── Search bar (hidden when collapsed) ─────────────────────────── */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-4 relative"
            >
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="INDEX_LATTICE… (⌘F)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-black/40 border-2 border-white/5 text-[11px] text-indigo-200 placeholder-slate-800 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.02] transition-all italic uppercase font-black tracking-widest"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} title="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Recent History ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isCollapsed && !searchQuery && recentCategories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4 flex-shrink-0 relative z-10"
          >
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 flex items-center gap-2">
              <History className="w-3 h-3" /> RECENT_NODES
            </p>
            <div className="flex flex-col gap-1.5">
              {recentCategories.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setActiveCategory(category.id as EditorCategory)
                      if (deviceView === 'mobile') setMobileMenuOpen(false)
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-black text-slate-500 hover:bg-white/[0.06] hover:text-white transition-all group italic uppercase tracking-widest"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-3.5 h-3.5 group-hover:text-indigo-400 transition-colors" />
                      <span className="truncate">{category.label}</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Navigation ────────────────────────────────────────────── */}
      <div className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto custom-scrollbar relative z-10">

        {/* No-results state */}
        {searchQuery && sortedCategories.length === 0 && (
          <div className="text-center py-10 text-slate-600">
            <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p className="text-[10px] uppercase tracking-wider">No panels found</p>
          </div>
        )}

        {/* Pin header */}
        {!searchQuery && pinnedCategories.length > 0 && !isCollapsed && (
          <div className="px-3 pt-1 pb-2">
            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em] flex items-center gap-2">
              <Pin className="w-2.5 h-2.5" /> PINNED_LATTICE
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
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.4em] flex items-center gap-2">
                    <Layers className="w-2.5 h-2.5" /> NEURAL_LATTICE
                  </p>
                </div>
              )}
              <div
                className="relative"
                onMouseEnter={() => setHoveredCategory(category.id as EditorCategory)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <button
                  onClick={() => {
                    if (isLocked) return
                    setActiveCategory(category.id as EditorCategory)
                    if (deviceView === 'mobile') setMobileMenuOpen(false)
                  }}
                  disabled={isLocked}
                  className={`w-full group relative overflow-hidden rounded-2xl transition-all duration-500 text-left border ${
                    isActive
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-600/30 border-white/20 scale-[1.01]'
                      : isLocked
                      ? 'bg-white/[0.01] text-slate-700 border-white/[0.03] opacity-50 cursor-not-allowed'
                      : 'bg-white/[0.02] text-slate-500 border-white/5 hover:bg-white/[0.05] hover:text-white hover:border-white/10'
                  }`}
                >
                  <div className={`flex items-center gap-4 ${isCollapsed ? 'p-3 justify-center' : 'px-4 py-3.5'}`}>
                    <div className={`${isCollapsed ? 'w-10 h-10' : 'w-8 h-8'} rounded-xl transition-all flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                    } ${isLocked ? 'opacity-40' : ''}`}>
                      {isLocked
                        ? <Lock className="w-3.5 h-3.5 text-slate-600" />
                        : <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                      }
                    </div>

                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[12px] italic uppercase tracking-tight leading-none">
                            {category.label}
                          </span>
                          {/* Badges */}
                          {(category as any).badge && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider ${
                              (category as any).badge === '2026'
                                ? 'bg-fuchsia-500/20 text-fuchsia-400'
                                : (category as any).badge === 'PRO'
                                ? 'bg-amber-500/20 text-amber-400'
                                : (category as any).badge === 'BETA'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {(category as any).badge}
                            </span>
                          )}
                          {isLocked && requiredTier && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[7px] font-black uppercase">
                              {requiredTier}+
                            </span>
                          )}
                        </div>
                        <div className={`text-[9px] mt-0.5 font-medium uppercase tracking-wider leading-tight opacity-50 ${isActive ? 'text-white' : 'text-slate-600'}`}>
                          {category.description}
                        </div>
                      </div>
                    )}

                    {/* Keyboard shortcut badge */}
                    {!isCollapsed && shortcut && !isLocked && (
                      <span className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black font-mono transition-all ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-700 group-hover:text-slate-400'
                      }`}>
                        {shortcut}
                      </span>
                    )}
                  </div>

                  {isActive && (
                    <motion.div
                      layoutId="active-nav-glow"
                      className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"
                    />
                  )}
                </button>

                {/* Pin button (hover) */}
                {!isCollapsed && !isLocked && hoveredCategory === category.id && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => togglePin(category.id as EditorCategory, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all z-10"
                    title={isPinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin className={`w-3 h-3 ${isPinned ? 'text-indigo-400 fill-indigo-400' : ''}`} />
                  </motion.button>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 bg-black/30 backdrop-blur-3xl relative z-20 space-y-3">
        {/* Device + duration row */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                {deviceView === 'desktop' && <Monitor className="w-3.5 h-3.5" />}
                {deviceView === 'tablet' && <Tablet className="w-3.5 h-3.5" />}
                {deviceView === 'mobile' && <Smartphone className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{deviceView}</span>
            </div>
            <div className="text-[11px] font-black text-indigo-400 font-mono tabular-nums">{formatTime(videoDuration)}</div>
          </div>
        )}

        {/* Status + shortcuts row */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          {!isCollapsed && (
            <>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex-1 leading-none">Neural Link Active</span>
              <button
                onClick={() => setShowShortcuts(v => !v)}
                title="Keyboard shortcuts"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-slate-600 hover:text-white transition-all"
              >
                <Keyboard className="w-3 h-3" />
                <span className="text-[8px] font-black">⌘</span>
              </button>
            </>
          )}
        </div>

        {/* Keyboard shortcuts popover */}
        <AnimatePresence>
          {showShortcuts && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-3 right-3 mb-2 p-4 rounded-2xl bg-black/90 border border-white/10 backdrop-blur-3xl z-50 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Command className="w-3 h-3 text-indigo-400" /> Keyboard Shortcuts
                </p>
                <button onClick={() => setShowShortcuts(false)} title="Close shortcuts" className="text-slate-600 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(KB_SHORTCUTS).map(([catId, key]) => {
                  const cat = ALL_CATEGORIES.find(c => c.id === catId)
                  if (!cat) return null
                  return (
                    <div key={catId} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5">
                      <span className="text-[9px] text-slate-500 uppercase">{cat.label}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white">{key}</kbd>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5 col-span-2">
                  <span className="text-[9px] text-slate-500 uppercase">Search panels</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white">⌘F</kbd>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}
