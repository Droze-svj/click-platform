'use client'

/**
 * AIDirectorView — interactive co-pilot for the editor's AI tab.
 *
 * Flow: guidance controls → POST /api/ai/director/plan → 2-3 editable
 * "directions" → expand a direction to see its steps → edit a step's
 * obvious param inline → Apply (real timeline edit via the SAME
 * useTimelineActions dispatcher AIAssistView uses) or Skip → per-direction
 * Apply-all / Dismiss. Every action POSTs /api/ai/director/feedback.
 *
 * Honesty rules (owner's #1 rule):
 *  - We never render fabricated directions/steps. Until the user clicks
 *    Generate, the surface shows an honest empty state.
 *  - Backend error strings (needs-config / no-transcript) are shown
 *    verbatim with a retry.
 *  - Step types the dispatcher supports (cut/broll/hook/transition/audio/
 *    effect/caption/cta) apply for real via the timeline dispatcher.
 *    color/pacing apply for real via the onApplyColorGrade/onApplyPacing
 *    callbacks (global editor settings). A step is only "preview only" if its
 *    real apply path isn't available — we never pretend something applied.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Scissors,
  Film,
  Target,
  ArrowDownToLine,
  Volume2,
  Wand2,
  Type,
  Palette,
  Gauge,
  MousePointerClick,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  X,
  SkipForward,
  ArrowUpRight,
  CheckCheck,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { apiPost } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'
import type { AIDirectorSuggestion } from '../../../types/editor'
import type { useTimelineActions } from '../../../hooks/useTimelineActions'

// ── Director step / direction shapes returned by the backend ──────────────
type DirectorStepType =
  | 'cut' | 'broll' | 'hook' | 'transition' | 'audio' | 'effect'
  | 'caption' | 'color' | 'pacing' | 'cta'

interface DirectorStep {
  type: DirectorStepType
  time?: number
  params?: Record<string, any>
  reasoning?: string
  confidence?: number
  impact?: 'low' | 'medium' | 'high'
}

interface DirectorDirection {
  id: string
  title: string
  vibe?: string
  reasoning?: string
  estImpact?: string
  steps: DirectorStep[]
}

interface PlanResponse {
  success: boolean
  directions?: DirectorDirection[]
  meta?: any
  error?: string
}

// Step types the existing applySuggestion dispatcher can turn into a real
// timeline edit (now including caption + cta as real overlay patches).
// color/pacing are NOT here — they route through onApplyColorGrade/onApplyPacing
// and become applicable only when those callbacks are provided (see APPLICABLE).
const TIMELINE_APPLICABLE: Set<DirectorStepType> = new Set<DirectorStepType>([
  'cut', 'broll', 'hook', 'transition', 'audio', 'effect', 'caption', 'cta',
])

const STEP_ICON: Record<DirectorStepType, React.ComponentType<{ className?: string }>> = {
  cut: Scissors,
  broll: Film,
  hook: Target,
  transition: ArrowDownToLine,
  audio: Volume2,
  effect: Wand2,
  caption: Type,
  color: Palette,
  pacing: Gauge,
  cta: MousePointerClick,
}

const IMPACT_TONE: Record<'low' | 'medium' | 'high', { bar: string; text: string; bg: string }> = {
  high: { bar: 'bg-rose-500', text: 'text-rose-300', bg: 'bg-rose-500/10' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  low: { bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

type TimelineActions = ReturnType<typeof useTimelineActions>

export interface AIDirectorViewProps {
  videoId: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  /** Same instance AIAssistView receives — reuses dispatcher + undo. */
  timelineActions: TimelineActions
  niche?: string
  platform?: string
  targetLanguage?: string
  /** When true, auto-run Generate on mount (set by Make Viral button). */
  autoGenerate?: boolean
  /** Apply a color grade globally (cinematic|warm|cool|vibrant|moody|bw). Returns whether it applied. */
  onApplyColorGrade?: (grade: string) => boolean | void
  /** Apply a pacing strategy globally (punchy|steady|dynamic). Returns whether it applied. */
  onApplyPacing?: (strategy: string, speed?: number) => boolean | void
}

