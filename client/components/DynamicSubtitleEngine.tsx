'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Palette, Zap, Layout, Eye, Shield, Mic,
  Type as FontIcon, ToggleLeft, ToggleRight
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface SubtitleWord {
  text: string
  start: number
  end: number
  color?: string
}

interface AvoidanceZone {
  x: number   // % of video width (0-100)
  y: number   // % of video height (0-100)
  w: number
  h: number
  label?: string
}

interface SubtitlePreset {
  id: string
  name: string
  font: string
  color: string
  highlightColor: string
  animation: 'pop' | 'glow' | 'bounce'
}

interface DynamicSubtitleEngineProps {
  currentTime: number
  words: SubtitleWord[]
  /** Optional: 0-1 volume/intensity level for vocal scaling */
  volumeLevel?: number
  /**
   * Optional: Object avoidance zones from the spatial awareness service.
   * Each zone is a bounding box in % coordinates.
   * The engine shifts subtitle vertical position to avoid the tallest zone.
   */
  avoidanceZones?: AvoidanceZone[]
  /** When true, periodically sample current frame for face detection */
  smartDodgeEnabled?: boolean
  videoRef?: React.RefObject<HTMLVideoElement>
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRESETS: SubtitlePreset[] = [
  { id: 'hormozi', name: 'Viral Impact', font: 'font-black', color: 'text-white', highlightColor: 'text-yellow-400', animation: 'pop' },
  { id: 'beast', name: 'Retention Glow', font: 'font-bold', color: 'text-white', highlightColor: 'text-emerald-400', animation: 'glow' },
  { id: 'minimal', name: 'Clean Studio', font: 'font-medium', color: 'text-white', highlightColor: 'text-blue-400', animation: 'bounce' }
]

const BASE_FONT_SIZE = 24  // px — vocal intensity scales around this

/** Calculate safe Y position (%) that avoids bounding boxes */
function getSafeCaptionY(zones: AvoidanceZone[], defaultY = 85): number {
  if (!zones.length) return defaultY

  // Find zone that occupies the lower portion of the screen (y > 50%)
  const lowerZones = zones.filter(z => z.y + z.h > 50)
  if (!lowerZones.length) return defaultY

  // Shift captions above the highest lower-zone top edge
  const minY = Math.min(...lowerZones.map(z => z.y))
  // Ensure we don't push too far up (stay within 20-90%)
  return Math.max(20, Math.min(minY - 12, 85))
}

/** Map volume level to font size scale factor */
function getVocalScale(volume?: number): number {
  if (volume === undefined) return 1
  if (volume > 0.85) return 1.45   // shouting
  if (volume > 0.65) return 1.15   // raised voice
  if (volume < 0.2) return 0.72    // whisper
  return 1
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DynamicSubtitleEngine({
  currentTime,
  words,
  volumeLevel,
  avoidanceZones = [],
  smartDodgeEnabled = false,
  videoRef,
}: DynamicSubtitleEngineProps) {
  const [activePreset, setActivePreset] = useState<SubtitlePreset>(PRESETS[0])
  const [internalZones, setInternalZones] = useState<AvoidanceZone[]>(avoidanceZones)
  const [smartDodgeActive, setSmartDodgeActive] = useState(smartDodgeEnabled)
  const [isDetecting, setIsDetecting] = useState(false)
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Sync external zones
  useEffect(() => { setInternalZones(avoidanceZones) }, [avoidanceZones])

  // ── Smart Dodge: sample frame every 2s → detect faces ─────────────────────
  const sampleFrame = useCallback(async () => {
    const video = videoRef?.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    try {
      setIsDetecting(true)
      canvas.width = video.videoWidth || 480
      canvas.height = video.videoHeight || 270
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1]

      const res = await fetch('/api/captions-spatial/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64,
          videoWidth: canvas.width,
          videoHeight: canvas.height,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.detections)) {
          setInternalZones(data.detections.map((d: any) => ({
            x: (d.x / canvas.width) * 100,
            y: (d.y / canvas.height) * 100,
            w: (d.w / canvas.width) * 100,
            h: (d.h / canvas.height) * 100,
            label: d.label,
          })))
        }
      }
    } catch {
      // Silent fail — caption stays at default Y
    } finally {
      setIsDetecting(false)
    }
  }, [videoRef])

  useEffect(() => {
    if (smartDodgeActive && videoRef?.current) {
      sampleFrame()
      detectionTimerRef.current = setInterval(sampleFrame, 2000)
    } else {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current)
      if (!avoidanceZones.length) setInternalZones([])
    }
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current)
    }
  }, [smartDodgeActive, sampleFrame, avoidanceZones.length, videoRef])

  // ── Derived values ──────────────────────────────────────────────────────────
  const activeWordIndex = words.findIndex(w => currentTime >= w.start && currentTime <= w.end)
  const currentChunk = activeWordIndex !== -1
    ? words.slice(Math.max(0, activeWordIndex - 2), activeWordIndex + 3)
    : []

  const captionY = getSafeCaptionY(internalZones)
  const vocalScale = getVocalScale(volumeLevel)
  const effectiveFontSize = Math.round(BASE_FONT_SIZE * vocalScale)
  const isShouting = vocalScale > 1.3
  const isWhispering = vocalScale < 0.8

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden canvas for frame sampling */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Preset Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
        <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-[2px] flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-500" />
          Aesthetic Presets
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset)}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                activePreset.id === preset.id
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-transparent bg-gray-50 dark:bg-gray-900'
              }`}
            >
              <span className={`text-lg uppercase tracking-tighter ${preset.font} ${
                activePreset.id === preset.id ? 'text-indigo-500' : 'text-gray-400'
              }`}>Aa</span>
              <span className="text-[9px] font-black uppercase text-gray-500">{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Smart Dodge Toggle */}
        <div className="mt-5 flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <div>
              <p className="text-[10px] font-black text-white uppercase">Smart Dodge</p>
              <p className="text-[9px] text-slate-500">
                {isDetecting ? '⚡ Detecting faces…' : 'Captions avoid faces & objects'}
              </p>
            </div>
            {internalZones.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-[8px] font-black text-indigo-400">
                {internalZones.length} zone{internalZones.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => setSmartDodgeActive(v => !v)}
            title="Toggle Smart Dodge"
            aria-label="Toggle Smart Dodge face avoidance"
            className="flex items-center gap-1 text-indigo-400"
          >
            {smartDodgeActive
              ? <ToggleRight className="w-6 h-6" />
              : <ToggleLeft className="w-6 h-6 text-slate-500" />
            }
          </button>
        </div>

        {/* Vocal Intensity meter (when volumeLevel provided) */}
        {volumeLevel !== undefined && (
          <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-400" />
              <div>
                <p className="text-[10px] font-black text-white uppercase">Vocal Intensity</p>
                <p className="text-[9px] text-slate-500">
                  {isShouting ? '🔥 Shouting — text enlarged' : isWhispering ? '🤫 Whispering — text reduced' : 'Normal'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-rose-500 transition-all [width:var(--vol-pct)]"
                  style={{ '--vol-pct': `${Math.round((volumeLevel ?? 0) * 100)}%` } as React.CSSProperties}
                />
              </div>
              <span className="text-[9px] font-mono font-black text-slate-500">
                {Math.round((volumeLevel ?? 0) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Preview Engine */}
      <div className="aspect-video bg-black rounded-3xl relative overflow-hidden border-4 border-white/5">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Avoidance zone overlays (debug wireframes) */}
        {internalZones.map((zone, i) => (
          <div
            key={i}
            title={zone.label ?? 'Detection zone'}
            className="absolute border border-dashed border-indigo-500/50 rounded pointer-events-none [left:var(--zx)] [top:var(--zy)] [width:var(--zw)] [height:var(--zh)]"
            style={{
              '--zx': `${zone.x}%`,
              '--zy': `${zone.y}%`,
              '--zw': `${zone.w}%`,
              '--zh': `${zone.h}%`,
            } as React.CSSProperties}
          >
            {zone.label && (
              <span className="absolute -top-4 left-0 text-[7px] font-black text-indigo-400 uppercase tracking-widest bg-black/60 px-1 rounded">
                {zone.label}
              </span>
            )}
          </div>
        ))}

        {/* Caption container — Y position shifts away from avoidance zones */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-full text-center px-8"
          animate={{ top: `${captionY}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
            <AnimatePresence mode="popLayout">
              {currentChunk.map((word, idx) => {
                const isActive = words.indexOf(word) === activeWordIndex
                return (
                  <motion.span
                    key={`${word.text}-${word.start}`}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{
                      opacity: 1,
                      scale: isActive ? 1.4 * vocalScale : vocalScale,
                      y: 0,
                      rotate: (isActive && isShouting) ? [-1, 1, -1, 0] : 0,
                    }}
                    transition={{ duration: 0.15 }}
                    style={{ fontSize: effectiveFontSize }}
                    className={`uppercase ${activePreset.font} transition-colors duration-200 ${
                      isActive
                        ? `${activePreset.highlightColor} drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] z-10`
                        : 'text-white opacity-40'
                    }`}
                  >
                    {word.text}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Status badges */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          <p className="text-[8px] font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-3 h-3 text-yellow-400" />
            Real-time Subtitle Engine
            {smartDodgeActive && (
              <>
                <span className="text-white/20">·</span>
                <Eye className="w-3 h-3 text-indigo-400" />
                Smart Dodge {isDetecting ? '⚡' : 'Active'}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Engine Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Global Font</label>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">Inter Black Italics</span>
            <FontIcon className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Caption Y Position</label>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">
              {internalZones.length > 0 ? `Dodging — ${Math.round(captionY)}%` : `Default — ${Math.round(captionY)}%`}
            </span>
            <Layout className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
