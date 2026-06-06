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
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * (1 - value / 100)

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
  const pts = data.slice(-10)
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
  const barColorClass =
    value >= 90 ? 'bg-emerald-400' : value >= 70 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${barColorClass}`}
        />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-slate-300 w-6 text-right">{value}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const scoreRingColor = (v: number) =>
  v >= 90 ? '#34d399' : v >= 70 ? '#fbbf24' : '#f87171'

const scoreTxtColor = (v: number) =>
  v >= 90 ? 'text-emerald-400' : v >= 70 ? 'text-amber-400' : 'text-rose-400'

// ─── Metric Pill ─────────────────────────────────────────────────────────────

function MetricPill({
  icon: Icon,
  value,
  label,
  isOpen,
  onClick,
}: {
  icon: React.ElementType
  value: number
  label: string
  isOpen: boolean
  onClick: () => void
}) {
  const col = scoreRingColor(value)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} score ${value}%`}
      aria-haspopup="dialog"
      className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors bg-white/[0.03] ${
        isOpen ? 'border-primary-500/40 bg-primary-500/5' : 'border-white/10 hover:bg-white/[0.06]'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40`}
      style={{ '--icon-col': col } as any}
    >
      {/* Ring + icon combined */}
      <div className="relative flex items-center justify-center shrink-0">
        <ScoreRing value={value} size={20} strokeWidth={2.5} color={col} />
        <Icon className="absolute w-2.5 h-2.5 text-[var(--icon-col)]" />
      </div>

      <span className={`font-mono tabular-nums ${scoreTxtColor(value)}`}>{value}%</span>
      <span className="text-slate-400 hidden xl:block">{label}</span>
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
  const [openMetric, setOpenMetric] = useState<'engagement' | 'viral' | 'hook' | null>(null)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyLength - 1

  const toggleMetric = (key: 'engagement' | 'viral' | 'hook') => {
    setOpenMetric((prev) => (prev === key ? null : key))
  }

  // Close popover on outside click
  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenMetric(null)
      }
    }
    if (openMetric) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMetric])

  const categoryLabel = activeCategory ? CATEGORY_LABELS[activeCategory] : undefined

  const aiTips: Record<string, string> = {
    engagement: engagementScore >= 85 ? 'Strong retention. Add a call-to-action around 80%.' : 'Add cuts or energy mid-roll to keep viewers watching.',
    viral: viralPotential >= 80 ? 'Viral potential is high. Add a hook overlay on the first frame.' : 'Increase pacing in the first 5s to boost shares.',
    hook: hookStrength >= 88 ? 'Hook is excellent. Lock in the opening frame.' : 'Open with a bold statement. Shorten the talking-head intro.',
  }

  // One consistent divider used between zones.
  const Divider = () => <div className="hidden sm:block h-6 w-px bg-white/10 shrink-0" />

  return (
    <motion.div
      initial={reduceMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-6rem)] neural-hud-max-w"
    >
      {/* ── Main bar ── */}
      <div className="flex items-center gap-3 h-14 px-4 rounded-2xl border border-white/10 neural-hud-bar">

        {/* ════════ ZONE 1 · Identity ════════ */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>

          <div className="flex flex-col min-w-0">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label="Project name"
              className="bg-transparent border-none text-white font-semibold text-sm focus:ring-0 p-0 outline-none min-w-[80px] max-w-[140px] sm:max-w-[200px] lg:max-w-[300px] w-full truncate leading-tight"
              placeholder="Untitled project"
            />
            <AnimatePresence mode="wait">
              {categoryLabel && (
                <motion.span
                  key={categoryLabel}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[10px] uppercase tracking-wide text-slate-500 leading-none hidden sm:block"
                >
                  {categoryLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Autosave status */}
          <AnimatePresence mode="wait">
            <motion.div
              key={autosaveStatus}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg border text-[11px] font-medium shrink-0 ${
                autosaveStatus === 'saving'
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                  : autosaveStatus === 'error'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  : 'bg-white/[0.03] border-white/10 text-slate-400'
              }`}
            >
              {autosaveStatus === 'saving' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : autosaveStatus === 'error' ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              )}
              <span className="hidden xl:block">
                {autosaveStatus === 'saving' ? 'Saving' : autosaveStatus === 'error' ? 'Save failed' : 'Saved'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <Divider />

        {/* ── Undo / Redo ── */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <HUDTooltip label="Undo" shortcut="⌘ Z">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (⌘Z)"
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors text-slate-300 hover:text-white active:scale-95"
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
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-colors text-slate-300 hover:text-white active:scale-95"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </HUDTooltip>
        </div>

        <Divider />

        {/* ════════ ZONE 2 · Context & insight ════════ */}
        {/* Timecode */}
        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10">
          <Timer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs font-mono tabular-nums text-white">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-slate-600">/</span>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {formatTime(duration)}
          </span>
        </div>

        {/* Command */}
        <button
          type="button"
          onClick={onCommandK}
          aria-label="Search or run a command"
          title="Search or run a command (⌘K)"
          className="flex-1 md:flex-none md:w-auto min-w-[40px] max-w-[360px] flex items-center justify-center md:justify-start gap-2.5 px-2 md:px-3 h-10 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 overflow-hidden"
        >
          <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" />
          <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors truncate hidden md:inline-block">
            Search or run a command
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <kbd className="text-[11px] font-medium border border-white/10 rounded px-1.5 py-0.5 leading-none text-slate-500 bg-black/30">⌘</kbd>
            <kbd className="text-[11px] font-medium border border-white/10 rounded px-1.5 py-0.5 leading-none text-slate-500 bg-black/30">K</kbd>
          </div>
        </button>

        {/* Scores */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar max-w-[140px] md:max-w-[240px] lg:max-w-none" ref={popoverRef}>
          <MetricPill
            icon={Activity}
            value={engagementScore}
            label="Retention"
            isOpen={openMetric === 'engagement'}
            onClick={() => toggleMetric('engagement')}
          />
          <MetricPill
            icon={Flame}
            value={viralPotential}
            label="Viral"
            isOpen={openMetric === 'viral'}
            onClick={() => toggleMetric('viral')}
          />
          <MetricPill
            icon={TrendingUp}
            value={hookStrength}
            label="Hook"
            isOpen={openMetric === 'hook'}
            onClick={() => toggleMetric('hook')}
          />

          <AnimatePresence>
            {openMetric && (
              <MetricPopover
                title={openMetric === 'engagement' ? 'Retention' : openMetric === 'viral' ? 'Viral potential' : 'Hook strength'}
                value={openMetric === 'engagement' ? engagementScore : openMetric === 'viral' ? viralPotential : hookStrength}
                label={openMetric === 'engagement' ? 'Retention' : openMetric === 'viral' ? 'Viral' : 'Hook'}
                heatmap={retentionHeatmap}
                allScores={{
                  'Retention': engagementScore,
                  'Viral': viralPotential,
                  'Hook': hookStrength,
                  'Sentiment': sentimentDensity,
                  'Trend': trendAlignment
                }}
                tip={aiTips[openMetric]}
                reduceMotion={!!reduceMotion}
              />
            )}
          </AnimatePresence>
        </div>

        <Divider />

        {/* ════════ ZONE 3 · Actions ════════ */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Layout */}
          <div className="relative hidden sm:block">
            <HUDTooltip label="Workspace layout" shortcut="L">
              <button
                type="button"
                onClick={() => setLayoutOpen((v) => !v)}
                aria-label="Workspace layout"
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
                  className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-white/10 neural-hud-dropdown p-1.5 z-50"
                >
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500 border-b border-white/5 mb-1">Workspace layout</div>
                  {[
                    { id: 'balanced', label: 'Balanced', icon: LayoutGrid, desc: 'Even split of preview and timeline' },
                    { id: 'preview', label: 'Cinematic', icon: Film, desc: 'Larger preview, focus on playback' },
                    { id: 'timeline', label: 'Timeline focus', icon: Clock, desc: 'More room for fine timeline edits' },
                  ].map((mode) => {
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

          {/* GPU / Agent status (quiet, only when present) */}
          <div className="hidden xl:flex items-center gap-1.5">
            {gpuBackend && (
              <div className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3 h-3" />
                GPU: {gpuBackend === 'webgpu' ? 'WebGPU' : gpuBackend === 'webgl2' ? 'WebGL2' : 'Canvas'}
              </div>
            )}
            {agentRunning && (
              <div className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                <Bot className="w-3 h-3" />
                AI agent running
              </div>
            )}
          </div>

          {onMakeItViral && (
            <button
              type="button"
              onClick={onMakeItViral}
              disabled={isMakingViral}
              className="flex items-center justify-center gap-2 px-2.5 sm:px-3 h-9 rounded-lg bg-primary-500/10 border border-primary-500/25 text-primary-300 hover:bg-primary-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
              title="Run the one-click viral recipe — hook, cuts, B-roll, beat sync, CTA"
            >
              <Sparkles size={14} className={isMakingViral ? 'animate-spin' : ''} />
              <span className="text-[12px] font-medium hidden sm:inline-block">
                {isMakingViral ? 'Working…' : 'Make Viral'}
              </span>
            </button>
          )}

          <HUDTooltip label="Focus mode" shortcut="Z">
            <button
              type="button"
              onClick={() => setZenMode?.(!zenMode)}
              aria-label="Focus mode"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 ${zenMode ? 'bg-primary-600 text-white' : 'hover:bg-white/[0.06] text-slate-400 hover:text-white'}`}
            >
              {zenMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </HUDTooltip>

          {/* Primary action */}
          <button
            type="button"
            onClick={onExport}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 h-9 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors active:scale-95 ml-0.5"
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
  label,
  heatmap,
  allScores,
  tip,
  reduceMotion,
}: {
  title: string
  value: number
  label: string
  heatmap: number[]
  allScores: Record<string, number>
  tip: string
  reduceMotion: boolean
}) {
  const col = scoreRingColor(value)

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 mt-2 z-[60] w-56 max-h-[80vh] overflow-y-auto rounded-xl border border-white/10 neural-hud-dropdown p-3.5"
    >
      {/* Header */}
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

      {/* Sparkline */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Retention over time</div>
        <MiniSparkline data={heatmap} color={col} />
      </div>

      <div className="h-px bg-white/5 mb-3" />

      {/* All sub-scores */}
      <div className="flex flex-col gap-2 mb-3">
        {Object.entries(allScores).map(([k, v]) => (
          <ScoreBar key={k} label={k} value={v} />
        ))}
      </div>

      <div className="h-px bg-white/5 mb-2.5" />

      {/* AI tip */}
      <div className="flex gap-2">
        <Brain className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">{tip}</p>
      </div>
    </motion.div>
  )
}

export default EditorHUD
