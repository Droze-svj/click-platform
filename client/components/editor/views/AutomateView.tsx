'use client'

import React, { useRef, useEffect } from 'react'
import {
  Mic, Zap, Loader2, Scissors, Split, Type, Sparkles, ChevronRight,
  CheckCircle2, AlertCircle, Cpu, Volume2, VolumeX, Wand2, ArrowRight, Bot,
  Activity, Brain, Pen, TrendingUp, Clock, Eye, Target, ArrowUpRight, Globe2,
  ShoppingCart, DollarSign, Rocket, LineChart, Share2, RefreshCw, Layers
} from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost, apiGet, handleApiError } from '../../../lib/api'

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

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

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

      // Task 8.3: Direct-to-Ads Integration Logic
      const adPotential = {
        isHighPotential: hookScore >= 85 && (roiData?.salesScore ?? 0) >= 70,
        recommendedBudget: 5,
        reason: (hookScore >= 85) ? 'Exceptional hook velocity detected.' : 'Testing required.',
        thumbnail: viralThumbnailUrl // Assuming viralThumbnailUrl can be used for ad thumbnail
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
      showToast('✦ Pipeline Complete!', 'success')
    } catch (err: any) {
      setPipelineError(err.message || 'Pipeline failed')
      setPipelineStep('error')
      showToast('One-Click Pipeline failed', 'error')
    }
  }

  const handleLaunchAds = async () => {
    try {
      showToast('Launching Low-CAC Ad Campaign...', 'info')
      await apiPost('/video/advanced/launch-test-ad', { videoId, platform: 'tiktok', budget: 5 })
      showToast('Ad Live! Monitoring ROI in Style Vault...', 'success')
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

  const steps: { key: PipelineStep; label: string; icon: React.ElementType }[] = [
    { key: 'silence', label: 'Cut', icon: Scissors },
    { key: 'transcribing', label: 'Text', icon: Mic },
    { key: 'scoring', label: 'Score', icon: Zap },
    { key: 'captioning', label: 'Caps', icon: Type },
    { key: 'distribution', label: 'Viral', icon: Globe2 },
    { key: 'roi-forecasting', label: 'ROI', icon: Activity },
    { key: 'sourcing', label: 'Assets', icon: Layers },
    { key: 'monetization', label: 'Sell', icon: ShoppingCart }
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row items-start justify-between gap-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-3 px-5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] italic text-indigo-400">
            <Zap className="w-3.5 h-3.5 animate-pulse" />
            Neural Automations
          </div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">AUTO<br />PILOT</h1>
        </div>
      </div>

      <motion.div className={`${glassStyle} rounded-[3rem] p-8 border-indigo-500/20 overflow-hidden relative group`}>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8">
          <div className="flex items-center gap-5 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg"><Wand2 className="w-7 h-7 text-white" /></div>
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">The Viral One-Click</h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((step, i) => {
              const active = step.key === pipelineStep
              const Icon = step.icon
              return (
                <React.Fragment key={step.key}>
                  <div className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${active ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-600'}`}>
                    <Icon className="w-4 h-4" />
                    <span className="text-[8px] font-black uppercase tracking-widest">{step.label}</span>
                  </div>
                  {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700" />}
                </React.Fragment>
              )
            })}
          </div>
          <button onClick={handleViralOneClick} className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[11px]">Run Pipeline</button>
        </div>

        <AnimatePresence>
          {pipelineStep === 'done' && pipelineResult && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Hook Score</p>
                  <p className="text-3xl font-black text-white italic">{pipelineResult.hookScore}%</p>
                </div>
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Sales Score</p>
                  <p className="text-3xl font-black text-white italic">{pipelineResult.roiData?.salesScore}%</p>
                </div>
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center">
                  <p className="text-[8px] font-black text-amber-400 uppercase mb-1">Estimated ROI</p>
                  <p className="text-2xl font-black text-white italic">${pipelineResult.roiData?.estimatedROI.toLocaleString()}</p>
                </div>
              </div>

              {/* Ad Scaling Hub */}
              {pipelineResult.adPotential?.isHighPotential && (
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="p-6 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-indigo-500/50 shadow-lg">
                      <Rocket className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-[12px] font-black text-white uppercase italic tracking-widest">Low-CAC Auto-Scaling Available</p>
                      <p className="text-[9px] text-slate-400 italic">"{pipelineResult.adPotential.reason}"</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[8px] font-black text-indigo-400 uppercase">Est. Test CPC</p>
                       <p className="text-lg font-black text-white italic">$0.12</p>
                    </div>
                    <button onClick={handleLaunchAds} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-indigo-600/20">Launch $5/Day Test Ad</button>
                  </div>
                </motion.div>
              )}

              {/* Asset Sourcing Gallery */}
              {pipelineResult.sourcedAssets && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest italic">Autonomous Sourcing Gallery</p>
                    <div className="flex gap-2">
                      {pipelineResult.sourcedAssets.keywords.slice(0, 3).map(kw => (
                        <span key={kw} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[7px] font-black text-slate-400 uppercase tracking-widest">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                    {pipelineResult.sourcedAssets.suggestedAssets.slice(0, 6).map((asset, i) => (
                      <motion.div
                        key={asset.id}
                        whileHover={{ scale: 1.05 }}
                        className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group cursor-pointer shadow-lg"
                      >
                          <Image src={asset.url} alt="" width={400} height={225} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-110 transition-transform duration-1000" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                           <p className="text-[7px] font-black text-white uppercase tracking-tighter truncate">{asset.matchedKeyword}</p>
                           <button className="mt-1 w-full bg-indigo-600 text-white text-[6px] font-black uppercase py-1 rounded-md">One-Click Swap</button>
                         </div>
                         {i === 0 && <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest">AI Top Pick</div>}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Whop Monetization Bridge */}
              {pipelineResult.monetizationPlan && (
                <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-5 h-5 text-emerald-400" />
                      <p className="text-[11px] font-black text-white uppercase tracking-widest italic">Conversion-Triggered Overlays</p>
                    </div>
                    <span className="text-[8px] font-black text-emerald-400/60 uppercase tracking-widest">Whop Sync Active</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(((pipelineResult.monetizationPlan as any).triggers) || []).map((step: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black text-indigo-400 uppercase px-2 py-0.5 bg-indigo-500/10 rounded-md">@{step.startTime}s</span>
                          <div className="flex items-center gap-1">
                             <TrendingUp className="w-3 h-3 text-emerald-400" />
                             <span className="text-[8px] font-black text-emerald-400 uppercase">{(step.intentScore * 100).toFixed(0)}% Intent</span>
                          </div>
                        </div>
                        <p className="text-[10px] font-black text-white uppercase truncate">{step.productName}</p>
                              <p className="text-[7px] text-slate-400 line-clamp-2 italic">&quot;{step.reason}&quot;</p>
                        <button className="w-full mt-2 py-2 bg-emerald-600 text-white text-[8px] font-black uppercase rounded-lg">Apply Checkout QR</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pipelineResult.viralThumbnailUrl && (
                <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Image src={pipelineResult.adPotential?.thumbnail || pipelineResult.viralThumbnailUrl} alt="Viral Frame" width={400} height={225} className="w-20 h-12 rounded-lg object-cover border border-white/10" />
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest italic">Viral Asset Ready</p>
                      <p className="text-[8px] text-slate-400 uppercase tracking-widest">Emotion-Cued Framing Applied</p>
                    </div>
                  </div>
                  <button onClick={() => showToast('Blasting to TikTok, IG & YouTube...', 'success')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Publish All</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className={`${glassStyle} p-8 rounded-[2.5rem] space-y-6`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center"><Mic className="w-6 h-6 text-white" /></div>
            <h3 className="font-black text-white uppercase italic">AI Voiceover</h3>
          </div>
          <textarea
            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none"
            placeholder="Type script..."
            aria-label="Voiceover Script"
            title="Voiceover Script"
            value={voiceoverText}
            onChange={e => setVoiceoverText(e.target.value)}
          />
          <button className="w-full py-4 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Generate Voice</button>
        </div>

        <div className={`${glassStyle} p-8 rounded-[2.5rem] space-y-6`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center"><Scissors className="w-6 h-6 text-white" /></div>
            <h3 className="font-black text-white uppercase italic">Auto-Jumpcut</h3>
          </div>
          <div className="space-y-4">
            <input
              type="range"
              min={0.2}
              max={2.0}
              step={0.1}
              aria-label="Jumpcut Sensitivity"
              title="Jumpcut Sensitivity"
              value={minSilenceDuration}
              onChange={e => setMinSilenceDuration(parseFloat(e.target.value))}
              className="w-full accent-violet-600"
            />
            <button onClick={handleRemoveSilence} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Cut Silence</button>
          </div>
        </div>

        <div className={`${glassStyle} p-8 rounded-[2.5rem] space-y-6`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center"><Type className="w-6 h-6 text-white" /></div>
            <h3 className="font-black text-white uppercase italic">Auto-Caps</h3>
          </div>
          <p className="text-slate-400 text-sm">Styles & positions available in text tab.</p>
        </div>
      </div>
    </div>
  )
}

export default AutomateView
