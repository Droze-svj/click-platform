'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Zap,
  Search,
  Undo2,
  Redo2,
  Activity,
  TrendingUp,
  Flame,
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
  Brain,
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
  engagementScore?: number
  viralPotential?: number
  hookStrength?: number
  sentimentDensity?: number
  trendAlignment?: number
  retentionHeatmap?: number[]
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

/** SVG circular arc ring — shows score as a filled arc */
function ScoreRing({
  value,
  size = 20,
  strokeWidth = 2.5,
  color,
  animate = true,
}: {
  value: number
  size?: number
  strokeWidth?: number
  color: string
  animate?: boolean
}) {
  const safe = Math.max(0, Math.min(100, isFinite(value) ? value : 0))
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * (1 - safe / 100)

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        className="text-white/10"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={r}
        cx={size / 2}
        cy={size / 2}
      />
      <motion.circle
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        initial={animate ? { strokeDashoffset: circ } : false}
        animate={{ strokeDashoffset: fill }}
        transition={{ duration: animate ? 0.7 : 0, ease: 'easeOut' }}
        stroke={color}
        fill="transparent"
        r={r}
        cx={size / 2}
        cy={size / 2}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tiny sparkline SVG */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const pts = (Array.isArray(data) ? data : []).filter((n) => isFinite(n)).slice(-10)
  if (pts.length < 2) {
    return <div className="h-5 flex items-center text-[10px] text-slate-600">No data yet</div>
  }
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const W = 80
  const H = 20
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W)
  const ys = pts.map((v) => H - ((v - min) / range) * H)
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2} fill={color} />
    </svg>
  )
}

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

