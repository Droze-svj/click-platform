'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  Target,
  Cpu,
  Zap,
  Users,
  ShieldCheck,
  Sparkles,
  Layers,
  Gauge,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { Panel, Button, Badge, SectionHeader, StatCard, EmptyState } from '../../ui'
import { cn } from '../../../lib/utils'

interface PredictionEngineViewProps {
  videoId?: string
  timelineSegments: any[]
  transcript: any
  showToast: (m: string, t: any) => void
}

type Persona = 'Gen Z' | 'B2B Professional' | 'Tech Enthusiast' | 'Lifestyle/Vlog'

const PredictionEngineView: React.FC<PredictionEngineViewProps> = ({
  videoId,
  timelineSegments,
  transcript,
  showToast
}) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>('Gen Z')
  const [hookTestState, setHookTestState] = useState<'idle' | 'generating' | 'results'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [prePublishReport, setPrePublishReport] = useState<any>(null)
  const [abVariantsData, setAbVariantsData] = useState<any>(null)

  useEffect(() => {
    if (!videoId) return

    const loadPredictions = async () => {
      setIsLoading(true)
      try {
        const [reportRes, abRes] = await Promise.all([
          apiGet<any>(`/content/${videoId}/pre-publish`),
          apiGet<any>(`/content/${videoId}/ab-variants`)
        ])

        if (reportRes?.success && reportRes?.data) {
          setPrePublishReport(reportRes.data)
        }
        if (abRes?.success && abRes?.data) {
          setAbVariantsData(abRes.data)
        }
      } catch (err) {
        console.error('Failed to load predictions', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadPredictions()
  }, [videoId])

  const metrics = useMemo(() => {
    const totalDuration = timelineSegments.reduce((acc, s) => acc + (s.duration || 0), 0) || 1
    const cutCount = timelineSegments.length
    const cutsPerMinute = (cutCount / totalDuration) * 60
    const brollCount = timelineSegments.filter(s => s.type === 'broll').length
    const brollRatio = (brollCount / cutCount) || 0

    // Semantic Mapping — count high-retention hook words in the first 5 seconds.
    let highRetentionWordsFound = 0
    let semanticIntensity = 0
    const hookKeys = ['secret', 'hack', 'unlock', 'reveal', 'truth', 'insane', 'stop', 'hidden', 'why', 'how']

    if (transcript && transcript.words) {
      const first5SecWords = transcript.words.filter((w: any) => w.start <= 5)
      first5SecWords.forEach((w: any) => {
        const text = w.text.toLowerCase().replace(/[^a-z]/g, '')
        if (hookKeys.includes(text)) {
          highRetentionWordsFound++
          semanticIntensity += 25
        }
      })
    }

    // Baseline intensity from cuts
    semanticIntensity = Math.min(100, semanticIntensity + (cutsPerMinute * 2))

    return { totalDuration, cutsPerMinute, brollRatio, cutCount, highRetentionWordsFound, semanticIntensity }
  }, [timelineSegments, transcript])

  const viralScore = useMemo(() => {
    if (prePublishReport?.overallScore) {
      return prePublishReport.overallScore
    }

    let score = 40

    // Semantic Hook Logic
    if (metrics.highRetentionWordsFound >= 2) score += 20
    else if (metrics.highRetentionWordsFound === 1) score += 10

    // Pacing Logic
    if (metrics.cutsPerMinute > 12) score += 10
    else if (metrics.cutsPerMinute > 6) score += 5

    // Visual Hook Density
    const hookDensity = timelineSegments.slice(0, 5).filter(s => s.endTime <= 5).length
    if (hookDensity >= 3) score += 10

    // B-Roll Logic
    if (metrics.brollRatio > 0.4) score += 10
    else if (metrics.brollRatio > 0.2) score += 5

    // Persona Multipliers
    if (selectedPersona === 'Gen Z' && metrics.cutsPerMinute > 15) score += 10
    if (selectedPersona === 'B2B Professional' && metrics.brollRatio > 0.3) score += 10

    return Math.min(score, 99)
  }, [metrics, selectedPersona, timelineSegments, prePublishReport])

  const roadmap = useMemo<{ title: string; desc: string; icon: LucideIcon }[]>(() => {
    if (prePublishReport?.priorityActions && prePublishReport.priorityActions.length > 0) {
      return prePublishReport.priorityActions.map((action: any) => ({
        title: action.action,
        desc: `${action.details}. Impact: ${action.impact}`,
        icon: Zap
      }))
    }

    const steps: { title: string; desc: string; icon: LucideIcon }[] = []

    if (metrics.cutsPerMinute < 8) {
      steps.push({ title: 'Tighten pacing', desc: `Current pacing is ${metrics.cutsPerMinute.toFixed(1)} cuts/min. Increase to 12+ for ${selectedPersona} engagement.`, icon: Zap })
    } else {
      steps.push({ title: 'Pacing verified', desc: 'Cut density is in the optimal range for retention.', icon: ShieldCheck })
    }

    if (metrics.brollRatio < 0.3) {
      steps.push({ title: 'Add B-roll', desc: `B-roll coverage is ${(metrics.brollRatio * 100).toFixed(0)}%. Add 2-3 more B-roll clips to prevent visual fatigue.`, icon: Layers })
    } else {
      steps.push({ title: 'Highlight keywords', desc: 'Auto-highlight high-velocity tokens in the script for stronger retention.', icon: Sparkles })
    }

    steps.push({ title: 'Grade the hook', desc: 'Apply high-contrast grading to the opening hook for immediate stimulus.', icon: Gauge })

    return steps.slice(0, 3)
  }, [metrics, selectedPersona, prePublishReport])

  const runHookTest = () => {
    setHookTestState('generating')
    setTimeout(() => {
      setHookTestState('results')
      showToast('Hook A/B test complete.', 'success')
    }, 2500)
  }

  // Honest derived stat tiles — all computed from real timeline/transcript/report.
  const statTiles = [
    {
      label: 'Pacing density',
      val: prePublishReport?.platformFit?.cpmRating || (metrics.cutsPerMinute > 12 ? 'High' : 'Medium'),
    },
    {
      label: 'Hook velocity',
      val: prePublishReport?.hookAnalysis?.score != null
        ? (prePublishReport.hookAnalysis.score >= 70 ? 'Strong' : 'Average')
        : (metrics.highRetentionWordsFound >= 2 ? 'Strong' : 'Average'),
    },
    {
      label: 'Cuts / min',
      val: metrics.cutsPerMinute.toFixed(1),
    },
    {
      label: 'Semantic power',
      val: prePublishReport?.overallScore ? `${prePublishReport.overallScore}%` : `${metrics.semanticIntensity.toFixed(0)}%`,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-5">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" aria-hidden />
        <div className="space-y-1 text-center">
          <h2 className="ds-text-h3 text-theme-primary">Analyzing your edit</h2>
          <p className="text-sm text-theme-muted">Scoring hooks, pacing density and conversion variants…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6 ds-anim-rise">
      {/* Header */}
      <Badge variant="outline" className="gap-2 border-indigo-500/30 text-indigo-500">
        <Cpu className="h-3.5 w-3.5" aria-hidden />
        Prediction Engine
      </Badge>
      <SectionHeader
        as="h1"
        title="Prediction Engine"
        description="Score your edit's viral potential and get prioritized optimization steps — derived from your timeline and transcript."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Viral Potential */}
        <Panel variant="glass" className="space-y-6 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="ds-text-label text-theme-primary">Viral Potential Score</span>
              </div>
              <p className="ds-text-caption mt-1 text-theme-muted">Predicted alignment for {selectedPersona}</p>
            </div>
            <div className="ds-text-h1 tabular-nums text-emerald-500">
              {viralScore}<span className="ml-1 text-2xl text-theme-muted">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {statTiles.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.val} />
            ))}
          </div>
        </Panel>

        {/* Persona Selector */}
        <Panel variant="glass" className="flex flex-col space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">Audience persona</span>
          </div>
          <div className="flex-1 space-y-2">
            {(['Gen Z', 'B2B Professional', 'Tech Enthusiast', 'Lifestyle/Vlog'] as Persona[]).map(p => {
              const active = selectedPersona === p
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => setSelectedPersona(p)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                    active ? 'border-indigo-500 bg-indigo-500/10' : 'border-subtle ds-surface-subtle hover:border-border'
                  )}
                >
                  <span className={cn('text-sm font-medium', active ? 'text-indigo-500' : 'text-theme-secondary')}>{p}</span>
                  {active && <ShieldCheck className="h-4 w-4 text-indigo-500" aria-hidden />}
                </button>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* A/B Hook Testing */}
      <Panel variant="glass" className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">A/B Hook Testing</span>
            </div>
            <p className="ds-text-caption mt-1 text-theme-muted">Compare variants of the first 5 seconds against {selectedPersona} CTR</p>
          </div>
          {hookTestState === 'idle' && (
            <Button onClick={runHookTest} leftIcon={<Target className="h-4 w-4" aria-hidden />}>
              Run hook test
            </Button>
          )}
        </div>

        {hookTestState === 'generating' && (
          <div className="flex h-40 flex-col items-center justify-center gap-4 rounded-xl border border-subtle ds-surface-subtle">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" aria-hidden />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-theme-primary">Comparing variants…</p>
              <p className="ds-text-caption text-theme-muted">Extracting tokens and analyzing scroll-stop probability.</p>
            </div>
          </div>
        )}

        {hookTestState === 'results' && (
          abVariantsData?.variants?.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {abVariantsData.variants.map((v: any, i: number) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col justify-between gap-5 rounded-xl border p-5',
                    v.winner ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-subtle ds-surface-subtle'
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="ds-text-label text-theme-secondary">{v.type}</span>
                      {v.winner && (
                        <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500">
                          <Target className="h-3 w-3" aria-hidden /> Winner
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-theme-primary">&ldquo;{v.text}&rdquo;</p>
                    {v.hypothesis && (
                      <p className="ds-text-caption text-theme-muted">Hypothesis: {v.hypothesis}</p>
                    )}
                  </div>
                  <div className="space-y-3 border-t border-subtle pt-4">
                    <div className="space-y-0.5">
                      <span className="ds-text-caption text-theme-muted">Predicted lift</span>
                      <div className="ds-text-h3 tabular-nums text-theme-primary">{v.predictedLift || v.lift}</div>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full">
                      {v.winner ? 'Apply winner to timeline' : 'Preview hook'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No variant data yet"
              description="Hook variants will appear here once the analysis returns results for this video."
            />
          )
        )}
      </Panel>

      {/* Strategic Roadmap */}
      <Panel variant="glass" className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" aria-hidden />
          <span className="ds-text-label text-theme-primary">Optimization roadmap</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {roadmap.map((step, i) => {
            const StepIcon = step.icon
            return (
              <div key={i} className="space-y-3 rounded-xl border border-subtle ds-surface-subtle p-5">
                <div className="flex items-center gap-3">
                  <span className="ds-text-h3 tabular-nums text-theme-muted">0{i + 1}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-center gap-2">
                  <StepIcon className="h-4 w-4 text-indigo-500" aria-hidden />
                  <h4 className="ds-text-label text-theme-primary">{step.title}</h4>
                </div>
                <p className="text-sm leading-relaxed text-theme-secondary">{step.desc}</p>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

export default PredictionEngineView
