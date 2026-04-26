'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Focus,
  Wand2,
  Video,
  MonitorPlay,
  Play,
  Eye,
  Camera,
  Layers,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Gauge,
  Tv,
  Type,
  Globe2,
  Maximize2
} from 'lucide-react'
import { apiPost, apiGet } from '../../../lib/api'
import { useNeuralDepth } from '../../../hooks/useNeuralDepth'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'

interface CreativeAIViewProps {
  videoId: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setShapeOverlays?: (fn: (prev: any[]) => any[]) => void
  setVideoFilters?: (filters: any) => void
  onUpdateBroll?: (overlays: any[]) => void
  transcript: any | null
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]"

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

  // Demo features state
  const [brollGenerated, setBrollGenerated] = useState(false)
  const [isReframed, setIsReframed] = useState(false)
  const [eyeContactFixed, setEyeContactFixed] = useState(false)
  const [speedRamped, setSpeedRamped] = useState(false)
  const [avatarGenerated, setAvatarGenerated] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

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
    setProcessing('localization')
    showToast('Initializing Hyper-Native Lip-Sync pipeline...', 'info')
    try {
      const res = await apiPost<any>('/video/creative/localize', { videoId, targetLanguage: 'Spanish' })
      if (res?.success) {
        setLocalized(true)
        showToast('Video Localized with Voice Cloning & Lip-Sync.', 'success')
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
        showToast('Outpainting complete — context-aware fill applied.', 'success')
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
    Icon: any,
    action: () => void,
    isActive: boolean,
    isProcessing: boolean,
    colorClass: string
  }) => (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className={`${glassStyle} p-8 rounded-[3rem] border-white/5 overflow-hidden group shadow-2xl relative flex flex-col justify-between`}
    >
      <div className={`absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none rotate-12 group-hover:scale-110 group-hover:opacity-[0.08] transition-all duration-700 ${colorClass}`}>
        <Icon className="w-48 h-48" />
      </div>

      <div className="space-y-6 relative z-10 flex-1">
        <div className="flex items-start justify-between">
          <div className={`w-16 h-16 rounded-[1.5rem] bg-white/[0.05] flex items-center justify-center border border-white/10 shadow-xl group-hover:border-current transition-colors ${colorClass}`}>
            <Icon className="w-8 h-8" />
          </div>
          {isActive && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
              <CheckCircle2 className="w-3 h-3" /> ACTIVE
            </div>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{title}</h3>
          <p className="text-sm font-medium text-slate-400 mt-2">{desc}</p>
        </div>
      </div>

      <button
        onClick={action}
        disabled={isProcessing}
        title={`Execute ${title} creative tool`}
        className={`w-full relative mt-8 py-5 rounded-[2rem] bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-[10px] tracking-[0.4em] uppercase transition-all flex items-center justify-center gap-3 overflow-hidden group/btn disabled:opacity-50`}
      >
        <div className={`absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 bg-gradient-to-r transparent to-transparent ${colorClass.replace('text-', 'from-')}/20`} />
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> EXECUTING...
          </>
        ) : isActive ? (
          <>
            <Zap className="w-4 h-4 fill-current" /> RE-INITIALIZE
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" /> DEPLOY PROTOCOL
          </>
        )}
      </button>
    </motion.div>
  )

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20 relative px-4 xl:px-8 pt-8">
      {/* Dynamic Background Glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full opacity-50 pointer-events-none" />

      {/* Header */}
      <div className="space-y-6">
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] shadow-lg">
          <Sparkles className="w-4 h-4" />
          GENERATIVE AI ENGINE
        </div>
        <h2 className="text-[5rem] md:text-[7rem] font-black tracking-tighter italic leading-none bg-gradient-to-br from-white via-indigo-200 to-purple-500 bg-clip-text text-transparent uppercase border-b border-white/10 pb-8">
          CREATIVE<br />MATRIX
        </h2>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <ToolCard
          id="reframe"
          title="Auto-Reframe"
          desc="Intelligent object tracking that continuously centers the primary subject in vertical or square aspect ratios."
          Icon={Focus}
          action={handleAutoReframe}
          isActive={isReframed}
          isProcessing={processing === 'reframe'}
          colorClass="text-indigo-400"
        />

        <ToolCard
          id="broll"
          title="Magic B-Roll"
          desc="Context-aware semantic injection of hyper-relevant stock footage driven by transcript telemetry."
          Icon={Video}
          action={handleMagicBRoll}
          isActive={brollGenerated}
          isProcessing={processing === 'broll'}
          colorClass="text-purple-400"
        />

        <ToolCard
          id="depthLayer"
          title="3D Spatial Text"
          desc="Zero-latency edge-computed depth mapping allows captions to weave behind people in real-time."
          Icon={Type}
          action={handleDepthLayering}
          isActive={depthLayeringActive}
          isProcessing={processing === 'depthLayer' || isDepthProcessing}
          colorClass="text-cyan-400"
        />

        <ToolCard
          id="eyecontact"
          title="Eye Contact Fix"
          desc="Neural vector recalibration forcing direct lens contact regardless of original pupil orientation."
          Icon={Eye}
          action={handleEyeContact}
          isActive={eyeContactFixed}
          isProcessing={processing === 'eyecontact'}
          colorClass="text-emerald-400"
        />

        <ToolCard
          id="bgswap"
          title="Neural Depth Swap"
          desc="Zero-greenscreen AI separation of foreground meshes to inject dynamic or static backgrounds."
          Icon={Layers}
          action={handleBackgroundSwap}
          isActive={false}
          isProcessing={processing === 'bgswap'}
          colorClass="text-amber-400"
        />

        <ToolCard
          id="speedramp"
          title="AI Speed Ramp"
          desc="Beat-sync kinetic speed ramping — detects peak moments and auto-ramps for maximum impact."
          Icon={Gauge}
          action={handleSpeedRamp}
          isActive={speedRamped}
          isProcessing={processing === 'speedramp'}
          colorClass="text-cyan-400"
        />

        <ToolCard
          id="avatar"
          title="Digital Replica"
          desc="Neural synthesis of a digital twin for your subject, allowing for script-driven talking head sequences."
          Icon={Wand2}
          action={handleAiAvatar}
          isActive={avatarGenerated}
          isProcessing={processing === 'avatar'}
          colorClass="text-pink-400"
        />

        <ToolCard
          id="localization"
          title="Global Native"
          desc="Hyper-native dubbing with voice cloning and AI lip-sync synchronization for global expansion."
          Icon={Globe2}
          action={handleLocalization}
          isActive={localized}
          isProcessing={processing === 'localization'}
          colorClass="text-emerald-400"
        />

        <ToolCard
          id="outpainting"
          title="Omni-Format"
          desc="Generative outpainting and context-aware inpainting for non-destructive aspect ratio shifting."
          Icon={Maximize2}
          action={handleOutpainting}
          isActive={outpainted}
          isProcessing={processing === 'outpainting'}
          colorClass="text-sky-400"
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
    </div>
  )
}

export default CreativeAIView
