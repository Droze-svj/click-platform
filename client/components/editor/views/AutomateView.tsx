'use client'

import React from 'react'
import {
  Mic, Zap, Scissors, Type, Wand2, ArrowRight, Globe2,
  ShoppingCart, TrendingUp, Activity, Layers, ExternalLink, type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import { apiPost, handleApiError } from '../../../lib/api'
// Shared with AIContentAnalysis — both wait on the same background-job contract.
import { awaitVideoJob } from '../../../lib/videoJobs'
import { Panel, Button, Badge, SectionHeader, StatCard, Textarea } from '../../ui'
import { cn } from '../../../lib/utils'
import { useTranslation } from '../../../hooks/useTranslation'

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
  const { t } = useTranslation()
  const [pipelineResult, setPipelineResult] = React.useState<{
    captionsAdded: number
    hookScore?: number
    /** true when the hook score is the text-only estimate (no AI engine answered). */
    hookScoreIsEstimate?: boolean
    silenceGapsRemoved?: number
    silenceCleanedVideoUrl?: string
    viralThumbnailUrl?: string
    roiData?: { salesScore: number; estimatedROI: number; recommendations: any[] }
    sourcedAssets?: { keywords: string[], suggestedAssets: any[] }
    monetizationPlan?: { monetizationSteps: any[], products: any[] }
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
      await apiPost('/video/advanced/remove-silence', {
        videoId, videoUrl, silenceThreshold, minSilenceDuration, padding: 0.08,
      })
      // 202 + background job — the cut video only exists once the job completes.
      const silResult = await awaitVideoJob(videoId, 'remove-silence', setStepProgress)
      if (silResult?.resultUrl) {
        activeVideoUrl = silResult.resultUrl
        silenceCleanedVideoUrl = silResult.resultUrl
        silenceGapsRemoved = silResult.silenceRemoved ?? 0
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
      showToast(t('automate.stepHook'), 'info')
      const scoreRes = await apiPost('/video/hook-analysis', {
        videoId, videoUrl: activeVideoUrl, transcript: transcriptText || undefined,
      }) as any
      // /video/hook-analysis answers with sendSuccess, which puts the analysis
      // itself in `data`. Its score field is `hookStrength` (0-100) — there is
      // no `overallScore` or `score`, so reading those made the hook score 0 for
      // every video in the one-click pipeline.
      const analysis = (scoreRes?.data ?? scoreRes)
      const hookScore = typeof analysis?.hookStrength === 'number' ? analysis.hookStrength : undefined
      const hookScoreIsEstimate = analysis?.isFallback === true || analysis?.engine === 'heuristic'
      setStepProgress(100)

      setPipelineStep('captioning')
      setStepProgress(0)
      showToast('Step 4/8 — Adding captions…', 'info')
      const captionRes = await apiPost('/video/hook-analysis/auto-caption', {
        videoId, transcript: transcriptText, style: 'tiktok-pop', wordsPerCaption: 4,
      }) as any
      // Envelope-aware: the route wraps the payload as { data: { captions } }.
      const captions = (captionRes?.data ?? captionRes)?.captions ?? []
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
      showToast(t('automate.stepThumbnail'), 'info')
      const distRes = await apiPost('/video/thumbnails/ai-viral', { videoId, timelineData: { transcript: transcriptText } }) as any
      // Also sendSuccess-wrapped: bestThumbnail/confidence live under .data, so
      // the unwrapped reads here were always undefined and the pipeline never
      // picked up the thumbnail it had just paid to generate.
      const distPayload = distRes?.data ?? distRes
      const viralThumbnailUrl = distPayload?.bestThumbnail
      setStepProgress(100)

      setPipelineStep('roi-forecasting')
      setStepProgress(0)
      showToast(t('automate.stepRoi'), 'info')
      const roiRes = await apiPost('/video/advanced/roi-prediction', { videoId, timelineData: { transcript: transcriptText }, audiencePersona: 'Gen-Z' }) as any
      const roiData = roiRes?.data ?? roiRes
      setStepProgress(100)

      setPipelineStep('sourcing')
      setStepProgress(0)
      showToast(t('automate.stepAssets'), 'info')
      const sourceRes = await apiPost('/video/advanced/source-assets', { transcript: transcriptText }) as any
      const sourcedAssets = sourceRes?.data ?? sourceRes
      setStepProgress(100)

      setPipelineStep('monetization')
      setStepProgress(0)
      showToast(t('automate.stepProducts'), 'info')
      const monetRes = await apiPost('/video/advanced/monetization-plan', {
        transcript: transcriptText,
        videoId: videoId
      }) as any
      const monetizationPlan = monetRes?.data ?? monetRes
      setStepProgress(100)

      setPipelineStep('done')
      setPipelineResult({
        captionsAdded: captions.length,
        hookScore,
        hookScoreIsEstimate,
        silenceGapsRemoved,
        silenceCleanedVideoUrl,
        viralThumbnailUrl,
        roiData,
        sourcedAssets,
        monetizationPlan,
      })
      showToast('Pipeline complete!', 'success')
    } catch (err: any) {
      setPipelineError(err.message || 'Pipeline failed')
      setPipelineStep('error')
      showToast('One-Click Pipeline failed', 'error')
    }
  }

  // AI voiceover — POST /video/advanced/voiceover answers 202 and does the TTS
  // in the background; sent WITHOUT a videoUrl it returns the narration as an
  // audio file (audioResultUrl + duration), which becomes a timeline segment.
  // This button used to have no click handler at all.
  const handleGenerateVoiceover = async () => {
    const text = voiceoverText.trim()
    if (!text) return
    if (!videoId) {
      showToast(t('automate.voiceNeedsVideo'), 'error')
      return
    }
    setIsGeneratingVoiceover(true)
    try {
      await apiPost('/video/advanced/voiceover', { videoId, text, voice: selectedVoice })
      const result = await awaitVideoJob(videoId, 'voiceover')
      const url = result?.audioResultUrl || result?.resultUrl
      const duration = Number(result?.duration)
      if (!url || !Number.isFinite(duration) || duration <= 0) {
        throw new Error(t('automate.voiceNoAudio'))
      }
      onAddVoiceoverSegment(url, duration)
      showToast(t('automate.voiceAdded'), 'success')
    } catch (err) {
      showToast(handleApiError(err) || t('automate.voiceFailed'), 'error')
    } finally {
      setIsGeneratingVoiceover(false)
    }
  }

  const handleRemoveSilence = async () => {
    if (!videoUrl) return
    setSilenceLoading(true)
    showToast('Removing silence…', 'info')
    try {
      await apiPost('/video/advanced/remove-silence', {
        videoId, videoUrl, silenceThreshold, minSilenceDuration, padding: 0.08,
      })
      const result = await awaitVideoJob(videoId, 'remove-silence')
      setSilenceResult({
        segmentsKept: result?.segmentsKept ?? 0,
        silenceRemoved: result?.silenceRemoved ?? 0,
        resultUrl: result?.resultUrl,
      })
      showToast('Silence removed', 'success')
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
    { key: 'distribution', label: t('automate.stepLabelThumbnail'), icon: Globe2 },
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
              <p className="ds-text-caption text-theme-muted">{t('automate.pipelineDescription')}</p>
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
              <StatCard
                label={pipelineResult.hookScoreIsEstimate ? t('automate.hookScoreEstimate') : t('automate.hookScore')}
                value={pipelineResult.hookScore != null ? `${pipelineResult.hookScore}/100` : '—'}
              />
              {pipelineResult.roiData?.salesScore != null && (
                <StatCard label="Sales score" value={`${pipelineResult.roiData.salesScore}%`} />
              )}
              {pipelineResult.roiData?.estimatedROI != null && (
                <StatCard label="Estimated ROI" value={`$${pipelineResult.roiData.estimatedROI.toLocaleString()}`} />
              )}
            </div>

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
                  <Image src={pipelineResult.viralThumbnailUrl} alt={t('automate.thumbnailAlt')} width={400} height={225} className="h-12 w-20 rounded-lg border border-subtle object-cover" />
                  <div>
                    <p className="ds-text-label text-theme-primary">{t('automate.thumbnailReady')}</p>
                    <p className="ds-text-caption text-theme-muted">{t('automate.thumbnailHint')}</p>
                  </div>
                </div>
                <a
                  href={pipelineResult.viralThumbnailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {t('automate.openThumbnail')}
                </a>
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
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleGenerateVoiceover}
            loading={isGeneratingVoiceover}
            disabled={!voiceoverText.trim() || !videoId || isGeneratingVoiceover}
          >
            {t('automate.generateVoice')}
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