const GOALS = ['retention', 'shares', 'saves', 'watchTime'] as const
type Goal = typeof GOALS[number]

const VIBES = ['subtle', 'balanced', 'bold'] as const
type Vibe = typeof VIBES[number]

const STAGES = ['readingTranscript', 'studyingStyle', 'composing'] as const

// ── Map a director step → the AIDirectorSuggestion shape the existing
// applySuggestion dispatcher expects. The dispatcher reads: type, time,
// duration?, label, description, confidence, impact. Editable params are
// folded into description (the dispatcher derives hook text / broll name /
// cut-window text from description) and duration/time.
function stepToSuggestion(
  step: DirectorStep,
  dirId: string,
  idx: number,
  edited: Record<string, any>,
  genId: number,
): AIDirectorSuggestion {
  const p = { ...(step.params || {}), ...edited }
  // Pull a human description from the most relevant editable param so the
  // dispatcher's text-derivation (hook copy, broll keyword, caption/cta text)
  // gets the user's edits. Falls back to reasoning.
  const desc =
    p.text ?? p.copy ?? p.keyword ?? p.query ?? p.label ?? step.reasoning ?? ''

  // H1 (client): a cut carries a { start, end } silence window. time = start,
  // duration = end - start (>= 0.1). H2: guard every numeric with isFinite —
  // NaN passes `typeof x === 'number'`, so never trust typeof for numbers.
  let time = 0
  let duration: number | undefined
  if (step.type === 'cut') {
    const start = Number(p.start)
    const end = Number(p.end)
    if (Number.isFinite(start)) time = start
    if (Number.isFinite(start) && Number.isFinite(end)) {
      duration = Math.max(0.1, end - start)
    }
  } else {
    const t = Number(step.time)
    time = Number.isFinite(t) ? t : 0
    const d = Number(p.duration)
    duration = Number.isFinite(d) ? d : undefined
  }

  return {
    // H4: a per-generation nonce keeps ids unique across regenerations, which
    // reuse stable dir-1/dir-2 direction ids — otherwise the apply dedup would
    // false-skip freshly-generated steps as "already applied".
    id: `${dirId}-${step.type}-${idx}-g${genId}`,
    time,
    duration,
    type: step.type as AIDirectorSuggestion['type'],
    label: step.type.toUpperCase(),
    description: String(desc),
    // Carry the AI's categorical choice so the apply path can honor it (transition
    // style / effect name) instead of always defaulting.
    style: typeof p.style === 'string' ? p.style : undefined,
    name: typeof p.name === 'string' ? p.name : undefined,
    confidence: Number.isFinite(step.confidence as number) ? (step.confidence as number) : 0.8,
    impact: (step.impact as any) || 'medium',
  }
}

// L4: which single param is the "obvious" editable field for a given step type,
// aligned with the backend schema (color→grade, pacing→strategy, caption→text,
// cta→text, hook→text, transition→style/duration). `cut` is intentionally NOT
// inline-editable — its { start, end } window comes from detected silence and an
// inline single-field editor can't safely edit it (H1).
function primaryParam(step: DirectorStep): { key: string; numeric: boolean } | null {
  switch (step.type) {
    case 'hook':
      return { key: 'text', numeric: false }
    case 'broll':
      return { key: 'keyword', numeric: false }
    case 'transition':
      return { key: 'style', numeric: false }
    case 'caption':
      return { key: 'text', numeric: false }
    case 'cta':
      return { key: 'text', numeric: false }
    case 'color':
      return { key: 'grade', numeric: false }
    case 'pacing':
      return { key: 'strategy', numeric: false }
    case 'cut':
    default:
      return null
  }
}

