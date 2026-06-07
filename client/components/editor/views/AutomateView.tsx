'use client'

import React, { useRef, useEffect } from 'react'
import {
  Mic, Zap, Scissors, Type, Wand2, ArrowRight, Globe2,
  ShoppingCart, Rocket, TrendingUp, Activity, Layers, type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import { apiPost, apiGet, handleApiError } from '../../../lib/api'
import { Panel, Button, Badge, SectionHeader, StatCard, Textarea, Slider } from '../../ui'
import { cn } from '../../../lib/utils'

interface AutomateViewProps {
  voiceoverText: string
  setVoiceoverText: (v: string) => void
  selectedVoice: string
  setSelectedVoice: (v: string) => void
  isGeneratingVoiceover: boolean
  setIsGeneratingVoiceover: (v: boolean) => void
  videoId: string
  videoUrl?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  onAddVoiceoverSegment: (url: string, duration: number) => void
  setTextOverlays?: (v: any) => void
  transcript?: any
  setTimelineSegments?: (updater: (prev: any[]) => any[]) => void
}

const SILENCE_THRESHOLDS = [
  { label: 'Aggressive (−25 dB)', value: '-25dB', desc: 'Cuts more — good for quiet recordings' },
  { label: 'Balanced (−35 dB)', value: '-35dB', desc: 'Recommended for most videos' },
  { label: 'Conservative (−45 dB)', value: '-45dB', desc: 'Only removes very long silences' },
]

type PipelineStep = 'idle' | 'silence' | 'transcribing' | 'scoring' | 'captioning' | 'distribution' | 'roi-forecasting' | 'sourcing' | 'monetization' | 'done' | 'error'

const AutomateView: React.FC<AutomateViewProps> = ({
  voiceoverText,
  setVoiceoverText,
  selectedVoice,
  setSelectedVoice,
  isGeneratingVoiceover,
  setIsGeneratingVoiceover,
  videoId,
  videoUrl,
  showToast,
  onAddVoiceoverSegment,
  setTextOverlays,
  transcript,
}) => {
  const [pipelineStep, setPipelineStep] = React.useState<PipelineStep>('idle')
  const [pipelineError, setPipelineError] = React.useState<string | null>(null)
  const [pipelineResult, setPipelineResult] = React.useState<{
    captionsAdded: number
    hookScore?: number
    hookInterpretation?: string
    topImprovement?: string
    scores?: { label: string; value: number; color: string }[]
    hookType?: string
    rewrites?: string[]
    directives?: { action: string; reason: string; impact: 'high' | 'medium' | 'low' }[]
    weakestMoment?: string
    strongestMoment?: string
    summary?: string
    suggestedTitle?: string
    suggestedDescription?: string
    suggestedTags?: string[]
    silenceGapsRemoved?: number
    silenceCleanedVideoUrl?: string
    viralThumbnailUrl?: string
    distributionConfidence?: number
    roiData?: { salesScore: number; estimatedROI: number; recommendations: any[] }
    sourcedAssets?: { keywords: string[], suggestedAssets: any[] }
    monetizationPlan?: { monetizationSteps: any[], products: any[] }
    adPotential?: { isHighPotential: boolean; recommendedBudget: number; reason: string; thumbnail?: string }
  } | null>(null)

  const [stepProgress, setStepProgress] = React.useState(0)
  const [silenceThreshold, setSilenceThreshold] = React.useState('-35dB')
  const [minSilenceDuration, setMinSilenceDuration] = React.useState(0.5)
  const [silenceLoading, setSilenceLoading] = React.useState(false)
  const [silenceResult, setSilenceResult] = React.useState<{
    segmentsKept: number
    silenceRemoved: number
    resultUrl?: string
  } | null>(null)

  const [agentJob, setAgentJob] = React.useState<{
    jobId: string
    status: 'queued' | 'running' | 'done' | 'error'
    step?: string
    progress?: number
  } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPollAgentJob = (jobId: string) => {
    setAgentJob({ jobId, status: 'queued', step: 'Waiting for GPU slot…', progress: 0 })
    const poll = async () => {
      try {
        const res = await apiGet<any>(`/agentic/status/${jobId}`)
        const { status, step, progress } = (res as any)?.data ?? res
        setAgentJob({ jobId, status, step, progress: progress ?? 0 })
        if (status === 'done' || status === 'error') return
        pollRef.current = setTimeout(poll, 2000) as any
      } catch {
        setAgentJob(prev => prev ? { ...prev, status: 'error', step: 'Connection error' } : null)
      }
    }
    poll()
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current as any) }, [])

  const handleViralOneClick = async () => {
    if (!videoUrl) {
      showToast('No video loaded', 'error')
      return
    }
    setPipelineStep('silence')
    setStepProgress(0)
    setPipelineError(null)
    setPipelineResult(null)

    let activeVideoUrl = videoUrl
    let silenceGapsRemoved = 0
    let silenceCleanedVideoUrl: string | undefined

    try {
      showToast('Step 1/8 — Removing silence…', 'info')
      const silRes = await apiPost('/video/advanced/remove-silence', {
        videoId, videoUrl, silenceThreshold, minSilenceDuration, padding: 0.08,
      }) as any
      if (silRes?.resultUrl) {
        activeVideoUrl = silRes.resultUrl
        silenceCleanedVideoUrl = silRes.resultUrl
        silenceGapsRemoved = silRes?.silenceRemoved ?? 0
      }
      setStepProgress(100)

      setPipelineStep('transcribing')
      setStepProgress(0)
      let transcriptText = transcript?.fullText ?? ''
      if (!transcriptText && videoId) {
        showToast('Step 2/8 — Transcribing…', 'info')
        const transRes = await apiPost('/video/transcribe-editor', { videoId, language: 'en' }) as any
        transcriptText = transRes?.data?.text || transRes?.text || ''
      }
      setStepProgress(100)

      setPipelineStep('scoring')
      setStepProgress(0)
      showToast('Step 3/8 — AI Hook Analysis…', 'info')
      const scoreRes = await apiPost('/video/hook-analysis', {
        videoId, videoUrl: activeVideoUrl, transcript: transcriptText || undefined,
      }) as any
      const analysis = scoreRes?.analysis ?? scoreRes
      const hookScore = analysis?.overallScore ?? analysis?.score ?? 0
      setStepProgress(100)

      setPipelineStep('captioning')
      setStepProgress(0)
      showToast('Step 4/8 — Adding captions…', 'info')
      const captionRes = await apiPost('/video/hook-analysis/auto-caption', {
        videoId, transcript: transcriptText, style: 'tiktok-pop', wordsPerCaption: 4,
      }) as any
      const captions = captionRes?.captions ?? []
      if (captions.length && setTextOverlays) {
        const overlays = captions.map((c: any, i: number) => ({
          id: `oneclick-${Date.now()}-${i}`,
          text: c.text, x: 50, y: 82, startTime: c.startTime, endTime: c.endTime,
          fontSize: 36, color: '#FFFFFF', fontFamily: 'Inter', style: 'bold-kinetic',
          animationIn: 'fade', animationOut: 'fade'
        }))
        setTextOverlays((prev: any[]) => [...(prev ?? []), ...overlays])
      }
      setStepProgress(100)

      setPipelineStep('distribution')
      setStepProgress(0)
      showToast('Step 5/8 — Viral Distribution Hub…', 'info')
      const distRes = await apiPost('/video/thumbnails/ai-viral', { videoId, timelineData: { transcript: transcriptText } }) as any
      const viralThumbnailUrl = distRes?.bestThumbnail
      const distributionConfidence = distRes?.confidence
      setStepProgress(100)

      setPipelineStep('roi-forecasting')
      setStepProgress(0)
      showToast('Step 6/8 — ROI Forecasting…', 'info')
      const roiRes = await apiPost('/video/advanced/roi-prediction', { videoId, timelineData: { transcript: transcriptText }, audiencePersona: 'Gen-Z' }) as any
      const roiData = roiRes?.data ?? roiRes
      setStepProgress(100)

      setPipelineStep('sourcing')
      setStepProgress(0)
      showToast('Step 7/8 — Autonomous Asset Sourcing…', 'info')
      const sourceRes = await apiPost('/video/advanced/source-assets', { transcript: transcriptText }) as any
      const sourcedAssets = sourceRes?.data ?? sourceRes
      setStepProgress(100)

      setPipelineStep('monetization')
      setStepProgress(0)
      showToast('Step 8/8 — Whop Monetization Bridge…', 'info')
      const monetRes = await apiPost('/video/advanced/monetization-plan', {
        transcript: transcriptText,
        videoId: videoId
      }) as any
      const monetizationPlan = monetRes?.data ?? monetRes
      setStepProgress(100)

      // Direct-to-Ads gating logic (derived from real hook + sales scores)
      const adPotential = {
        isHighPotential: hookScore >= 85 && (roiData?.salesScore ?? 0) >= 70,
        recommendedBudget: 5,
        reason: (hookScore >= 85) ? 'Exceptional hook velocity detected.' : 'Testing required.',
        thumbnail: viralThumbnailUrl
      }

      setPipelineStep('done')
      setPipelineResult({
        captionsAdded: captions.length,
        hookScore,
        hookInterpretation: analysis?.interpretation,
        topImprovement: analysis?.topImprovement,
        scores: analysis?.scores,
        hookType: analysis?.hookType,
        rewrites: analysis?.rewrites,
        directives: analysis?.directives,
        weakestMoment: analysis?.weakestMoment,
        strongestMoment: analysis?.strongestMoment,
        summary: analysis?.summary,
        suggestedTitle: analysis?.suggestedTitle,
        suggestedDescription: analysis?.suggestedDescription,
        suggestedTags: analysis?.suggestedTags,
        silenceGapsRemoved,
        silenceCleanedVideoUrl,
        viralThumbnailUrl,
        distributionConfidence,
        roiData,
        sourcedAssets,
        monetizationPlan,
        adPotential
      })
      showToast('Pipeline complete!', 'success')
    } catch (err: any) {
      setPipelineError(err.message || 'Pipeline failed')
      setPipelineStep('error')
      showToast('One-Click Pipeline failed', 'error')
    }
  }

  const handleLaunchAds = async () => {
    try {
      showToast('Launching low-CAC ad campaign…', 'info')
      await apiPost('/video/advanced/launch-test-ad', { videoId, platform: 'tiktok', budget: 5 })
      showToast('Ad live! Monitoring ROI in Style Vault…', 'success')
    } catch (err) {
      showToast('Ad launch failed', 'error')
    }
  }

  const handleRemoveSilence = async () => {
    if (!videoUrl) return
    setSilenceLoading(true)
    showToast('Removing silence…', 'info')
    try {
      const res = await apiPost('/video/advanced/remove-silence', {
        videoId, videoUrl, silenceThreshold, minSilenceDuration, padding: 0.08,
      }) as any
      setSilenceResult({
        segmentsKept: res?.segmentsKept ?? 0,
        silenceRemoved: res?.silenceRemoved ?? 0,
        resultUrl: res?.resultUrl,
      })
    } catch (err) {
      showToast(handleApiError(err), 'error')
    } finally {
      setSilenceLoading(false)
    }
  }

  const steps: { key: PipelineStep; label: string; icon: LucideIcon }[] = [
    { key: 'silence', label: 'Cut', icon: Scissors },
    { key: 'transcribing', label: 'Text', icon: Mic },
    { key: 'scoring', label: 'Score', icon: Zap },
    { key: 'captioning', label: 'Caps', icon: Type },
    { key: 'distribution', label: 'Viral', icon: Globe2 },
    { key: 'roi-forecasting', label: 'ROI', icon: Activity },
    { key: 'sourcing', label: 'Assets', icon: Layers },
    { key: 'monetization', label: 'Sell', icon: ShoppingCart }
  ]

  const running = pipelineStep !== 'idle' && pipelineStep !== 'done' && pipelineStep !== 'error'

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 ds-anim-rise">
      {/* Header */}
      <Badge variant="outline" className="gap-2 border-indigo-500/30 text-indigo-500">
        <Zap className="h-3.5 w-3.5" aria-hidden />
        Automations
      </Badge>
      <SectionHeader
        as="h1"
        title="Autopilot"
        description="Run the full viral pipeline in one click, or trigger individual automations."
      />

      {/* Viral One-Click */}
      <Panel variant="glass" className="space-y-6 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <Wand2 className="h-6 w-6 text-white" aria-hidden />
            </div>
            <div>
              <h2 className="ds-text-h3 text-theme-primary">The Viral One-Click</h2>
              <p className="ds-text-caption text-theme-muted">8-step pipeline: cut, caption, score, distribute, monetize</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {steps.map((step, i) => {
              const active = step.key === pipelineStep
              const StepIcon = step.icon
              return (
                <React.Fragment key={step.key}>
                  <div className={cn(
                    'flex flex-col items-center gap-1 rounded-lg px-2.5 py-1 transition-colors',
                    active ? 'bg-indigo-500/15 text-indigo-500' : 'text-theme-muted'
                  )}>
                    <StepIcon className="h-4 w-4" aria-hidden />
                    <span className="ds-text-caption">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-theme-muted" aria-hidden />}
                </React.Fragment>
              )
            })}
          </div>

          <Button onClick={handleViralOneClick} loading={running} leftIcon={!running ? <Zap className="h-4 w-4" aria-hidden /> : undefined}>
            {running ? 'Running…' : 'Run pipeline'}
          </Button>
        </div>

        {pipelineError && (
          <p className="text-sm text-rose-500">{pipelineError}</p>
        )}

        {pipelineStep === 'done' && pipelineResult && (
          <div className="space-y-6 ds-anim-rise">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Hook score" value={`${pipelineResult.hookScore ?? 0}%`} />
              {pipelineResult.roiData?.salesScore != null && (
                <StatCard label="Sales score" value={`${pipelineResult.roiData.salesScore}%`} />
              )}
              {pipelineResult.roiData?.estimatedROI != null && (
                <StatCard label="Estimated ROI" value={`$${pipelineResult.roiData.estimatedROI.toLocaleString()}`} />
              )}
            </div>

            {/* Ad Scaling */}
            {pipelineResult.adPotential?.isHighPotential && (
              <Panel variant="subtle" className="flex flex-col items-center justify-between gap-4 p-5 md:flex-row">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
                    <Rocket className="h-5 w-5 text-indigo-500" aria-hidden />
                  </div>
                  <div>
                    <p className="ds-text-label text-theme-primary">Low-CAC auto-scaling available</p>
                    <p className="ds-text-caption text-theme-muted">{pipelineResult.adPotential.reason}</p>
                  </div>
                </div>
                <Button onClick={handleLaunchAds} leftIcon={<Rocket className="h-4 w-4" aria-hidden />}>
                  Launch ${pipelineResult.adPotential.recommendedBudget}/day test ad
                </Button>
              </Panel>
            )}

            {/* Asset Sourcing Gallery */}
            {pipelineResult.sourcedAssets && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="ds-text-label text-theme-primary">Sourced assets</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pipelineResult.sourcedAssets.keywords.slice(0, 3).map(kw => (
                      <Badge key={kw} variant="outline">{kw}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                  {pipelineResult.sourcedAssets.suggestedAssets.slice(0, 6).map((asset, i) => (
                    <div key={asset.id} className="group relative aspect-video overflow-hidden rounded-xl border border-subtle">
                      <Image src={asset.url} alt={asset.matchedKeyword || ''} width={400} height={225} className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-100" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="truncate text-[10px] font-semibold text-white">{asset.matchedKeyword}</p>
                      </div>
                      {i === 0 && <Badge variant="outline" className="absolute left-1.5 top-1.5 border-emerald-500/40 bg-black/40 text-emerald-400">Top pick</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monetization Bridge */}
            {pipelineResult.monetizationPlan && (
              <Panel variant="subtle" className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-500" aria-hidden />
                  <p className="ds-text-label text-theme-primary">Conversion-triggered overlays</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(((pipelineResult.monetizationPlan as any).triggers) || []).map((step: any, idx: number) => (
                    <div key={idx} className="space-y-2 rounded-xl border border-subtle ds-surface-card p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-500">@{step.startTime}s</Badge>
                        <div className="flex items-center gap-1 text-emerald-500">
                          <TrendingUp className="h-3 w-3" aria-hidden />
                          <span className="ds-text-caption">{(step.intentScore * 100).toFixed(0)}% intent</span>
                        </div>
                      </div>
                      <p className="ds-text-label truncate text-theme-primary">{step.productName}</p>
                      <p className="ds-text-caption line-clamp-2 text-theme-muted">&quot;{step.reason}&quot;</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Viral asset */}
            {pipelineResult.viralThumbnailUrl && (
              <Panel variant="subtle" className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <Image src={pipelineResult.adPotential?.thumbnail || pipelineResult.viralThumbnailUrl} alt="Viral frame" width={400} height={225} className="h-12 w-20 rounded-lg border border-subtle object-cover" />
                  <div>
                    <p className="ds-text-label text-theme-primary">Viral asset ready</p>
                    <p className="ds-text-caption text-theme-muted">Emotion-cued framing applied</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => showToast('Publishing to TikTok, IG & YouTube…', 'success')}>
                  Publish all
                </Button>
              </Panel>
            )}
          </div>
        )}
      </Panel>

      {/* Individual automations */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Voiceover */}
        <Panel variant="glass" className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-orange-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">AI Voiceover</span>
          </div>
          <Textarea
            className="h-32"
            placeholder="Type script…"
            aria-label="Voiceover Script"
            title="Voiceover Script"
            value={voiceoverText}
            onChange={e => setVoiceoverText(e.target.value)}
          />
          <Button variant="secondary" className="w-full" loading={isGeneratingVoiceover} disabled={!voiceoverText.trim()}>
            Generate voice
          </Button>
        </Panel>

        {/* Auto-Jumpcut */}
        <Panel variant="glass" className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-violet-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">Auto-Jumpcut</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="ds-text-caption text-theme-muted">Min silence</span>
              <span className="ds-text-caption tabular-nums text-theme-secondary">{minSilenceDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              aria-label="Jumpcut Sensitivity"
              title="Jumpcut Sensitivity"
              value={minSilenceDuration}
              onChange={e => setMinSilenceDuration(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input accent-violet-500"
            />
          </div>
          <Button variant="secondary" className="w-full" onClick={handleRemoveSilence} loading={silenceLoading} disabled={!videoUrl}>
            Cut silence
          </Button>
          {silenceResult && (
            <p className="ds-text-caption text-theme-muted">
              Kept {silenceResult.segmentsKept} segments · removed {silenceResult.silenceRemoved.toFixed(1)}s
            </p>
          )}
        </Panel>

        {/* Auto-Caps */}
        <Panel variant="glass" className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-blue-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">Auto-Captions</span>
          </div>
          <p className="text-sm text-theme-secondary">Caption styles and positions are available in the Text tab.</p>
        </Panel>
      </div>
    </div>
  )
}

export default AutomateView
