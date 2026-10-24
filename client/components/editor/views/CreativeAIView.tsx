'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Focus,
  Video,
  Play,
  Eye,
  Layers,
  Zap,
  CheckCircle2,
  Gauge,
  Globe2,
  Maximize2,
  Lock,
  type LucideIcon
} from 'lucide-react'
import { apiPost } from '../../../lib/api'
import { getMediaUrl } from '../../../utils/url'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { useTranslation } from '../../../hooks/useTranslation'
import { Card, Button, Badge, SectionHeader, UpgradeModal, LockedBadge } from '../../ui'
import { cn } from '../../../lib/utils'

// Canonical entitlement keys (server/config/entitlements.js) for the gated
// creative tools. Tools NOT listed here are available on every tier.
//   b_roll_ai          → Pro    (AI B-roll)
//   generative_dubbing → Agency (Generative dubbing — voice clone + lip-sync)
const TOOL_FEATURE: Record<string, { feature: string; tier: string }> = {
  broll: { feature: 'b_roll_ai', tier: 'pro' },
  localization: { feature: 'generative_dubbing', tier: 'agency' },
}

interface CreativeAIViewProps {
  videoId: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setShapeOverlays?: (fn: (prev: any[]) => any[]) => void
  setVideoFilters?: (filters: any) => void
  onUpdateBroll?: (overlays: any[]) => void
  transcript: any | null
  /** Source video URL (same-origin) — used to read its frame size for reframing. */
  videoUrl?: string
  /** Editor crop (percent insets) — auto-reframe applies its crop plan here. */
  setVideoCrop?: (crop: { top: number; right: number; bottom: number; left: number }) => void
  /** Adds markers to the timeline — the speed-ramp plan lands here. */
  onAddMarkers?: (markers: Array<{ time: number; name: string }>) => void
  /** Puts a processed full-length video (fill frame, background swap…) on the timeline. */
  onUseProcessedVideo?: (url: string, label: string) => void
  /** Puts a generated audio track (dub) on the timeline. */
  onAddAudioTrack?: (url: string, label: string) => void
}

/** Read the source video's width/height ratio from its metadata (null if unknown). */
function probeVideoAspect(url: string, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !url) return resolve(null)
    const v = document.createElement('video')
    let done = false
    const finish = (val: number | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      v.removeAttribute('src')
      try { v.load() } catch { /* detached element */ }
      resolve(val)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => finish(v.videoWidth > 0 && v.videoHeight > 0 ? v.videoWidth / v.videoHeight : null)
    v.onerror = () => finish(null)
    v.src = getMediaUrl(url)
  })
}

/** Centre-crop insets (percent) that turn a `source` ratio frame into a `target` ratio. */
export function centerCropInsets(source: number, target: number) {
  const round = (n: number) => Math.round(n * 100) / 100
  if (!(source > 0) || !(target > 0) || Math.abs(source - target) < 0.005) {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }
  if (source > target) {
    const side = round(((1 - target / source) / 2) * 100)
    return { top: 0, right: side, bottom: 0, left: side }
  }
  const side = round(((1 - source / target) / 2) * 100)
  return { top: side, right: 0, bottom: side, left: 0 }
}

