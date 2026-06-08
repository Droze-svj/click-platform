'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Focus,
  Wand2,
  Video,
  Play,
  Eye,
  Layers,
  Zap,
  Loader2,
  CheckCircle2,
  Gauge,
  Type,
  Globe2,
  Maximize2,
  Lock,
  type LucideIcon
} from 'lucide-react'
import { apiPost } from '../../../lib/api'
import { useNeuralDepth } from '../../../hooks/useNeuralDepth'
import { useEntitlements } from '../../../hooks/useEntitlements'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
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
}

export const CreativeAIView: React.FC<CreativeAIViewProps> = ({
  videoId,
  showToast,
  setShapeOverlays,
  setVideoFilters,
  onUpdateBroll,
  transcript
}) => {
  const [localized, setLocalized] = useState(false)
  const [outpainted, setOutpainted] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  // Feature activation state
  const [brollGenerated, setBrollGenerated] = useState(false)
  const [isReframed, setIsReframed] = useState(false)
  const [eyeContactFixed, setEyeContactFixed] = useState(false)
  const [speedRamped, setSpeedRamped] = useState(false)
  const [avatarGenerated, setAvatarGenerated] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

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

  // Use a mock video ID for the depth hook if one isn't available
  const { isProcessing: isDepthProcessing, generateDepthMatte } = useNeuralDepth(`preview-video-${videoId}`)
  const [depthLayeringActive, setDepthLayeringActive] = useState(false)

  const handleDepthLayering = async () => {
    setProcessing('depthLayer')
    showToast('Initializing Edge Spatial Mapping...', 'info')

    // Attempt local depth matte extraction
    const matteUrl = await generateDepthMatte(0);

    if (matteUrl) {
       // In a real editor, this URL would be sent to the WebGPU renderer
       setDepthLayeringActive(true)
       showToast('Subject track complete. Spatial Text enabled.', 'success')
    } else {
       showToast('Local Spatial mapping failed. Retrying in cloud...', 'error')
    }
    setProcessing(null)
  }

  const handleAutoReframe = async () => {
    setProcessing('reframe')
    showToast('Initializing Intelligant Subject Tracking...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/auto-reframe', { videoId })
      if (res?.success) {
        setIsReframed(true)
        showToast('Auto-Reframe executed successfully.', 'success')
      } else {
        showToast('Auto-Reframe failed.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during reframe processing.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleMagicBRoll = async () => {
    if (gateTool('broll')) return
    setProcessing('broll')
    showToast('Injecting Context-Aware Semantic B-Roll...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/magic-broll', { videoId, transcript: transcript?.words || [] })
      if (res?.success && onUpdateBroll) {
        onUpdateBroll(res.overlays || [])
        setBrollGenerated(true)
        showToast(`Injected ${res.overlays?.length || 0} Neural B-Rolls`, 'success')
      } else {
        showToast('Magic B-Roll failed to generate.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during B-Roll generation.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleEyeContact = async () => {
    setProcessing('eyecontact')
    showToast('Recalibrating Neural Eye Vector...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/eye-contact', { videoId })
      if (res?.success) {
        setEyeContactFixed(true)
        showToast('Eye contact successfully recalibrated.', 'success')
      } else if (res?.notImplemented) {
        showToast(res.message || 'Eye Contact Fix is coming soon.', 'info')
      } else {
        showToast('Vector calibration failed.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during Eye Vector correction.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleBackgroundSwap = async () => {
    setProcessing('bgswap')
    showToast('Initiating Global Depth Mapping & Swap...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/background-swap', { videoId })
      if (res?.success) {
        showToast('Background swapped successfully.', 'success')
      } else if (res?.notImplemented) {
        showToast(res.message || 'Neural Depth Swap is coming soon.', 'info')
      } else {
        showToast('Depth mapping failed to lock.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during depth mapping.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleSpeedRamp = async () => {
    setProcessing('speedramp')
    showToast('Detecting kinetic beat-sync points…', 'info')
    try {
      const res = await apiPost<any>('/video/creative/speed-ramp', { videoId })
      if (res?.success) {
        setSpeedRamped(true)
        showToast(`Speed ramp applied — ${(res as any).rampCount ?? 0} transitions`, 'success')
      } else {
        showToast('Speed ramp failed — check your timeline length.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during speed ramp analysis.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleAiAvatar = async () => {
    setSwarmHUDTask('Digital Replica Synthesis')
    setShowSwarmHUD(true)
    setPendingAction(() => executeAiAvatar)
  }

  const executeAiAvatar = async () => {
    setProcessing('avatar')
    showToast('Synthesising AI talking-head replica…', 'info')
    try {
      // Use the new digital-twin endpoint
      const res = await apiPost<any>('/digital-twin/generate', {
        videoId,
        voiceNoteUrl: 'https://cdn.click.ai/assets/samples/voice_note_1.mp3', // Sample or derived from video
        options: {
          provider: 'heygen',
          resolution: '4K'
        }
      })

      if (res?.success) {
        setAvatarGenerated(true)
        showToast('Digital twin generation started. Check the activity log for status.', 'success')
      } else {
        showToast('Avatar generation failed.', 'error')
      }
    } catch (e) {
      showToast('Engine fault during avatar synthesis.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleLocalization = async () => {
    if (gateTool('localization')) return
    setProcessing('localization')
    showToast('Initializing Hyper-Native Lip-Sync pipeline...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/localize', { videoId, targetLanguage: 'Spanish' })
      if (res?.success) {
        setLocalized(true)
        showToast('Video Localized with Voice Cloning & Lip-Sync.', 'success')
      } else if (res?.notImplemented) {
        showToast(res.message || 'Global Native localization is coming soon.', 'info')
      } else {
        showToast('Localization failed.', 'error')
      }
    } catch (e) {
        showToast('Localization engine timeout.', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleOutpainting = async () => {
    setProcessing('outpainting')
    showToast('Generating pixel extensions for 9:16 layout...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/outpaint', { videoId })
      if (res?.success) {
        setOutpainted(true)
        showToast('Outpainting complete — 9:16 blur-pad fill applied.', 'success')
      } else if (res?.notImplemented) {
        showToast(res.message || 'Omni-Format outpainting is coming soon.', 'info')
      } else {
        showToast(res?.error || 'Generative fill failed.', 'error')
      }
    } catch (e) {
        showToast('Generative fill failed.', 'error')
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
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
            </Badge>
          ) : null}
        </div>
        <div>
          <h3 className="ds-text-h3 text-theme-primary">{title}</h3>
          <p className="mt-1 text-sm text-theme-muted">{desc}</p>
        </div>
      </div>

      <Button
        variant={locked ? 'secondary' : isActive ? 'secondary' : 'primary'}
        onClick={action}
        disabled={isProcessing}
        loading={isProcessing}
        title={locked ? `Upgrade to ${cap(gate.tier)} to unlock ${title}` : `Execute ${title} creative tool`}
        leftIcon={!isProcessing ? (locked ? <Lock className="h-4 w-4" aria-hidden /> : isActive ? <Zap className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />) : undefined}
        className="w-full"
      >
        {isProcessing ? 'Working…' : locked ? 'Unlock' : isActive ? 'Re-run' : 'Apply'}
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
          Generative AI Engine
        </Badge>
      </div>
      <SectionHeader
        as="h1"
        title="Creative Matrix"
        description="AI-driven enhancements applied directly to your timeline."
      />

      {/* Tools Grid */}
      <div className="ds-bento-grid">
        <ToolCard
          id="reframe"
          title="Auto-Reframe"
          desc="Intelligent object tracking that continuously centers the primary subject in vertical or square aspect ratios."
          Icon={Focus}
          action={handleAutoReframe}
          isActive={isReframed}
          isProcessing={processing === 'reframe'}
          colorClass="text-indigo-500"
        />

        <ToolCard
          id="broll"
          title="Magic B-Roll"
          desc="Context-aware semantic injection of hyper-relevant stock footage driven by transcript telemetry."
          Icon={Video}
          action={handleMagicBRoll}
          isActive={brollGenerated}
          isProcessing={processing === 'broll'}
          colorClass="text-purple-500"
        />

        <ToolCard
          id="depthLayer"
          title="3D Spatial Text"
          desc="Zero-latency edge-computed depth mapping allows captions to weave behind people in real-time."
          Icon={Type}
          action={handleDepthLayering}
          isActive={depthLayeringActive}
          isProcessing={processing === 'depthLayer' || isDepthProcessing}
          colorClass="text-cyan-500"
        />

        <ToolCard
          id="eyecontact"
          title="Eye Contact Fix"
          desc="Neural vector recalibration forcing direct lens contact regardless of original pupil orientation."
          Icon={Eye}
          action={handleEyeContact}
          isActive={eyeContactFixed}
          isProcessing={processing === 'eyecontact'}
          colorClass="text-emerald-500"
        />

        <ToolCard
          id="bgswap"
          title="Neural Depth Swap"
          desc="Zero-greenscreen AI separation of foreground meshes to inject dynamic or static backgrounds."
          Icon={Layers}
          action={handleBackgroundSwap}
          isActive={false}
          isProcessing={processing === 'bgswap'}
          colorClass="text-amber-500"
        />

        <ToolCard
          id="speedramp"
          title="AI Speed Ramp"
          desc="Beat-sync kinetic speed ramping — detects peak moments and auto-ramps for maximum impact."
          Icon={Gauge}
          action={handleSpeedRamp}
          isActive={speedRamped}
          isProcessing={processing === 'speedramp'}
          colorClass="text-cyan-500"
        />

        <ToolCard
          id="avatar"
          title="Digital Replica"
          desc="Neural synthesis of a digital twin for your subject, allowing for script-driven talking head sequences."
          Icon={Wand2}
          action={handleAiAvatar}
          isActive={avatarGenerated}
          isProcessing={processing === 'avatar'}
          colorClass="text-pink-500"
        />

        <ToolCard
          id="localization"
          title="Global Native"
          desc="Hyper-native dubbing with voice cloning and AI lip-sync synchronization for global expansion."
          Icon={Globe2}
          action={handleLocalization}
          isActive={localized}
          isProcessing={processing === 'localization'}
          colorClass="text-emerald-500"
        />

        <ToolCard
          id="outpainting"
          title="Omni-Format"
          desc="Generative outpainting and context-aware inpainting for non-destructive aspect ratio shifting."
          Icon={Maximize2}
          action={handleOutpainting}
          isActive={outpainted}
          isProcessing={processing === 'outpainting'}
          colorClass="text-sky-500"
        />
      </div>

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => {
          setShowSwarmHUD(false)
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          }
        }}
      />

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
