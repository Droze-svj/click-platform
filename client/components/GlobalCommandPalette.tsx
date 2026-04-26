'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, ArrowRight, Cpu, Send, Calendar, Users, BarChart3, Brain,
  RefreshCw, Hammer, Plug, Boxes, Compass, Flame, Gem, Settings, Bell,
  HelpCircle, FileText, Quote, BookOpen, Wand2, Palette, Megaphone,
  Trophy, Activity, Plus, Sparkles, Video, FolderKanban, Library,
  CheckSquare, ThumbsUp, Mic, Image as ImageIcon, Globe, Zap, ArrowLeft
} from 'lucide-react'
import ClickLogo from './ClickLogo'

// ── Types ────────────────────────────────────────────────────────────────────
type CommandKind = 'page' | 'action' | 'create'

interface Command {
  id: string
  kind: CommandKind
  label: string
  hint?: string             // shown right of label
  group: string             // section header
  href?: string             // nav target
  run?: (router: ReturnType<typeof useRouter>) => void
  icon: any
  keywords?: string[]       // extra fuzzy match terms
  shortcut?: string         // optional kbd hint
}

// ── Command catalog ─────────────────────────────────────────────────────────
const COMMANDS: Command[] = [
  // === Studio ===
  { id: 'p-home',          kind: 'page', group: 'Studio',  label: 'Dashboard',      hint: 'Home',                   icon: Activity,    href: '/dashboard',                shortcut: 'G H', keywords: ['overview','start','main'] },
  { id: 'p-onboarding',    kind: 'page', group: 'Studio',  label: 'Get Started',    hint: 'Activation checklist',   icon: Compass,     href: '/dashboard/onboarding',     keywords: ['onboarding','setup','tour','first time'] },
  { id: 'p-forge',         kind: 'page', group: 'Studio',  label: 'One-Click Forge',hint: 'Generate a content pack',icon: Hammer,      href: '/dashboard/forge',          shortcut: 'G F', keywords: ['ai','generate','create','pack','viral'] },
  { id: 'p-video',         kind: 'page', group: 'Studio',  label: 'Video Library',  hint: 'Upload + manage videos', icon: Video,       href: '/dashboard/video',          shortcut: 'G V', keywords: ['videos','upload','clips','library'] },
  { id: 'p-content',       kind: 'page', group: 'Studio',  label: 'Content AI',     hint: 'Long-form drafts',       icon: Sparkles,    href: '/dashboard/content',        keywords: ['ai','draft','article','blog'] },
  { id: 'p-scripts',       kind: 'page', group: 'Studio',  label: 'Scripts',        hint: 'AI script generator',    icon: FileText,    href: '/dashboard/scripts',        shortcut: 'G S', keywords: ['ai','write','script','hook'] },
  { id: 'p-quotes',        kind: 'page', group: 'Studio',  label: 'Quote Cards',    hint: 'Image quotes',           icon: Quote,       href: '/dashboard/quotes',         keywords: ['image','card','social','quote'] },
  { id: 'p-library',       kind: 'page', group: 'Studio',  label: 'Asset Library',  hint: 'Your uploads',           icon: BookOpen,    href: '/dashboard/library',        keywords: ['files','my assets','uploads'] },
  { id: 'p-templates',     kind: 'page', group: 'Studio',  label: 'Templates',      hint: 'Reusable templates',     icon: Wand2,       href: '/dashboard/templates',      keywords: ['preset','reuse','template'] },
  { id: 'p-brand',         kind: 'page', group: 'Studio',  label: 'Brand Kit',      hint: 'Colors, fonts, logo',    icon: Palette,     href: '/dashboard/brand-kit',      keywords: ['brand','colors','fonts','logo','identity'] },

  // === Publish ===
  { id: 'p-scheduler',     kind: 'page', group: 'Publish', label: 'Scheduler',      hint: 'Plan posts',             icon: Send,        href: '/dashboard/scheduler',      shortcut: 'G P', keywords: ['schedule','plan','queue'] },
  { id: 'p-calendar',      kind: 'page', group: 'Publish', label: 'Calendar',       hint: 'Calendar view',          icon: Calendar,    href: '/dashboard/calendar',       keywords: ['calendar','dates','schedule'] },
  { id: 'p-integrations',  kind: 'page', group: 'Publish', label: 'Integrations',   hint: 'Connect accounts',       icon: Plug,        href: '/dashboard/integrations',   keywords: ['connect','tiktok','instagram','youtube','x','linkedin','oauth'] },
  { id: 'p-workflows',     kind: 'page', group: 'Publish', label: 'Automations',    hint: 'Workflows',              icon: RefreshCw,   href: '/dashboard/workflows',      keywords: ['workflow','automate','rules'] },
  { id: 'p-recycling',     kind: 'page', group: 'Publish', label: 'Content Remix',  hint: 'Repurpose old posts',    icon: RefreshCw,   href: '/dashboard/recycling',      keywords: ['remix','repurpose','recycle'] },

  // === Grow ===
  { id: 'p-analytics',     kind: 'page', group: 'Grow',    label: 'Analytics',      hint: 'Engagement & reach',     icon: BarChart3,   href: '/dashboard/analytics',      shortcut: 'G A', keywords: ['stats','metrics','insights'] },
  { id: 'p-trends',        kind: 'page', group: 'Grow',    label: 'Discover',       hint: 'Trending hooks & sounds',icon: Flame,       href: '/dashboard/trends',         keywords: ['trends','viral','hooks','sounds','formats'] },
  { id: 'p-insights',      kind: 'page', group: 'Grow',    label: 'AI Insights',    hint: 'Smart recommendations',  icon: Brain,       href: '/dashboard/insights',       keywords: ['ai','smart','recommend'] },
  { id: 'p-marketing',     kind: 'page', group: 'Grow',    label: 'Marketing Oracle',hint: 'Marketing AI',          icon: Megaphone,   href: '/dashboard/marketing-ai',   keywords: ['marketing','copy','strategy'] },
  { id: 'p-niche',         kind: 'page', group: 'Grow',    label: 'Niche Intel',    hint: 'Niche research',         icon: BookOpen,    href: '/dashboard/niche',          keywords: ['niche','research','audience'] },
  { id: 'p-social',        kind: 'page', group: 'Grow',    label: 'Social Sync',    hint: 'Social analytics',       icon: Globe,       href: '/dashboard/social',         keywords: ['social','sync'] },

  // === Manage ===
  { id: 'p-workspaces',    kind: 'page', group: 'Manage',  label: 'Workspaces',     hint: 'Switch brand',           icon: Boxes,       href: '/dashboard/workspaces',     keywords: ['brand','workspace','switch'] },
  { id: 'p-posts',         kind: 'page', group: 'Manage',  label: 'Posts',          hint: 'Draft & published',      icon: BookOpen,    href: '/dashboard/posts',          keywords: ['posts','draft'] },
  { id: 'p-projects',      kind: 'page', group: 'Manage',  label: 'Projects',       hint: 'Project boards',         icon: FolderKanban,href: '/dashboard/projects',       keywords: ['projects','kanban'] },
  { id: 'p-teams',         kind: 'page', group: 'Manage',  label: 'Team',           hint: 'Members & roles',        icon: Users,       href: '/dashboard/teams',          shortcut: 'G T', keywords: ['team','members','collaborators'] },
  { id: 'p-tasks',         kind: 'page', group: 'Manage',  label: 'Tasks',          hint: 'Task list',              icon: CheckSquare, href: '/dashboard/tasks',          keywords: ['todo','task','checklist'] },
  { id: 'p-approvals',     kind: 'page', group: 'Manage',  label: 'Approvals',      hint: 'Review queue',           icon: ThumbsUp,    href: '/dashboard/approvals',      keywords: ['review','approve','queue'] },
  { id: 'p-achievements',  kind: 'page', group: 'Manage',  label: 'Achievements',   hint: 'Milestones',             icon: Trophy,      href: '/dashboard/achievements',   keywords: ['badges','milestones','rewards'] },
  { id: 'p-billing',       kind: 'page', group: 'Manage',  label: 'Billing',        hint: 'Plan & usage',           icon: Gem,         href: '/dashboard/billing',        keywords: ['billing','plan','upgrade','invoice','usage'] },

  // === Utility ===
  { id: 'p-settings',      kind: 'page', group: 'Utility', label: 'Settings',       hint: 'Account preferences',    icon: Settings,    href: '/dashboard/settings',       shortcut: ',', keywords: ['preferences','config','profile'] },
  { id: 'p-notifications', kind: 'page', group: 'Utility', label: 'Notifications',  hint: 'Alerts & activity',      icon: Bell,        href: '/dashboard/notifications',  keywords: ['alerts','inbox'] },
  { id: 'p-search',        kind: 'page', group: 'Utility', label: 'Search',         hint: 'Global search',          icon: Search,      href: '/dashboard/search',         keywords: ['search','find'] },
  { id: 'p-help',          kind: 'page', group: 'Utility', label: 'AI Help',        hint: 'Get assistance',         icon: HelpCircle,  href: '/dashboard/ai',             keywords: ['help','support','assist'] },

  // === Create actions ===
  { id: 'a-new-script',    kind: 'create', group: 'Create',label: 'New Script',     hint: 'Open script generator',  icon: Plus,        href: '/dashboard/scripts',        keywords: ['new','create','write'] },
  { id: 'a-new-video',     kind: 'create', group: 'Create',label: 'Upload Video',   hint: 'Drop a video',           icon: Plus,        href: '/dashboard/video',          keywords: ['upload','new video','clip'] },
  { id: 'a-new-quote',     kind: 'create', group: 'Create',label: 'New Quote Card', hint: 'Create image quote',     icon: Plus,        href: '/dashboard/quotes',         keywords: ['new','quote','image'] },
  { id: 'a-new-team',      kind: 'create', group: 'Create',label: 'New Team',       hint: 'Invite collaborators',   icon: Plus,        href: '/dashboard/teams',          keywords: ['team','invite'] },
  { id: 'a-new-pack',      kind: 'create', group: 'Create',label: 'Browse Creative Packs', hint: 'One-click style', icon: Wand2,       href: '/dashboard/video',          keywords: ['style','pack','bundle'] },
  { id: 'a-stock',         kind: 'create', group: 'Create',label: 'Browse Stock Library', hint: 'B-roll + music',  icon: Library,     href: '/dashboard/video',          keywords: ['stock','broll','music','gif','sfx'] },
  { id: 'a-connect',       kind: 'create', group: 'Create',label: 'Connect Account', hint: 'Link a social',         icon: Plug,        href: '/dashboard/integrations',   keywords: ['connect','tiktok','instagram','linkedin','x','oauth'] },
]

