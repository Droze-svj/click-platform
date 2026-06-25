'use client'

/**
 * Hook A/B Lab — generate 3 distinct hook angles (curiosity / authority / FOMO)
 * for a piece of content, then optionally feed real impression/engagement
 * numbers back in to pick a statistically-confident winner.
 *
 * Renders ONLY live data from the productive ab-testing endpoints; nothing is
 * fabricated. Every backend field is optional-chained so a partial payload
 * never throws.
 */

import React, { useState } from 'react'
import {
  Sparkles, Copy, FlaskConical, Trophy, Clock,
} from 'lucide-react'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { apiPost } from '../../../../lib/api'
import {
  Panel,
  Button,
  Badge,
  EmptyState,
  SectionHeader,
  Textarea,
  Input,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../../../../components/ui'

// ── Angle taxonomy returned by the backend hook generator. ──
type HookAngle = 'curiosity' | 'authority' | 'fomo'
type HookSource = 'ai' | 'template'

// One generated hook variant. Mirrors the service payload exactly — no
// invented fields. `scheduledWindow` is present only when the caller passed
// explicit windows; otherwise `slotOffsetHours` carries the "+Nh" offset.
interface HookVariant {
  angle: HookAngle
  label: string
  hook: string
  source: HookSource
  slotIndex: number
  scheduledWindow: string | null
  slotOffsetHours: number | null
}

// Shape of `res.data` from POST /api/productive/ab-testing/hook-experiment.
interface HookExperimentResponse {
  topic: string
  variants: HookVariant[]
  generatedWith: string
}

// One ranked row from the evaluator (engagementRate is a 0–1 fraction).
interface RankedRow {
  id: string
  angle: HookAngle | null
  impressions: number
  engagement: number
  engagementRate: number
}

// Winner summary from the evaluator.
interface EvalWinner {
  id: string
  angle: HookAngle | null
  engagementRate: number
}

// Shape of `res.data` from .../hook-experiment/evaluate.
interface EvalResponse {
  winner: EvalWinner | null
  ranked: RankedRow[]
  lift: number
  confident: boolean
  reason: string
}

// Per-variant metric inputs are kept as raw strings (controlled) and parsed to
// numbers only at submit time, per the controlled-number-input convention.
interface MetricInput {
  impressions: string
  engagement: string
}

// Standard envelope used by apiPost — payload lives under `data`.
interface ApiEnvelope<T> {
  data?: T
}

const SOURCE_TOOLTIP = 'AI was unavailable, used a starter template'

/** Human-friendly slot label: "Post +3h" or the explicit scheduled window. */
function slotLabel(v: HookVariant): string {
  if (v?.scheduledWindow) return String(v.scheduledWindow)
  const offset = typeof v?.slotOffsetHours === 'number' ? v.slotOffsetHours : null
  if (offset === null) return 'Post now'
  return offset === 0 ? 'Post now' : `Post +${offset}h`
}

/** Format a 0–1 engagement-rate fraction as a percentage string. */
function ratePct(rate: number | null | undefined): string {
  const n = typeof rate === 'number' ? rate : 0
  return `${(n * 100).toFixed(2)}%`
}

export default function HookABPage() {
  const { showToast } = useToast()

  const [text, setText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [experiment, setExperiment] = useState<HookExperimentResponse | null>(null)

  const [metrics, setMetrics] = useState<MetricInput[]>([])
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<EvalResponse | null>(null)

  const variants = experiment?.variants ?? []

  async function handleGenerate() {
    const trimmed = text.trim()
    if (!trimmed) {
      showToast('Add a content description first.', 'warning')
      return
    }
    setGenerating(true)
    setEvaluation(null)
    try {
      const res = await apiPost<ApiEnvelope<HookExperimentResponse>>(
        '/productive/ab-testing/hook-experiment',
        { text: trimmed },
      )
      const data = res?.data ?? null
      setExperiment(data)
      // Seed one blank metric row per generated variant so the evaluate
      // panel's inputs stay aligned with the cards.
      setMetrics((data?.variants ?? []).map(() => ({ impressions: '', engagement: '' })))
      if (!data?.variants?.length) {
        showToast('No hook variants were returned. Try a richer description.', 'info')
      } else {
        showToast('Generated 3 hook angles.', 'success')
      }
    } catch {
      showToast('Could not generate hooks. Please try again.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(hook: string) {
    try {
      await navigator.clipboard.writeText(hook)
      showToast('Hook copied to clipboard.', 'success')
    } catch {
      showToast('Could not copy to clipboard.', 'error')
    }
  }

  function updateMetric(index: number, field: keyof MetricInput, value: string) {
    setMetrics((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    )
  }

  async function handleEvaluate() {
    if (!variants.length) return
    setEvaluating(true)
    try {
      const variantResults = variants.map((v, i) => ({
        angle: v.angle,
        impressions: Number(metrics[i]?.impressions) || 0,
        engagement: Number(metrics[i]?.engagement) || 0,
      }))
      const res = await apiPost<ApiEnvelope<EvalResponse>>(
        '/productive/ab-testing/hook-experiment/evaluate',
        { variantResults },
      )
      const data = res?.data ?? null
      setEvaluation(data)
      showToast('Experiment evaluated.', 'success')
    } catch {
      showToast('Could not evaluate the experiment. Please try again.', 'error')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1500px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title="Hook A/B Lab"
          description="Generate three competing hook angles — curiosity, authority, FOMO — then feed back real numbers to crown a winner."
          className="mb-8"
        />

        {/* ── Generator ── */}
        <Panel variant="bento" className="mb-8 space-y-4">
          <label htmlFor="hook-ab-text" className="ds-text-label text-theme-secondary">
            What's the content about?
          </label>
          <Textarea
            id="hook-ab-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the video, post, or idea you want hooks for…"
            className="min-h-[120px]"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              loading={generating}
              onClick={handleGenerate}
              leftIcon={<Sparkles className="h-4 w-4" aria-hidden />}
            >
              Generate Hooks
            </Button>
          </div>
        </Panel>

        {/* ── Variant cards ── */}
        {variants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {variants.map((v) => {
              const isAi = v?.source === 'ai'
              return (
                <Panel
                  key={`${v?.angle}-${v?.slotIndex}`}
                  variant="bento"
                  className="flex h-full flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="ds-text-h3 text-theme-primary leading-tight">
                      {v?.label ?? v?.angle}
                    </h3>
                    {isAi ? (
                      <Badge variant="default">ai</Badge>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Badge variant="outline">template</Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{SOURCE_TOOLTIP}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  <p className="ds-text-h3 text-theme-primary leading-snug font-semibold flex-1">
                    {v?.hook}
                  </p>

                  <div className="mt-4 flex items-center gap-1.5 text-sm text-theme-muted">
                    <Clock className="h-4 w-4" aria-hidden />
                    {slotLabel(v)}
                  </div>

                  <div className="mt-4 pt-4 flex items-center justify-end border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(v?.hook ?? '')}
                      leftIcon={<Copy className="h-4 w-4" aria-hidden />}
                    >
                      Copy
                    </Button>
                  </div>
                </Panel>
              )
            })}
          </div>
        ) : (
          !generating && (
            <EmptyState
              icon={Sparkles}
              title="No hooks yet"
              description="Describe your content above and generate three angles to compare."
              className="ds-surface-card"
            />
          )
        )}

        {/* ── Evaluate winner (only after variants exist) ── */}
        {variants.length > 0 && (
          <Panel variant="bento" className="space-y-5">
            <SectionHeader
              as="h2"
              title="Evaluate winner"
              description="Optional — drop in impressions and engagement per angle to find a statistically-confident winner."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {variants.map((v, i) => (
                <div
                  key={`metric-${v?.angle}-${v?.slotIndex}`}
                  className="ds-surface-subtle rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-theme-muted" aria-hidden />
                    <span className="text-sm font-medium text-theme-primary">
                      {v?.label ?? v?.angle}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`impressions-${i}`}
                      className="ds-text-label text-theme-secondary"
                    >
                      Impressions
                    </label>
                    <Input
                      id={`impressions-${i}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={metrics[i]?.impressions ?? ''}
                      onChange={(e) => updateMetric(i, 'impressions', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`engagement-${i}`}
                      className="ds-text-label text-theme-secondary"
                    >
                      Engagement
                    </label>
                    <Input
                      id={`engagement-${i}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={metrics[i]?.engagement ?? ''}
                      onChange={(e) => updateMetric(i, 'engagement', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                loading={evaluating}
                onClick={handleEvaluate}
                leftIcon={<Trophy className="h-4 w-4" aria-hidden />}
              >
                Evaluate
              </Button>
            </div>

            {evaluation && (
              <div className="ds-surface-subtle rounded-xl p-5 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                    <Trophy className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="ds-text-caption text-theme-muted">Winning angle</p>
                    <p className="text-sm font-semibold text-theme-primary">
                      {evaluation.winner?.angle ?? '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="ds-text-caption text-theme-muted">Lift over runner-up</p>
                  <p className="text-sm font-semibold text-theme-primary">
                    {typeof evaluation.lift === 'number' ? `${evaluation.lift}%` : '—'}
                  </p>
                </div>

                {evaluation.winner && (
                  <div>
                    <p className="ds-text-caption text-theme-muted">Engagement rate</p>
                    <p className="text-sm font-semibold text-theme-primary">
                      {ratePct(evaluation.winner.engagementRate)}
                    </p>
                  </div>
                )}

                <div className="ml-auto">
                  {evaluation.confident ? (
                    <Badge className="border-transparent bg-emerald-500 text-white">
                      Significant
                    </Badge>
                  ) : (
                    <Badge className="border-transparent bg-amber-500 text-white">
                      Inconclusive
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </Panel>
        )}
      </div>
    </TooltipProvider>
  )
}
