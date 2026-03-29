'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Search,
  Undo2,
  Redo2,
  Keyboard,
  Activity,
  TrendingUp,
  Flame,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Layout,
  Sparkles,
  Radio,
  Target,
  Brain,
  Timer,
  Cpu,
  Bot,
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
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** SVG circular arc ring — shows score as a filled arc */
function ScoreRing({
  value,
  size = 20,
  strokeWidth = 2.5,
  color,
}: {
  value: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * (1 - value / 100)

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={fill}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  )
}

/** Tiny 8-point sparkline SVG */
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
    timer.current = setTimeout(() => setShow(true), 600)
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
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-[60] pointer-events-none"
          >
            <div className="neural-hud-dropdown rounded-xl px-2.5 py-1.5 whitespace-nowrap border border-white/10">
              <div className="text-[10px] font-black text-white">{label}</div>
              {shortcut && (
                <div className="text-[9px] text-slate-500 mt-0.5">{shortcut}</div>
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
  const col =
    value >= 90 ? '#34d399' : value >= 70 ? '#fbbf24' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-slate-400 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: col }}
        />
      </div>
      <span className="text-[9px] font-mono font-black text-slate-300 w-6 text-right">{value}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Partial<Record<EditorCategory, string>> = {
  'edit': 'KINETIC_CALIBRATION',
  'color': 'SPECTRAL_GRADING',
  'ai': 'NEURAL_SYNTHESIS',
  'effects': 'VISUAL_FX_MATRIX',
  'timeline': 'TEMPORAL_SEQUENCE',
  'export': 'FINAL_MANIFEST',
  'style-vault': 'DNA_VAULT_CORE',
  'ai-edit': 'AGENTIC_REVISION',
  'assets': 'NEURAL_LATTICE_ASSETS',
  'growth': 'RETENTION_TELEMETRY',
  'chromakey': 'CHROMA_ISOLATION',
  'visual-fx': 'SYNTHETIC_FX',
  'ai-analysis': 'COGNITIVE_ANALYSIS',
  'collaborate': 'SWARM_SYNC',
  'scripts': 'NARRATIVE_NODE',
  'scheduling': 'TEMPORAL_DISPATCH',
  'short-clips': 'FRAGMENT_SYNTHESIS',
  'predict': 'RETENTION_FORECAST',
  'distribution': 'LATTICE_BROADCAST',
  'spatial': 'SPATIAL_MATRIX',
  'agent': 'AUTONOMOUS_ENTITY',
  'dub': 'VOCAL_DOPPELGANGER',
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

const scoreBg = (v: number) =>
  v >= 90
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : v >= 70
    ? 'bg-amber-500/10 border-amber-500/20'
    : 'bg-rose-500/10 border-rose-500/20'

// ─── Delta Flasher hook ───────────────────────────────────────────────────────

function useDelta(value: number) {
  const prev = useRef(value)
  const [delta, setDelta] = useState<number | null>(null)

  useEffect(() => {
    const diff = value - prev.current
    if (diff !== 0) {
      setDelta(diff)
      const t = setTimeout(() => setDelta(null), 2000)
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value])

  return delta
}

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
  const delta = useDelta(value)
  const col = scoreRingColor(value)

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black transition-all ${scoreBg(value)} ${
        isOpen ? 'ring-1 ring-indigo-500/40' : ''
      } hover:brightness-125`}
    >
      {/* Ring + icon combined */}
      <div className="relative flex items-center justify-center shrink-0">
        <ScoreRing value={value} size={18} strokeWidth={2} color={col} />
        <Icon className="absolute w-2 h-2" style={{ color: col }} />
      </div>

      <span className={`font-mono tabular-nums ${scoreTxtColor(value)}`}>{value}%</span>
      <span className="text-slate-500 hidden lg:block">{label}</span>

      {/* Delta flash */}
      <AnimatePresence>
        {delta !== null && (
          <motion.span
            initial={{ opacity: 0, y: -6, scale: 0.8 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.3 }}
            className={`absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-black pointer-events-none ${
              delta > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </motion.span>
        )}
      </AnimatePresence>
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
  onNormalizeStyle
}) => {
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
    engagement: engagementScore >= 85 ? 'Strong retention. Add a call-to-action at 80%.' : 'Add cuts or energy at mid-roll to keep viewers hooked.',
    viral: viralPotential >= 80 ? 'Viral potential is high. Add a hook overlay in frame 1.' : 'Increase pacing in the first 5s to boost shares.',
    hook: hookStrength >= 88 ? 'Hook is excellent. Lock in opening frame.' : 'Start with a bold statement. Reduce talking-head duration.',
  }

  return (
    <motion.div
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-50 w-full px-4 neural-hud-max-w"
    >
      {/* ── Main bar ── */}
      <div className="flex items-center gap-2 h-12 px-3 rounded-2xl border border-white/[0.07] neural-hud-bar">

        {/* ── Brand + Project Name ── */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
            <Zap className="w-3.5 h-3.5 text-white fill-white" />
          </div>

          <div className="flex flex-col min-w-0">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent border-none text-white font-black text-[12px] tracking-tight focus:ring-0 p-0 outline-none w-[120px] truncate leading-tight"
              placeholder="Untitled Project"
            />
            {/* Context label */}
            <AnimatePresence mode="wait">
              {categoryLabel && (
                <motion.span
                  key={categoryLabel}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400/60 leading-tight hidden sm:block"
                >
                  • {categoryLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Autosave pill — animated cross-fade */}
          <AnimatePresence mode="wait">
            <motion.div
              key={autosaveStatus}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest shrink-0 ${
                autosaveStatus === 'saving'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : autosaveStatus === 'error'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              {autosaveStatus === 'saving' ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : autosaveStatus === 'error' ? (
                <AlertCircle className="w-2.5 h-2.5" />
              ) : (
                <CheckCircle2 className="w-2.5 h-2.5" />
              )}
              <span className="hidden sm:block">
                {autosaveStatus === 'saving' ? 'SYNCHRONIZING' : autosaveStatus === 'error' ? 'ABORTED' : 'COMMITTED'}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Style DNA Sync Badge */}
          {styleDNA && (
            <div 
              onClick={onNormalizeStyle}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 group cursor-pointer hover:bg-indigo-500/10 transition-all"
            >
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
               <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Style Sync: {styleDNA.theme || 'Vlog'}</span>
               <div className="hidden group-hover:flex items-center gap-1 ml-1 pl-1 border-l border-white/10">
                  <span className="text-[7px] text-white font-bold opacity-70">Nudge to DNA?</span>
               </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-white/[0.06] mx-1 shrink-0" />

        {/* ── Undo / Redo ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <HUDTooltip label="Undo" shortcut="⌘ Z">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="relative flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/[0.06] disabled:opacity-25 transition-all text-slate-300 hover:text-white"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <AnimatePresence>
                {canUndo && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-600 text-[7px] font-black flex items-center justify-center text-white leading-none"
                  >
                    {Math.min(historyIndex, 9)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </HUDTooltip>

          <HUDTooltip label="Redo" shortcut="⌘ Y">
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/[0.06] disabled:opacity-25 transition-all text-slate-300 hover:text-white"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </HUDTooltip>
        </div>

        <div className="h-6 w-px bg-white/[0.06] mx-1 shrink-0" />

        {/* ── Live Timecode ── */}
        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Timer className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-[11px] font-mono font-black text-indigo-300 tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[9px] text-slate-600 font-black">/</span>
          <span className="text-[11px] font-mono font-black text-slate-500 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        <div className="h-6 w-px bg-white/[0.06] mx-1 shrink-0" />

        {/* ── Neural Command ── */}
        <button
          onClick={onCommandK}
          className="flex-1 min-w-0 flex items-center gap-2.5 px-3 h-8 rounded-xl border border-white/[0.06] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group neural-hud-command"
        >
          <Search className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
          <span className="text-[10px] font-black italic uppercase tracking-[0.25em] text-slate-600 group-hover:text-slate-400 transition-colors truncate">
            NEURAL_SYNAPSE…
          </span>
          <div className="flex items-center gap-0.5 ml-auto shrink-0 opacity-40 group-hover:opacity-70 transition-opacity">
            <kbd className="text-[9px] font-black border border-white/20 rounded px-1 py-px leading-none text-slate-400">⌘</kbd>
            <kbd className="text-[9px] font-black border border-white/20 rounded px-1 py-px leading-none text-slate-400">K</kbd>
          </div>
        </button>

        <div className="h-6 w-px bg-white/[0.06] mx-1 shrink-0" />

        {/* ── Metrics with rings + popovers ── */}
        <div className="flex items-center gap-1.5 shrink-0" ref={popoverRef}>
          {/* Engagement */}
          <div className="relative">
            <MetricPill
              icon={Activity}
              value={engagementScore}
              label="Ret."
              isOpen={openMetric === 'engagement'}
              onClick={() => toggleMetric('engagement')}
            />
            <AnimatePresence>
              {openMetric === 'engagement' && (
                <MetricPopover
                  title="Retention"
                  value={engagementScore}
                  heatmap={retentionHeatmap}
                  allScores={{ 'Viral': viralPotential, 'Hook': hookStrength, 'Sentiment': sentimentDensity, 'Trend': trendAlignment }}
                  tip={aiTips.engagement}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Viral */}
          <div className="relative">
            <MetricPill
              icon={Flame}
              value={viralPotential}
              label="Viral"
              isOpen={openMetric === 'viral'}
              onClick={() => toggleMetric('viral')}
            />
            <AnimatePresence>
              {openMetric === 'viral' && (
                <MetricPopover
                  title="Viral Potential"
                  value={viralPotential}
                  heatmap={retentionHeatmap}
                  allScores={{ 'Retention': engagementScore, 'Hook': hookStrength, 'Sentiment': sentimentDensity, 'Trend': trendAlignment }}
                  tip={aiTips.viral}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Hook */}
          <div className="relative">
            <MetricPill
              icon={TrendingUp}
              value={hookStrength}
              label="Hook"
              isOpen={openMetric === 'hook'}
              onClick={() => toggleMetric('hook')}
            />
            <AnimatePresence>
              {openMetric === 'hook' && (
                <MetricPopover
                  title="Hook Strength"
                  value={hookStrength}
                  heatmap={retentionHeatmap}
                  allScores={{ 'Retention': engagementScore, 'Viral': viralPotential, 'Sentiment': sentimentDensity, 'Trend': trendAlignment }}
                  tip={aiTips.hook}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="h-6 w-px bg-white/[0.06] mx-1 shrink-0" />

        {/* ── Action Buttons ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <HUDTooltip label="Keyboard Shortcuts" shortcut="?">
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/[0.06] transition-all text-slate-500 hover:text-white"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </HUDTooltip>

          {/* Layout picker */}
          <div className="relative">
            <HUDTooltip label="Layout" shortcut="Change view mode">
              <button
                onClick={() => setLayoutOpen((v) => !v)}
                className="flex items-center gap-1 px-2 h-8 rounded-xl hover:bg-white/[0.06] transition-all text-slate-500 hover:text-white"
              >
                <Layout className="w-3.5 h-3.5" />
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${layoutOpen ? 'rotate-180' : ''}`} />
              </button>
            </HUDTooltip>

            <AnimatePresence>
              {layoutOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-52 rounded-2xl border border-white/10 overflow-hidden z-50 neural-hud-dropdown"
                >
                  <div className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">WORKSPACE_LAYOUT</div>
                  {[
                    { id: 'balanced', label: 'BALANCED_MATRIX', icon: '⚖️', desc: 'Hybrid Kinetic Calibration' },
                    { id: 'preview', label: 'PREVIEW_CORE', icon: '🎬', desc: 'Full-Spectrum Monitoring' },
                    { id: 'timeline', label: 'SEQUENCE_FOCUS', icon: '🎵', desc: 'Deep Temporal Sequencing' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => { onLayoutChange({ focusMode: mode.id }); setLayoutOpen(false) }}
                      className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/5 transition-all text-left"
                    >
                      <span className="text-sm mt-0.5 shrink-0">{mode.icon}</span>
                      <div>
                        <div className="text-[10px] font-black text-white">{mode.label}</div>
                        <div className="text-[9px] text-slate-500">{mode.desc}</div>
                      </div>
                    </button>
                  ))}
                  <div className="h-px bg-white/5 my-1 mx-3" />
                  <div className="px-3 pb-1 text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">TEMPORAL_DENSITY</div>
                  {[
                    { id: 'compact', label: 'Compact', icon: '▬' },
                    { id: 'comfortable', label: 'Comfortable', icon: '▭' },
                    { id: 'expanded', label: 'Expanded', icon: '▤' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { onLayoutChange({ timelineDensity: d.id }); setLayoutOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 transition-all text-left"
                    >
                      <span className="text-xs text-slate-500">{d.icon}</span>
                      <div className="text-[10px] font-black text-slate-300">{d.label}</div>
                    </button>
                  ))}
                  <div className="pb-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <HUDTooltip label="Neural AI" shortcut="Open AI console">
            <button className="relative group flex items-center justify-center w-8 h-8 rounded-xl hover:bg-indigo-600 transition-all text-slate-400 hover:text-white">
              <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <Sparkles className="w-3.5 h-3.5 relative z-10" />
            </button>
          </HUDTooltip>

          {/* GPU Engine Badge */}
          {gpuBackend && gpuBackend !== 'canvas2d' && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                gpuBackend === 'webgpu'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
              title={gpuVendor ?? 'GPU Accelerated'}
            >
              <Cpu className="w-3 h-3" />
              <span className="hidden lg:block">{gpuBackend === 'webgpu' ? 'WebGPU' : 'WebGL2'}</span>
            </div>
          )}

          {/* Agent Running Badge */}
          {agentRunning && (
            <div className="flex items-center gap-1.5 ml-1 px-2 py-1 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20">
              <Bot className="w-3 h-3 text-fuchsia-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400 hidden lg:block">Agent_Active</span>
            </div>
          )}

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 ml-1 px-2 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <Radio className="w-3 h-3 text-rose-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 hidden lg:block">Live</span>
          </div>
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
}: {
  title: string
  value: number
  heatmap: number[]
  allScores: Record<string, number>
  tip: string
}) {
  const col = scoreRingColor(value)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="absolute top-full left-0 mt-2 z-[60] w-52 rounded-2xl border border-white/10 overflow-hidden neural-hud-dropdown p-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{title}</div>
          <div className="text-[9px] text-slate-500 mt-0.5">Live Neural Score</div>
        </div>
        <div className="flex items-center gap-1">
          <ScoreRing value={value} size={28} strokeWidth={3} color={col} />
          <span className="text-[14px] font-black font-mono" style={{ color: col }}>{value}</span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mb-3">
        <div className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 mb-1">Retention Heatmap</div>
        <MiniSparkline data={heatmap} color={col} />
      </div>

      <div className="h-px bg-white/5 mb-2.5" />

      {/* All sub-scores */}
      <div className="flex flex-col gap-1.5 mb-2.5">
        {Object.entries(allScores).map(([k, v]) => (
          <ScoreBar key={k} label={k} value={v} />
        ))}
      </div>

      <div className="h-px bg-white/5 mb-2" />

      {/* AI tip */}
      <div className="flex gap-1.5">
        <Brain className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-slate-400 leading-relaxed">{tip}</p>
      </div>
    </motion.div>
  )
}

export default EditorHUD