// H3 (client): the CATEGORICAL value to send for learning per the feedback
// contract — transition style, color grade, caption style, pacing strategy,
// hook style. NOT a param name, NOT raw hook/cta copy. Returns undefined when
// there is no categorical value (so the client omits `value`).
function categoricalValue(
  step: DirectorStep,
  edited: Record<string, any>,
): string | undefined {
  const p = { ...(step.params || {}), ...edited }
  let raw: any
  switch (step.type) {
    case 'transition': raw = p.style; break
    case 'color': raw = p.grade; break
    case 'pacing': raw = p.strategy; break
    case 'caption': raw = p.style; break       // caption STYLE, not the text
    case 'hook': raw = p.style; break          // hook STYLE, not the copy
    default: return undefined                  // cut/broll/audio/effect/cta: no categorical value
  }
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  return v ? v : undefined
}

const AIDirectorView: React.FC<AIDirectorViewProps> = ({
  videoId,
  showToast,
  timelineActions,
  niche,
  platform,
  targetLanguage,
  autoGenerate,
  onApplyColorGrade,
  onApplyPacing,
}) => {
  const { t } = useTranslation()

  // A step is applicable if the dispatcher handles it, OR it's a color/pacing
  // step AND the corresponding global callback exists. color/pacing without a
  // callback stay honestly preview-only.
  const isApplicable = useCallback((type: DirectorStepType): boolean => {
    if (TIMELINE_APPLICABLE.has(type)) return true
    if (type === 'color') return !!onApplyColorGrade
    if (type === 'pacing') return !!onApplyPacing
    return false
  }, [onApplyColorGrade, onApplyPacing])

  // H4: per-generation nonce, bumped on each runGenerate so freshly-generated
  // directions (which reuse stable dir-1/dir-2 ids) get unique suggestion ids
  // and aren't false-skipped by the apply dedup.
  const genIdRef = useRef(0)

  const [goal, setGoal] = useState<Goal>('retention')
  const [vibe, setVibe] = useState<Vibe>('balanced')
  const [lengthTarget, setLengthTarget] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [directions, setDirections] = useState<DirectorDirection[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [selectedDir, setSelectedDir] = useState<string | null>(null)

  // Per-step UI state keyed by `${dirId}::${stepIdx}`.
  const [doneSteps, setDoneSteps] = useState<Set<string>>(() => new Set())
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(() => new Set())
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({})

  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendFeedback = useCallback(
    // H3: `step.value` is the CATEGORICAL learning value (never a param name,
    // never raw copy). Omitted when there's no categorical value.
    async (directionId: string, action: string, step?: { type: string; value?: string }) => {
      try {
        await apiPost('/ai/director/feedback', { contentId: videoId, directionId, action, step })
      } catch {
        // Feedback is best-effort telemetry — never block the user on it.
      }
    },
    [videoId],
  )

  const runGenerate = useCallback(async () => {
    if (!videoId) {
      showToast(t('modernVideoEditor.noVideoLoaded'), 'error')
      return
    }
    // H4: bump the per-generation nonce and clear the dispatcher's apply dedup
    // so newly-generated directions (reusing stable dir-1/dir-2 ids) aren't
    // false-skipped as "already applied".
    genIdRef.current += 1
    timelineActions.reset?.()

    setLoading(true)
    setError(null)
    setStageIdx(0)
    setDirections([])
    setSelectedDir(null)
    setDoneSteps(new Set())
    setSkippedSteps(new Set())
    setEdits({})

    // Honest UI chrome: staged copy on a timer. Not a fake progress bar with
    // fabricated numbers — just rotating status text while the request runs.
    if (stageTimer.current) clearInterval(stageTimer.current)
    stageTimer.current = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1))
    }, 1400)

    const goals: Record<string, any> = { primary: goal, vibe }
    // L2: allow an explicit numeric value (including 0). Only truly empty/NaN
    // is treated as "no target" — `Number('0')||undefined` would have dropped 0.
    if (lengthTarget.trim()) {
      const n = Number(lengthTarget)
      if (Number.isFinite(n)) goals.lengthTargetSeconds = n
    }
    const constraints: Record<string, any> = {}
    if (niche) constraints.niche = niche
    if (platform) constraints.platform = platform
    if (targetLanguage) constraints.targetLanguage = targetLanguage

    try {
      const res = await apiPost<PlanResponse>('/ai/director/plan', {
        contentId: videoId,
        goals,
        constraints,
      })
      setHasGenerated(true)
      if (res?.success && Array.isArray(res.directions) && res.directions.length > 0) {
        setDirections(res.directions)
        setSelectedDir(res.directions[0].id)
      } else {
        // Show backend error verbatim — honest needs-config / no-transcript state.
        setError(res?.error || t('modernVideoEditor.aiDirector.noDirections'))
      }
    } catch (err: any) {
      setHasGenerated(true)
      setError(err?.message || t('modernVideoEditor.aiDirector.generateFailed'))
    } finally {
      if (stageTimer.current) { clearInterval(stageTimer.current); stageTimer.current = null }
      setLoading(false)
    }
  }, [videoId, goal, vibe, lengthTarget, niche, platform, targetLanguage, showToast, t, timelineActions])

  // Auto-trigger when opened from Make Viral.
  const autoFired = useRef(false)
  React.useEffect(() => {
    if (autoGenerate && !autoFired.current && videoId) {
      autoFired.current = true
      runGenerate()
    }
  }, [autoGenerate, videoId, runGenerate])

  React.useEffect(() => () => { if (stageTimer.current) clearInterval(stageTimer.current) }, [])

  const handleChooseDirection = useCallback((dir: DirectorDirection) => {
    const next = selectedDir === dir.id ? null : dir.id
    setSelectedDir(next)
    if (next) sendFeedback(dir.id, 'choose_direction')
  }, [selectedDir, sendFeedback])

  const handleApplyStep = useCallback((dir: DirectorDirection, step: DirectorStep, idx: number) => {
    const key = `${dir.id}::${idx}`
    if (!isApplicable(step.type)) return
    const edited = edits[key] || {}
    const value = categoricalValue(step, edited)

    let ok = false
    if (step.type === 'color' && onApplyColorGrade) {
      // color is a GLOBAL setting — route through the callback, not the dispatcher.
      const grade = String((edited.grade ?? step.params?.grade) ?? '')
      ok = onApplyColorGrade(grade) !== false
    } else if (step.type === 'pacing' && onApplyPacing) {
      const strategy = String((edited.strategy ?? step.params?.strategy) ?? '')
      const speedRaw = Number(edited.speed ?? step.params?.speed)
      const speed = Number.isFinite(speedRaw) ? speedRaw : undefined
      ok = onApplyPacing(strategy, speed) !== false
    } else {
      const suggestion = stepToSuggestion(step, dir.id, idx, edited, genIdRef.current)
      ok = timelineActions.apply(suggestion)
    }

    if (ok) {
      setDoneSteps((prev) => new Set(prev).add(key))
      const wasEdited = Object.keys(edited).length > 0
      // H3: send the categorical value (omit when none) — never a param name.
      sendFeedback(dir.id, wasEdited ? 'tweak_step' : 'apply_step', { type: step.type, value })
    }
    // If !ok the dispatcher/callback already toasted an honest message.
  }, [edits, timelineActions, sendFeedback, isApplicable, onApplyColorGrade, onApplyPacing])

  const handleSkipStep = useCallback((dir: DirectorDirection, step: DirectorStep, idx: number) => {
    const key = `${dir.id}::${idx}`
    setSkippedSteps((prev) => new Set(prev).add(key))
    sendFeedback(dir.id, 'skip_step', { type: step.type, value: categoricalValue(step, edits[key] || {}) })
  }, [sendFeedback, edits])

  const handleApplyAll = useCallback((dir: DirectorDirection) => {
    const list: AIDirectorSuggestion[] = []
    const timelineKeys: string[] = []
    // Global (color/pacing) steps apply directly via their callbacks, not the
    // timeline dispatcher.
    const globalApplied: string[] = []

    dir.steps.forEach((step, idx) => {
      const key = `${dir.id}::${idx}`
      if (!isApplicable(step.type)) return
      if (doneSteps.has(key) || skippedSteps.has(key)) return
      const edited = edits[key] || {}

      if (step.type === 'color' && onApplyColorGrade) {
        const grade = String((edited.grade ?? step.params?.grade) ?? '')
        if (onApplyColorGrade(grade) !== false) globalApplied.push(key)
      } else if (step.type === 'pacing' && onApplyPacing) {
        const strategy = String((edited.strategy ?? step.params?.strategy) ?? '')
        const speedRaw = Number(edited.speed ?? step.params?.speed)
        const speed = Number.isFinite(speedRaw) ? speedRaw : undefined
        if (onApplyPacing(strategy, speed) !== false) globalApplied.push(key)
      } else {
        list.push(stepToSuggestion(step, dir.id, idx, edited, genIdRef.current))
        timelineKeys.push(key)
      }
    })

    if (list.length === 0 && globalApplied.length === 0) {
      showToast(t('modernVideoEditor.aiDirector.nothingToApply'), 'info')
      return
    }

    let timelineApplied = 0
    if (list.length > 0) {
      const result = timelineActions.applyAll(list)
      timelineApplied = result.applied
      if (result.applied > 0) {
        setDoneSteps((prev) => {
          const n = new Set(prev)
          timelineKeys.forEach((k) => n.add(k))
          return n
        })
      }
    }
    if (globalApplied.length > 0) {
      setDoneSteps((prev) => {
        const n = new Set(prev)
        globalApplied.forEach((k) => n.add(k))
        return n
      })
    }

    // L1: don't double-count choose_direction (the header click already fires
    // it). Apply-all records a distinct apply_step action gated on actual work.
    if (timelineApplied > 0 || globalApplied.length > 0) {
      sendFeedback(dir.id, 'apply_step', { type: 'direction' })
    }
  }, [doneSteps, skippedSteps, edits, timelineActions, showToast, t, sendFeedback, isApplicable, onApplyColorGrade, onApplyPacing])

  const handleDismiss = useCallback((dir: DirectorDirection) => {
    sendFeedback(dir.id, 'dismiss_direction')
    setDirections((prev) => prev.filter((d) => d.id !== dir.id))
    setSelectedDir((cur) => (cur === dir.id ? null : cur))
  }, [sendFeedback])

  const setEdit = useCallback((key: string, field: string, value: any) => {
    setEdits((prev) => {
      const next = { ...(prev[key] || {}) }
      // H2: undefined means "drop this edit" — remove the key so the merge in
      // stepToSuggestion falls back to the original param value rather than
      // overriding it with undefined/NaN.
      if (value === undefined) delete next[field]
      else next[field] = value
      return { ...prev, [key]: next }
    })
  }, [])

  const contextChips = useMemo(() => {
    const chips: { label: string; value: string }[] = []
    if (niche) chips.push({ label: t('modernVideoEditor.aiDirector.niche'), value: niche })
    if (platform) chips.push({ label: t('modernVideoEditor.aiDirector.platform'), value: platform })
    if (targetLanguage) chips.push({ label: t('modernVideoEditor.aiDirector.language'), value: targetLanguage })
    return chips
  }, [niche, platform, targetLanguage, t])

  return (
    <div className="space-y-8 max-w-[1100px] mx-auto py-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-300">
          <Sparkles className="w-3.5 h-3.5" />
          {t('modernVideoEditor.aiDirector.badge')}
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-[var(--text-main)] tracking-tight">
          {t('modernVideoEditor.aiDirector.title')}
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl">
          {t('modernVideoEditor.aiDirector.subtitle')}
        </p>
      </div>

      {/* Guidance controls */}
      <div className={`${glassStyle} rounded-3xl p-6 md:p-8 space-y-6`}>
        {/* Goal */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('modernVideoEditor.aiDirector.goalLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                  goal === g
                    ? 'bg-fuchsia-500 text-white border-fuchsia-400'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {t(`modernVideoEditor.aiDirector.goal.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Vibe */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('modernVideoEditor.aiDirector.vibeLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVibe(v)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${
                  vibe === v
                    ? 'bg-indigo-500 text-white border-indigo-400'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                {t(`modernVideoEditor.aiDirector.vibe.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Length target + context chips */}
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t('modernVideoEditor.aiDirector.lengthLabel')}
            </label>
            <input
              type="number"
              min={0}
              value={lengthTarget}
              onChange={(e) => setLengthTarget(e.target.value)}
              placeholder={t('modernVideoEditor.aiDirector.lengthPlaceholder')}
              className="w-40 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500/50"
            />
          </div>
          {contextChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contextChips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[11px] text-slate-400"
                  title={t('modernVideoEditor.aiDirector.contextHint')}
                >
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span className="font-bold text-slate-500">{c.label}:</span>
                  <span className="text-slate-300">{c.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Generate */}
        <button
          type="button"
          disabled={loading || !videoId}
          onClick={runGenerate}
          className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-black text-xs uppercase tracking-[0.3em] shadow-lg shadow-fuchsia-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t(`modernVideoEditor.aiDirector.stage.${STAGES[stageIdx]}`)}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {hasGenerated
                ? t('modernVideoEditor.aiDirector.regenerate')
                : t('modernVideoEditor.aiDirector.generate')}
            </>
          )}
        </button>
      </div>

      {/* Error / honest needs-config state */}
      {error && !loading && (
        <div className="flex items-start gap-4 p-6 rounded-3xl bg-amber-500/[0.06] border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-amber-100 font-medium">{error}</p>
            <button
              type="button"
              onClick={runGenerate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('modernVideoEditor.aiDirector.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Empty state — before first generate */}
      {!hasGenerated && !loading && !error && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-3xl border border-dashed border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-5">
            <Sparkles className="w-7 h-7 text-fuchsia-300" />
          </div>
          <p className="text-lg font-bold text-white">{t('modernVideoEditor.aiDirector.emptyTitle')}</p>
          <p className="text-sm text-slate-500 max-w-md mt-2">{t('modernVideoEditor.aiDirector.emptyBody')}</p>
        </div>
      )}

      {/* Directions */}
      {directions.length > 0 && (
        <div className="space-y-4">
          {directions.map((dir) => {
            const expanded = selectedDir === dir.id
            const applicableCount = dir.steps.filter((s) => isApplicable(s.type)).length
            return (
              <div key={dir.id} className={`${glassStyle} rounded-3xl overflow-hidden`}>
                {/* Direction header */}
                <button
                  type="button"
                  onClick={() => handleChooseDirection(dir)}
                  className="w-full flex items-center gap-4 p-6 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0">
                    {expanded ? <ChevronDown className="w-5 h-5 text-fuchsia-300" /> : <ChevronRight className="w-5 h-5 text-fuchsia-300" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-black text-white tracking-tight">{dir.title}</span>
                      {dir.vibe && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {dir.vibe}
                        </span>
                      )}
                    </div>
                    {dir.reasoning && <p className="text-sm text-slate-400 line-clamp-2">{dir.reasoning}</p>}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>{t('modernVideoEditor.aiDirector.stepCount', { count: dir.steps.length })}</span>
                      {dir.estImpact && <span className="text-emerald-400 font-bold">{dir.estImpact}</span>}
                    </div>
                  </div>
                </button>

                {/* Steps */}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 space-y-3 border-t border-white/5 pt-4">
                        {/* Direction-level actions */}
                        <div className="flex items-center justify-end gap-2 pb-1">
                          <button
                            type="button"
                            onClick={() => handleDismiss(dir)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            {t('modernVideoEditor.aiDirector.dismiss')}
                          </button>
                          <button
                            type="button"
                            disabled={applicableCount === 0}
                            onClick={() => handleApplyAll(dir)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            {t('modernVideoEditor.aiDirector.applyAll')}
                          </button>
                        </div>

                        {dir.steps.map((step, idx) => {
                          const key = `${dir.id}::${idx}`
                          const Icon = STEP_ICON[step.type] || Sparkles
                          const tone = IMPACT_TONE[step.impact || 'medium']
                          const applicable = isApplicable(step.type)
                          const done = doneSteps.has(key)
                          const skipped = skippedSteps.has(key)
                          const pp = primaryParam(step)
                          const editVal = edits[key]?.[pp?.key || ''] ??
                            (pp ? (step.params?.[pp.key] ?? '') : '')
                          const conf = Number.isFinite(step.confidence as number) ? (step.confidence as number) : 0.8

                          return (
                            <div
                              key={key}
                              className={`rounded-2xl border p-4 transition-colors ${
                                done
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : skipped
                                    ? 'bg-white/[0.01] border-white/5 opacity-50'
                                    : 'bg-white/[0.02] border-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-xl ${tone.bg} border border-white/5 flex items-center justify-center shrink-0`}>
                                  <Icon className={`w-4.5 h-4.5 ${tone.text}`} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold uppercase tracking-widest text-white">
                                      {t(`modernVideoEditor.aiDirector.stepType.${step.type}`)}
                                    </span>
                                    {typeof step.time === 'number' && (
                                      <span className="text-[10px] tabular-nums text-slate-500">@ {step.time.toFixed(1)}s</span>
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${tone.text}`}>
                                      {step.impact || 'medium'}
                                    </span>
                                    {!applicable && (
                                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                        {t('modernVideoEditor.aiDirector.previewOnly')}
                                      </span>
                                    )}
                                    {done && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {t('modernVideoEditor.aiDirector.applied')}
                                      </span>
                                    )}
                                  </div>

                                  {step.reasoning && <p className="text-sm text-slate-400">{step.reasoning}</p>}

                                  {/* Confidence bar */}
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-24 rounded-full bg-white/5 overflow-hidden">
                                      <div className={`h-full ${tone.bar}`} style={{ width: `${Math.round(conf * 100)}%` }} />
                                    </div>
                                    <span className="text-[10px] tabular-nums text-slate-500">
                                      {Math.round(conf * 100)}% {t('modernVideoEditor.aiDirector.confidence')}
                                    </span>
                                  </div>

                                  {/* Editable param */}
                                  {pp && !done && (
                                    <div className="flex items-center gap-2 pt-1">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 shrink-0">
                                        {t(`modernVideoEditor.aiDirector.param.${pp.key}`)}
                                      </span>
                                      <input
                                        type={pp.numeric ? 'number' : 'text'}
                                        value={editVal as any}
                                        title={t(`modernVideoEditor.aiDirector.param.${pp.key}`)}
                                        placeholder={t(`modernVideoEditor.aiDirector.param.${pp.key}`)}
                                        onChange={(e) => {
                                          if (pp.numeric) {
                                            // H2: never let NaN/empty corrupt a numeric edit.
                                            // Drop the edit when it isn't finite (keeps the original value).
                                            const n = Number(e.target.value)
                                            if (Number.isFinite(n)) setEdit(key, pp.key, n)
                                            else setEdit(key, pp.key, undefined)
                                          } else {
                                            setEdit(key, pp.key, e.target.value)
                                          }
                                        }}
                                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-fuchsia-500/50"
                                      />
                                    </div>
                                  )}

                                  {!applicable && (
                                    <p className="text-[11px] text-slate-500 italic">
                                      {t('modernVideoEditor.aiDirector.previewOnlyNote')}
                                    </p>
                                  )}
                                </div>

                                {/* Per-step actions */}
                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    type="button"
                                    disabled={!applicable || done}
                                    onClick={() => handleApplyStep(dir, step, idx)}
                                    title={!applicable ? t('modernVideoEditor.aiDirector.previewOnlyNote') : undefined}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                      done
                                        ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                        : !applicable
                                          ? 'bg-white/[0.02] text-slate-600 border border-white/5 cursor-not-allowed'
                                          : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                                    }`}
                                  >
                                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                    {done ? t('modernVideoEditor.aiDirector.applied') : t('modernVideoEditor.aiDirector.apply')}
                                  </button>
                                  {!done && !skipped && (
                                    <button
                                      type="button"
                                      onClick={() => handleSkipStep(dir, step, idx)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.02] border border-white/5 text-slate-400 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                                    >
                                      <SkipForward className="w-3.5 h-3.5" />
                                      {t('modernVideoEditor.aiDirector.skip')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {/* Undo affordance reusing the shared timeline history */}
          {timelineActions.canUndo && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => timelineActions.undoLastApply()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('modernVideoEditor.aiDirector.undoLast')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AIDirectorView