/** Mini bar chart for a sub-score */
function ScoreBar({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, isFinite(value) ? value : 0))
  const barColorClass =
    safe >= 90 ? 'bg-emerald-400' : safe >= 70 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-400 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${barColorClass}`}
        />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-slate-300 w-6 text-right">{safe}</span>
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

const clampScore = (v: number) => Math.max(0, Math.min(100, isFinite(v) ? Math.round(v) : 0))

const scoreRingColor = (v: number) =>
  v >= 90 ? '#34d399' : v >= 70 ? '#fbbf24' : '#f87171'

const scoreTxtColor = (v: number) =>
  v >= 90 ? 'text-emerald-400' : v >= 70 ? 'text-amber-400' : 'text-rose-400'

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
    secondaryScores: W >= 540, // show Viral + Hook pills (Retention always shows)
    scoreLabels: W >= 1180,
    inlineLayout: W >= 920,
    inlineViral: W >= 800,
    inlineZen: W >= 720,
    statusChips: W >= 1200,
  }
}

// ─── Metric Pill ─────────────────────────────────────────────────────────────

function MetricPill({
  icon: Icon,
  value,
  label,
  showLabel,
  isOpen,
  onClick,
}: {
  icon: React.ElementType
  value: number
  label: string
  showLabel: boolean
  isOpen: boolean
  onClick: () => void
}) {
  const v = clampScore(value)
  const col = scoreRingColor(v)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} score ${v}%`}
      aria-haspopup="dialog"
      aria-expanded={isOpen ? 'true' : 'false'}
      className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors bg-white/[0.03] shrink-0 ${
        isOpen ? 'border-primary-500/40 bg-primary-500/5' : 'border-white/10 hover:bg-white/[0.06]'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40`}
      style={{ '--icon-col': col } as any}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <ScoreRing value={v} size={20} strokeWidth={2.5} color={col} />
        <Icon className="absolute w-2.5 h-2.5 text-[var(--icon-col)]" />
      </div>
      <span className={`font-mono tabular-nums ${scoreTxtColor(v)}`}>{v}%</span>
      {showLabel && <span className="text-slate-400">{label}</span>}
    </button>
  )
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
  engagementScore = 85,
  viralPotential = 78,
  hookStrength = 92,
  sentimentDensity = 70,
  trendAlignment = 82,
  retentionHeatmap = Array(20).fill(80).map((v, i) => v - i * 2),
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
  const [openMetric, setOpenMetric] = useState<'engagement' | 'viral' | 'hook' | null>(null)

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

  const eng = clampScore(engagementScore)
  const viral = clampScore(viralPotential)
  const hook = clampScore(hookStrength)

  const canUndo = historyIndex > 0
  const canRedo = historyLength > 0 && historyIndex < historyLength - 1

  const closeAllMenus = () => { setLayoutOpen(false); setMoreOpen(false); setOpenMetric(null) }

  const toggleMetric = (key: 'engagement' | 'viral' | 'hook') => {
    setLayoutOpen(false); setMoreOpen(false)
    setOpenMetric((prev) => (prev === key ? null : key))
  }
  const toggleLayout = () => { setMoreOpen(false); setOpenMetric(null); setLayoutOpen((v) => !v) }
  const toggleMore = () => { setLayoutOpen(false); setOpenMetric(null); setMoreOpen((v) => !v) }

  // Single source of truth for closing menus: outside-click + Escape. This also
  // fixes the old bug where the layout dropdown never closed on outside-click.
  useEffect(() => {
    const anyOpen = layoutOpen || moreOpen || openMetric
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
  }, [layoutOpen, moreOpen, openMetric])

  const categoryLabel = activeCategory ? CATEGORY_LABELS[activeCategory] : undefined

  const aiTips: Record<string, string> = {
    engagement: eng >= 85 ? 'Strong retention. Add a call-to-action around 80%.' : 'Add cuts or energy mid-roll to keep viewers watching.',
    viral: viral >= 80 ? 'Viral potential is high. Add a hook overlay on the first frame.' : 'Increase pacing in the first 5s to boost shares.',
    hook: hook >= 88 ? 'Hook is excellent. Lock in the opening frame.' : 'Open with a bold statement. Shorten the talking-head intro.',
  }

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

        {/* Scores */}
        <div className="relative flex items-center gap-1.5 shrink-0">
          <MetricPill icon={Activity} value={eng} label="Retention" showLabel={L.scoreLabels} isOpen={openMetric === 'engagement'} onClick={() => toggleMetric('engagement')} />
          {L.secondaryScores && (
            <>
              <MetricPill icon={Flame} value={viral} label="Viral" showLabel={L.scoreLabels} isOpen={openMetric === 'viral'} onClick={() => toggleMetric('viral')} />
              <MetricPill icon={TrendingUp} value={hook} label="Hook" showLabel={L.scoreLabels} isOpen={openMetric === 'hook'} onClick={() => toggleMetric('hook')} />
            </>
          )}

          <AnimatePresence>
            {openMetric && (
              <MetricPopover
                title={openMetric === 'engagement' ? 'Retention' : openMetric === 'viral' ? 'Viral potential' : 'Hook strength'}
                value={openMetric === 'engagement' ? eng : openMetric === 'viral' ? viral : hook}
                heatmap={retentionHeatmap}
                allScores={{ 'Retention': eng, 'Viral': viral, 'Hook': hook, 'Sentiment': clampScore(sentimentDensity), 'Trend': clampScore(trendAlignment) }}
                tip={aiTips[openMetric]}
                reduceMotion={!!reduceMotion}
              />
            )}
          </AnimatePresence>
        </div>

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

// ─── Metrics Popover ─────────────────────────────────────────────────────────

function MetricPopover({
  title,
  value,
  heatmap,
  allScores,
  tip,
  reduceMotion,
}: {
  title: string
  value: number
  heatmap: number[]
  allScores: Record<string, number>
  tip: string
  reduceMotion: boolean
}) {
  const col = scoreRingColor(value)

  return (
    <motion.div
      role="dialog"
      aria-label={`${title} details`}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-2 z-[70] w-56 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 neural-hud-dropdown p-3.5"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold text-white">{title}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Live score</div>
        </div>
        <div className="flex items-baseline gap-1" style={{ '--score-col': col } as any}>
          <span className="text-[18px] font-semibold font-mono tabular-nums text-[var(--score-col)]">{value}</span>
          <span className="text-[11px] text-slate-500">/ 100</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Retention over time</div>
        <MiniSparkline data={heatmap} color={col} />
      </div>

      <div className="h-px bg-white/5 mb-3" />

      <div className="flex flex-col gap-2 mb-3">
        {Object.entries(allScores).map(([k, v]) => (
          <ScoreBar key={k} label={k} value={v} />
        ))}
      </div>

      <div className="h-px bg-white/5 mb-2.5" />

      <div className="flex gap-2">
        <Brain className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">{tip}</p>
      </div>
    </motion.div>
  )
}

export default EditorHUD
