'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Zap,
  Search,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Layout,
  LayoutGrid,
  Film,
  Clock,
  Sparkles,
  Upload,
  Timer,
  Cpu,
  Bot,
  Eye,
  EyeOff,
  MoreHorizontal,
  Keyboard,
} from 'lucide-react'
import { EditorCategory, StyleDNA } from '../../types/editor'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditorHUDProps {
  projectName: string
  setProjectName: (name: string) => void
  autosaveStatus: 'saved' | 'saving' | 'error'
  historyIndex: number
  historyLength: number
  handleUndo: () => void
  handleRedo: () => void
  setShowKeyboardHelp: (show: boolean) => void
  onLayoutChange: (prefs: any) => void
  currentTime?: number
  duration?: number
  activeCategory?: EditorCategory
  onCommandK?: () => void
  gpuBackend?: 'webgpu' | 'webgl2' | 'canvas2d' | null
  gpuVendor?: string
  agentRunning?: boolean
  styleDNA?: StyleDNA
  onNormalizeStyle?: () => void
  zenMode?: boolean
  setZenMode?: (val: boolean) => void
  onMakeItViral?: () => void
  isMakingViral?: boolean
  onExport?: () => void
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Hover tooltip wrapper */
function HUDTooltip({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut?: string
  children: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = () => {
    timer.current = setTimeout(() => setShow(true), 500)
  }
  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    setShow(false)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className="relative" onMouseEnter={open} onMouseLeave={close}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[60] pointer-events-none"
          >
            <div className="neural-hud-dropdown rounded-lg px-2.5 py-1.5 whitespace-nowrap border border-white/10">
              <div className="text-[11px] font-medium text-white">{label}</div>
              {shortcut && (
                <div className="text-[10px] text-slate-500 mt-0.5">{shortcut}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Plain, human-readable names for each editor section. */
const CATEGORY_LABELS: Partial<Record<EditorCategory, string>> = {
  'edit': 'Editing',
  'color': 'Color',
  'ai': 'AI Tools',
  'effects': 'Effects',
  'timeline': 'Timeline',
  'export': 'Export',
  'style-vault': 'Style Vault',
  'ai-edit': 'AI Editing',
  'assets': 'Assets',
  'growth': 'Analytics',
  'chromakey': 'Chroma Key',
  'visual-fx': 'Visual FX',
  'ai-analysis': 'AI Analysis',
  'collaborate': 'Collaborate',
  'scripts': 'Scripts',
  'scheduling': 'Scheduling',
  'short-clips': 'Short Clips',
  'predict': 'Predictions',
  'distribution': 'Distribution',
  'spatial': 'Spatial',
  'agent': 'AI Agent',
  'dub': 'Dubbing',
}

const LAYOUT_MODES = [
  { id: 'balanced', label: 'Balanced', icon: LayoutGrid, desc: 'Even split of preview and timeline' },
  { id: 'preview', label: 'Cinematic', icon: Film, desc: 'Larger preview, focus on playback' },
  { id: 'timeline', label: 'Timeline focus', icon: Clock, desc: 'More room for fine timeline edits' },
] as const

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * Container-width breakpoints. The HUD adapts to the width of its OWN container
 * (which changes with side panels / zen mode), not the viewport — so it fits
 * perfectly regardless of what else is on screen. Returns a set of visibility
 * flags; anything turned off inline is still reachable from the overflow menu.
 */
function useResponsiveLayout(width: number) {
  // Before the first measurement, assume a wide bar to avoid a collapsed flash.
  const W = width > 0 ? width : 1280
  return {
    W,
    categoryLabel: W >= 560,
    saveLabel: W >= 1240,
    inlineUndoRedo: W >= 660,
    commandText: W >= 880,
    inlineLayout: W >= 920,
    inlineViral: W >= 800,
    inlineZen: W >= 720,
    statusChips: W >= 1200,
  }
}

// ─── EditorHUD ────────────────────────────────────────────────────────────────

const EditorHUD: React.FC<EditorHUDProps> = ({
  projectName,
  setProjectName,
  autosaveStatus,
  historyIndex,
  historyLength,
  handleUndo,
  handleRedo,
  setShowKeyboardHelp,
  onLayoutChange,
  currentTime = 0,
  duration = 0,
  activeCategory,
  onCommandK,
  gpuBackend = null,
  gpuVendor,
  agentRunning = false,
  styleDNA,
  onNormalizeStyle,
  zenMode = false,
  setZenMode,
  onMakeItViral,
  isMakingViral = false,
  onExport
}) => {
  const reduceMotion = useReducedMotion()
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Measure the bar's own width to drive container-based responsiveness.
  const barRef = useRef<HTMLDivElement>(null)
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0
      // Round + threshold to avoid sub-pixel re-render loops.
      setBarWidth((prev) => (Math.abs(prev - w) > 1 ? Math.round(w) : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const L = useResponsiveLayout(barWidth)

  const canUndo = historyIndex > 0
  const canRedo = historyLength > 0 && historyIndex < historyLength - 1

  const closeAllMenus = () => { setLayoutOpen(false); setMoreOpen(false) }

  const toggleLayout = () => { setMoreOpen(false); setLayoutOpen((v) => !v) }
  const toggleMore = () => { setLayoutOpen(false); setMoreOpen((v) => !v) }

  // Single source of truth for closing menus: outside-click + Escape. This also
  // fixes the old bug where the layout dropdown never closed on outside-click.
  useEffect(() => {
    const anyOpen = layoutOpen || moreOpen
    if (!anyOpen) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) closeAllMenus()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAllMenus() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [layoutOpen, moreOpen])

  const categoryLabel = activeCategory ? CATEGORY_LABELS[activeCategory] : undefined

  // The overflow menu always exists (it hosts keyboard shortcuts plus anything
  // that didn't fit inline), so nothing is ever silently dropped from the HUD.

  const Divider = () => <div className="hidden sm:block h-6 w-px bg-white/10 shrink-0" />
  const gpuLabel = gpuBackend === 'webgpu' ? 'WebGPU' : gpuBackend === 'webgl2' ? 'WebGL2' : 'Canvas'

  return (
    <motion.div
      initial={reduceMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)] neural-hud-max-w"
    >
      {/* ── Main bar ── */}
      <div ref={barRef} className="flex items-center gap-2 sm:gap-3 h-14 px-3 sm:px-4 rounded-2xl border border-white/10 neural-hud-bar overflow-visible">

        {/* ════════ ZONE 1 · Identity ════════ */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>

          <div className="flex flex-col min-w-0">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Project name"
              className="bg-transparent border-none text-white font-semibold text-sm focus:ring-0 p-0 outline-none min-w-0 w-full max-w-[200px] truncate leading-tight"
              placeholder="Untitled project"
            />
            <AnimatePresence mode="wait">
              {L.categoryLabel && categoryLabel && (
                <motion.span
                  key={categoryLabel}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[10px] uppercase tracking-wide text-slate-500 leading-none truncate"
                >
                  {categoryLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Autosave status */}
          <div
            className={`flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg border text-[11px] font-medium shrink-0 ${
              autosaveStatus === 'saving'
                ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                : autosaveStatus === 'error'
                ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                : 'bg-white/[0.03] border-white/10 text-slate-400'
            }`}
            title={autosaveStatus === 'saving' ? 'Saving…' : autosaveStatus === 'error' ? 'Save failed' : 'All changes saved'}
            aria-label={autosaveStatus === 'saving' ? 'Saving' : autosaveStatus === 'error' ? 'Save failed' : 'Saved'}
          >
            {autosaveStatus === 'saving' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : autosaveStatus === 'error' ? (
              <AlertCircle className="w-3 h-3" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
            {L.saveLabel && (
              <span>{autosaveStatus === 'saving' ? 'Saving' : autosaveStatus === 'error' ? 'Save failed' : 'Saved'}</span>
            )}
          </div>
        </div>

        <Divider />

        {/* ── Undo / Redo ── */}
        {L.inlineUndoRedo && (
          <div className="flex items-center gap-1 shrink-0">
            <HUDTooltip label="Undo" shortcut="⌘ Z">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (⌘Z)"
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-300 hover:text-white active:scale-95"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            </HUDTooltip>
            <HUDTooltip label="Redo" shortcut="⌘ Y">
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (⌘Y)"
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-300 hover:text-white active:scale-95"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </HUDTooltip>
          </div>
        )}

        {L.inlineUndoRedo && <Divider />}

        {/* ════════ ZONE 2 · Context & insight ════════ */}
        {/* Timecode */}
        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
          <Timer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs font-mono tabular-nums text-white">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-slate-600">/</span>
          <span className="text-xs font-mono tabular-nums text-slate-500">{formatTime(duration)}</span>
        </div>

        {/* Command */}
        <button
          type="button"
          onClick={onCommandK}
          aria-label="Search or run a command"
          title="Search or run a command (⌘K)"
          className={`flex items-center gap-2.5 h-10 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 overflow-hidden ${
            L.commandText ? 'flex-1 min-w-[44px] max-w-[360px] px-3 justify-start' : 'w-10 shrink-0 px-0 justify-center'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
          {L.commandText && (
            <>
              <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors truncate">Search or run a command</span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <kbd className="text-[11px] font-medium border border-white/10 rounded px-1.5 py-0.5 leading-none text-slate-500 bg-black/30">⌘</kbd>
                <kbd className="text-[11px] font-medium border border-white/10 rounded px-1.5 py-0.5 leading-none text-slate-500 bg-black/30">K</kbd>
              </div>
            </>
          )}
        </button>

        {/* ════════ ZONE 3 · Actions ════════ */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Layout (inline) */}
          {L.inlineLayout && (
            <div className="relative">
              <HUDTooltip label="Workspace layout" shortcut="L">
                <button
                  type="button"
                  onClick={toggleLayout}
                  aria-label="Workspace layout"
                  aria-expanded={layoutOpen ? 'true' : 'false'}
                  title="Workspace layout (L)"
                  className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white active:scale-95"
                >
                  <Layout className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${layoutOpen ? 'rotate-180' : ''}`} />
                </button>
              </HUDTooltip>
              <AnimatePresence>
                {layoutOpen && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-white/10 neural-hud-dropdown p-1.5 z-[60]"
                  >
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500 border-b border-white/5 mb-1">Workspace layout</div>
                    {LAYOUT_MODES.map((mode) => {
                      const Icon = mode.icon
                      return (
                        <button
                          type="button"
                          key={mode.id}
                          onClick={() => { onLayoutChange({ focusMode: mode.id }); setLayoutOpen(false) }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left"
                        >
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium text-white">{mode.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{mode.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* GPU / Agent status (quiet, only on wide bars) */}
          {L.statusChips && (
            <div className="flex items-center gap-1.5">
              {gpuBackend && (
                <div className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-slate-400 flex items-center gap-1.5" title={gpuVendor || undefined}>
                  <Cpu className="w-3 h-3" /> GPU: {gpuLabel}
                </div>
              )}
              {agentRunning && (
                <div className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Bot className="w-3 h-3" /> AI agent running
                </div>
              )}
            </div>
          )}

          {/* Make Viral (inline) */}
          {onMakeItViral && L.inlineViral && (
            <button
              type="button"
              onClick={onMakeItViral}
              disabled={isMakingViral}
              className="flex items-center justify-center gap-2 px-2.5 sm:px-3 h-9 rounded-lg bg-primary-500/10 border border-primary-500/25 text-primary-300 hover:bg-primary-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait shrink-0"
              title="Run the one-click viral recipe — hook, cuts, B-roll, beat sync, CTA"
            >
              <Sparkles size={14} className={isMakingViral ? 'animate-spin' : ''} />
              <span className="text-[12px] font-medium">{isMakingViral ? 'Working…' : 'Make Viral'}</span>
            </button>
          )}

          {/* Focus mode (inline) */}
          {L.inlineZen && (
            <HUDTooltip label="Focus mode" shortcut="Z">
              <button
                type="button"
                onClick={() => setZenMode?.(!zenMode)}
                aria-label="Focus mode"
                aria-pressed={zenMode ? 'true' : 'false'}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 ${zenMode ? 'bg-primary-600 text-white' : 'hover:bg-white/[0.06] text-slate-400 hover:text-white'}`}
              >
                {zenMode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </HUDTooltip>
          )}

          {/* Overflow "More" menu — holds whatever didn't fit + keyboard shortcuts */}
          {(
            <div className="relative">
              <button
                type="button"
                onClick={toggleMore}
                aria-label="More actions"
                aria-expanded={moreOpen ? 'true' : 'false'}
                title="More"
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.06] transition-colors text-slate-400 hover:text-white active:scale-95"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-white/10 neural-hud-dropdown p-1.5 z-[60] max-h-[70vh] overflow-y-auto"
                  >
                    {!L.inlineUndoRedo && (
                      <>
                        <button type="button" disabled={!canUndo} onClick={() => { handleUndo(); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left disabled:opacity-30">
                          <Undo2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-[12px] font-medium text-white flex-1">Undo</span>
                          <span className="text-[10px] text-slate-500">⌘Z</span>
                        </button>
                        <button type="button" disabled={!canRedo} onClick={() => { handleRedo(); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left disabled:opacity-30">
                          <Redo2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-[12px] font-medium text-white flex-1">Redo</span>
                          <span className="text-[10px] text-slate-500">⌘Y</span>
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                      </>
                    )}

                    {onMakeItViral && !L.inlineViral && (
                      <button type="button" disabled={isMakingViral} onClick={() => { onMakeItViral(); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left disabled:opacity-50">
                        <Sparkles className={`w-4 h-4 text-primary-400 shrink-0 ${isMakingViral ? 'animate-spin' : ''}`} />
                        <span className="text-[12px] font-medium text-white">{isMakingViral ? 'Working…' : 'Make Viral'}</span>
                      </button>
                    )}

                    {!L.inlineZen && (
                      <button type="button" onClick={() => { setZenMode?.(!zenMode); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left">
                        {zenMode ? <EyeOff className="w-4 h-4 text-primary-400 shrink-0" /> : <Eye className="w-4 h-4 text-slate-400 shrink-0" />}
                        <span className="text-[12px] font-medium text-white flex-1">Focus mode</span>
                        <span className="text-[10px] text-slate-500">Z</span>
                      </button>
                    )}

                    {!L.inlineLayout && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-500">Workspace layout</div>
                        {LAYOUT_MODES.map((mode) => {
                          const Icon = mode.icon
                          return (
                            <button type="button" key={mode.id} onClick={() => { onLayoutChange({ focusMode: mode.id }); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left">
                              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="text-[12px] font-medium text-white">{mode.label}</span>
                            </button>
                          )
                        })}
                        <div className="h-px bg-white/5 my-1" />
                      </>
                    )}

                    <button type="button" onClick={() => { setShowKeyboardHelp(true); setMoreOpen(false) }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors text-left">
                      <Keyboard className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-[12px] font-medium text-white flex-1">Keyboard shortcuts</span>
                      <span className="text-[10px] text-slate-500">?</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Primary action */}
          <button
            type="button"
            onClick={onExport}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 h-9 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors active:scale-95 ml-0.5 shrink-0"
            title="Export and publish"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[12px] hidden sm:inline-block">Export</span>
          </button>
        </div>

      </div>
    </motion.div>
  )
}

export default EditorHUD