export const CreativeAIView: React.FC<CreativeAIViewProps> = ({
  videoId,
  showToast,
  setShapeOverlays,
  setVideoFilters,
  onUpdateBroll,
  transcript,
  videoUrl,
  setVideoCrop,
  onAddMarkers,
  onUseProcessedVideo,
  onAddAudioTrack
}) => {
  const { t } = useTranslation()
  const [localized, setLocalized] = useState(false)
  const [outpainted, setOutpainted] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  // Feature activation state
  const [brollGenerated, setBrollGenerated] = useState(false)
  const [isReframed, setIsReframed] = useState(false)
  const [eyeContactFixed, setEyeContactFixed] = useState(false)
  const [speedRamped, setSpeedRamped] = useState(false)
  const [bgSwapped, setBgSwapped] = useState(false)
  // Output files a tool produced, keyed by tool id — shown as "Open result"
  // so a result is never thrown away when it can't be placed on the timeline.
  const [results, setResults] = useState<Record<string, string>>({})

  // A processed full-length video: put it on the timeline when the editor
  // can, otherwise keep it as an openable result. Returns true when applied.
  const applyVideoResult = (toolId: string, url: string | undefined, label: string): boolean => {
    if (!url) return false
    setResults((prev) => ({ ...prev, [toolId]: url }))
    if (onUseProcessedVideo) {
      onUseProcessedVideo(url, label)
      return true
    }
    return false
  }

  // Entitlements — honest client-side gate for Pro/Agency-only tools.
  const { hasFeature, tier } = useEntitlements()
  const [upgrade, setUpgrade] = useState<{ feature: string; tier: string } | null>(null)

  // Returns true (and opens the paywall) when the tool is locked for this user.
  const gateTool = (toolId: string): boolean => {
    const gate = TOOL_FEATURE[toolId]
    if (!gate) return false
    if (hasFeature(gate.feature)) return false
    setUpgrade(gate)
    return true
  }

  const handleAutoReframe = async () => {
    setProcessing('reframe')
    showToast(t('creativeAI.reframeStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/auto-reframe', { videoId, aspectRatio: '9:16' })
      const plan = res?.plan
      if (res?.success && plan) {
        // The server only returns a centre-crop plan — it renders nothing. Apply
        // it as the editor crop (used by both the preview and the export) so the
        // result is real, or say plainly that it wasn't applied.
        const ratio = String(plan.target || res.aspectRatio || '9:16')
        const target = Number(plan.targetWidth) / Number(plan.targetHeight)
        const source = setVideoCrop && videoUrl ? await probeVideoAspect(videoUrl) : null
        if (setVideoCrop && source && target > 0) {
          setVideoCrop(centerCropInsets(source, target))
          setIsReframed(true)
          showToast(t('creativeAI.reframeApplied', { ratio }), 'success')
        } else {
          showToast(t('creativeAI.reframeNotApplied', { ratio }), 'info')
        }
      } else {
        showToast(t('creativeAI.reframeFailed'), 'error')
      }
    } catch (e) {
      showToast(t('creativeAI.reframeError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleMagicBRoll = async () => {
    if (gateTool('broll')) return
    setProcessing('broll')
    showToast(t('creativeAI.brollStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/magic-broll', { videoId, transcript: transcript?.words || [] })
      if (res?.success && onUpdateBroll) {
        onUpdateBroll(res.overlays || [])
        setBrollGenerated(true)
        showToast(t('creativeAI.brollAdded', { count: res.overlays?.length || 0 }), 'success')
      } else {
        showToast(t('creativeAI.brollFailed'), 'error')
      }
    } catch (e) {
      showToast(t('creativeAI.brollError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleEyeContact = async () => {
    setProcessing('eyecontact')
    showToast(t('creativeAI.eyeContactStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/eye-contact', { videoId })
      if (res?.success && res.outputUrl) {
        setEyeContactFixed(true)
        const applied = applyVideoResult('eyecontact', res.outputUrl, t('creativeAI.eyeContactTitle'))
        showToast(applied ? t('creativeAI.resultAddedToTimeline', { tool: t('creativeAI.eyeContactTitle') }) : t('creativeAI.resultReady', { tool: t('creativeAI.eyeContactTitle') }), 'success')
      } else if (res?.success) {
        showToast(t('creativeAI.noOutput', { tool: t('creativeAI.eyeContactTitle') }), 'error')
      } else if (res?.notImplemented) {
        showToast(res.message || t('creativeAI.eyeContactUnavailable'), 'info')
      } else {
        showToast(t('creativeAI.eyeContactFailed'), 'error')
      }
    } catch (e) {
      showToast(t('creativeAI.eyeContactError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleBackgroundSwap = async () => {
    setProcessing('bgswap')
    showToast(t('creativeAI.bgSwapStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/background-swap', { videoId })
      if (res?.success && res.outputUrl) {
        setBgSwapped(true)
        const applied = applyVideoResult('bgswap', res.outputUrl, t('creativeAI.bgSwapTitle'))
        showToast(applied ? t('creativeAI.resultAddedToTimeline', { tool: t('creativeAI.bgSwapTitle') }) : t('creativeAI.resultReady', { tool: t('creativeAI.bgSwapTitle') }), 'success')
      } else if (res?.success) {
        showToast(t('creativeAI.noOutput', { tool: t('creativeAI.bgSwapTitle') }), 'error')
      } else if (res?.notImplemented) {
        showToast(res.message || t('creativeAI.bgSwapUnavailable'), 'info')
      } else {
        showToast(t('creativeAI.bgSwapFailed'), 'error')
      }
    } catch (e) {
      showToast(t('creativeAI.bgSwapError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleSpeedRamp = async () => {
    setProcessing('speedramp')
    showToast(t('creativeAI.speedRampStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/speed-ramp', { videoId })
      const points: Array<{ atTime: number; speed: number }> = Array.isArray(res?.rampPoints) ? res.rampPoints : []
      if (res?.success && points.length > 0) {
        // The server returns a plan (times + speeds) and renders nothing.
        // Mark each ramp on the timeline so the plan is usable, and say that
        // the speed changes themselves are still the user's to apply.
        if (onAddMarkers) {
          onAddMarkers(points.map((p) => ({ time: Number(p.atTime) || 0, name: t('creativeAI.speedRampMarker', { speed: p.speed }) })))
          setSpeedRamped(true)
          showToast(t('creativeAI.speedRampMarked', { count: points.length }), 'success')
        } else {
          showToast(t('creativeAI.speedRampPlanOnly', { count: points.length }), 'info')
        }
      } else {
        showToast(t('creativeAI.speedRampFailed'), 'error')
      }
    } catch (e) {
      showToast(t('creativeAI.speedRampError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleLocalization = async () => {
    if (gateTool('localization')) return
    setProcessing('localization')
    showToast(t('creativeAI.dubbingStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/localize', { videoId, targetLanguage: 'Spanish' })
      if (res?.success && res.vocalDub) {
        setLocalized(true)
        setResults((prev) => ({ ...prev, localization: res.vocalDub }))
        if (onAddAudioTrack) {
          onAddAudioTrack(res.vocalDub, t('creativeAI.dubbingTitle'))
          showToast(t('creativeAI.dubAddedToTimeline'), 'success')
        } else {
          showToast(t('creativeAI.resultReady', { tool: t('creativeAI.dubbingTitle') }), 'success')
        }
      } else if (res?.success) {
        showToast(t('creativeAI.noOutput', { tool: t('creativeAI.dubbingTitle') }), 'error')
      } else if (res?.notImplemented) {
        showToast(res.message || t('creativeAI.dubbingUnavailable'), 'info')
      } else {
        showToast(t('creativeAI.dubbingFailed'), 'error')
      }
    } catch (e) {
        showToast(t('creativeAI.dubbingError'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleOutpainting = async () => {
    setProcessing('outpainting')
    showToast(t('creativeAI.outpaintStarting'), 'info')
    try {
      const res = await apiPost<any>('/video/creative/outpaint', { videoId })
      if (res?.success && res.outputUrl) {
        setOutpainted(true)
        const applied = applyVideoResult('outpainting', res.outputUrl, t('creativeAI.outpaintTitle'))
        showToast(applied ? t('creativeAI.resultAddedToTimeline', { tool: t('creativeAI.outpaintTitle') }) : t('creativeAI.resultReady', { tool: t('creativeAI.outpaintTitle') }), 'success')
      } else if (res?.success) {
        showToast(t('creativeAI.noOutput', { tool: t('creativeAI.outpaintTitle') }), 'error')
      } else if (res?.notImplemented) {
        showToast(res.message || t('creativeAI.outpaintUnavailable'), 'info')
      } else {
        showToast(res?.error || t('creativeAI.outpaintFailed'), 'error')
      }
    } catch (e) {
        showToast(t('creativeAI.outpaintFailed'), 'error')
    } finally {
      setProcessing(null)
    }
  }

  const ToolCard = ({
    id,
    title,
    desc,
    Icon,
    action,
    isActive,
    isProcessing,
    colorClass
  }: {
    id: string,
    title: string,
    desc: string,
    Icon: LucideIcon,
    action: () => void,
    isActive: boolean,
    isProcessing: boolean,
    colorClass: string
  }) => {
    const gate = TOOL_FEATURE[id]
    const locked = !!gate && !hasFeature(gate.feature)
    return (
    <Card variant="bento" className="flex flex-col justify-between gap-5 p-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-start justify-between">
          <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-accent', colorClass)}>
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          {locked ? (
            <LockedBadge requiredTier={gate.tier} />
          ) : isActive ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> {t('creativeAI.active')}
            </Badge>
          ) : null}
        </div>
        <div>
          <h3 className="ds-text-h3 text-theme-primary">{title}</h3>
          <p className="mt-1 text-sm text-theme-muted">{desc}</p>
        </div>
      </div>

      {results[id] && (
        <a
          href={getMediaUrl(results[id])}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-indigo-500 underline-offset-2 hover:underline"
        >
          {t('creativeAI.openResult')}
        </a>
      )}
      <Button
        variant={locked ? 'secondary' : isActive ? 'secondary' : 'primary'}
        onClick={action}
        disabled={isProcessing}
        loading={isProcessing}
        title={locked ? t('creativeAI.upgradeToUnlock', { tier: cap(gate.tier), tool: title }) : t('creativeAI.runTool', { tool: title })}
        leftIcon={!isProcessing ? (locked ? <Lock className="h-4 w-4" aria-hidden /> : isActive ? <Zap className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />) : undefined}
        className="w-full"
      >
        {isProcessing ? t('creativeAI.working') : locked ? t('creativeAI.unlock') : isActive ? t('creativeAI.runAgain') : t('creativeAI.apply')}
      </Button>
    </Card>
    )
  }

  return (
    <div className="space-y-6 pb-10 ds-anim-rise">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="gap-2 border-indigo-500/30 text-indigo-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t('creativeAI.badge')}
        </Badge>
      </div>
      <SectionHeader
        as="h1"
        title={t('creativeAI.title')}
        description={t('creativeAI.description')}
      />

      {/* Tools Grid */}
      <div className="ds-bento-grid">
        <ToolCard
          id="reframe"
          title={t('creativeAI.reframeTitle')}
          desc={t('creativeAI.reframeDesc')}
          Icon={Focus}
          action={handleAutoReframe}
          isActive={isReframed}
          isProcessing={processing === 'reframe'}
          colorClass="text-indigo-500"
        />

        <ToolCard
          id="broll"
          title={t('creativeAI.brollTitle')}
          desc={t('creativeAI.brollDesc')}
          Icon={Video}
          action={handleMagicBRoll}
          isActive={brollGenerated}
          isProcessing={processing === 'broll'}
          colorClass="text-purple-500"
        />

        <ToolCard
          id="eyecontact"
          title={t('creativeAI.eyeContactTitle')}
          desc={t('creativeAI.eyeContactDesc')}
          Icon={Eye}
          action={handleEyeContact}
          isActive={eyeContactFixed}
          isProcessing={processing === 'eyecontact'}
          colorClass="text-emerald-500"
        />

        <ToolCard
          id="bgswap"
          title={t('creativeAI.bgSwapTitle')}
          desc={t('creativeAI.bgSwapDesc')}
          Icon={Layers}
          action={handleBackgroundSwap}
          isActive={bgSwapped}
          isProcessing={processing === 'bgswap'}
          colorClass="text-amber-500"
        />

        <ToolCard
          id="speedramp"
          title={t('creativeAI.speedRampTitle')}
          desc={t('creativeAI.speedRampDesc')}
          Icon={Gauge}
          action={handleSpeedRamp}
          isActive={speedRamped}
          isProcessing={processing === 'speedramp'}
          colorClass="text-cyan-500"
        />

        <ToolCard
          id="localization"
          title={t('creativeAI.dubbingTitle')}
          desc={t('creativeAI.dubbingDesc')}
          Icon={Globe2}
          action={handleLocalization}
          isActive={localized}
          isProcessing={processing === 'localization'}
          colorClass="text-emerald-500"
        />

        <ToolCard
          id="outpainting"
          title={t('creativeAI.outpaintTitle')}
          desc={t('creativeAI.outpaintDesc')}
          Icon={Maximize2}
          action={handleOutpainting}
          isActive={outpainted}
          isProcessing={processing === 'outpainting'}
          colorClass="text-sky-500"
        />
      </div>

      <UpgradeModal
        open={!!upgrade}
        onClose={() => setUpgrade(null)}
        feature={upgrade?.feature}
        requiredTier={upgrade?.tier}
        currentTier={tier}
        reason="feature"
      />
    </div>
  )
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export default CreativeAIView