const RECENT_KEY = 'click-cmdk-recent'
const RECENT_MAX = 5

// ── Utilities ────────────────────────────────────────────────────────────────
function fuzzy(q: string, s: string): number {
  if (!q) return 1
  const haystack = s.toLowerCase()
  const needle = q.toLowerCase()
  let score = 0
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) { score += 1 + (j === 0 || haystack[j - 1] === ' ' ? 2 : 0); i++ }
  }
  if (i < needle.length) return 0
  if (haystack.startsWith(needle)) score += 10
  if (haystack === needle) score += 50
  return score
}

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function saveRecent(ids: string[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, RECENT_MAX))) } catch { /* noop */ }
}

// ── Component ────────────────────────────────────────────────────────────────
const GlobalCommandPalette: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Hide entirely on auth screens
  const hidden = !pathname || pathname === '/login' || pathname === '/register' || pathname === '/'

  // Open on Cmd/Ctrl+K
  useEffect(() => {
    if (hidden) return
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      if (isMeta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hidden])

  // Reset state every time we open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setRecentIds(loadRecent())
      // Focus on next frame to ensure modal mounted
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Filter + score + group
  const groups = useMemo(() => {
    if (!open) return [] as { group: string; items: Command[] }[]
    if (!query) {
      // Recent first
      const recent = recentIds
        .map(id => COMMANDS.find(c => c.id === id))
        .filter((c): c is Command => !!c)
      const restByGroup: Record<string, Command[]> = {}
      for (const c of COMMANDS) {
        if (recent.find(r => r.id === c.id)) continue
        ;(restByGroup[c.group] ??= []).push(c)
      }
      const out: { group: string; items: Command[] }[] = []
      if (recent.length) out.push({ group: 'Recent', items: recent })
      const order = ['Studio', 'Publish', 'Grow', 'Manage', 'Create', 'Utility']
      for (const g of order) {
        if (restByGroup[g]?.length) out.push({ group: g, items: restByGroup[g] })
      }
      return out
    }

    const scored = COMMANDS
      .map(c => {
        const text = [c.label, c.hint || '', c.group, ...(c.keywords || [])].join(' ')
        return { c, score: fuzzy(query, text) }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ c }) => c)

    const byGroup: Record<string, Command[]> = {}
    for (const c of scored) (byGroup[c.group] ??= []).push(c)
    const order = ['Recent', 'Studio', 'Publish', 'Grow', 'Manage', 'Create', 'Utility']
    return order.filter(g => byGroup[g]?.length).map(g => ({ group: g, items: byGroup[g] }))
  }, [query, open, recentIds])

  // Flatten for keyboard nav
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])

  // Clamp active index
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1))
  }, [flat.length, activeIdx])

  const run = useCallback((cmd: Command) => {
    setOpen(false)
    setRecentIds(prev => {
      const next = [cmd.id, ...prev.filter(id => id !== cmd.id)].slice(0, RECENT_MAX)
      saveRecent(next)
      return next
    })
    if (cmd.run) cmd.run(router)
    else if (cmd.href) router.push(cmd.href)
  }, [router])

  // Keyboard nav inside modal
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); const cmd = flat[activeIdx]; if (cmd) run(cmd) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, activeIdx, run])

  // Scroll active into view
  useEffect(() => {
    if (!open) return
    const el = document.querySelector(`[data-cmdk-idx="${activeIdx}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  if (hidden) return null

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0a0a14] border border-white/10 rounded-2xl shadow-[0_60px_180px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
              <ClickLogo size={22} />
              <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
                placeholder="Search pages, actions…"
                className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-slate-500"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} title="Clear" className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block text-[10px] font-mono text-slate-500 px-2 py-1 rounded-md bg-white/5 border border-white/10">esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
              {groups.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-bold text-white">No matches</p>
                  <p className="text-[12px] text-slate-400 mt-1">Try a different word — or browse the sidebar.</p>
                </div>
              ) : (
                groups.map(({ group, items }) => (
                  <div key={group} className="px-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{group}</div>
                    {items.map(cmd => {
                      const idx = flat.indexOf(cmd)
                      const Icon = cmd.icon
                      const active = idx === activeIdx
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          data-cmdk-idx={idx}
                          onClick={() => run(cmd)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            active ? 'bg-fuchsia-500/15 text-white' : 'text-slate-300 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            active ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-white/5 text-slate-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold truncate">{cmd.label}</span>
                              {cmd.kind === 'create' && (
                                <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Create</span>
                              )}
                            </div>
                            {cmd.hint && <div className="text-[11px] text-slate-500 truncate">{cmd.hint}</div>}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="text-[9px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 flex-shrink-0">{cmd.shortcut}</kbd>
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${active ? 'opacity-100 text-fuchsia-300' : 'opacity-0'}`} />
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 bg-black/40 text-[10px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1.5"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↵</kbd> select</span>
                <span className="flex items-center gap-1.5"><kbd className="font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">esc</kbd> close</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">{flat.length} results</span>
                <span className="opacity-50">·</span>
                <span>Click ⌘K anywhere</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default GlobalCommandPalette
