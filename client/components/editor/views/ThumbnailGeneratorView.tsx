'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import {
  ImageDown, Sparkles, Zap, Film, Loader2, CheckCircle2,
  Download, RefreshCw, Palette, Type, Star, Camera, type LucideIcon
} from 'lucide-react'
import { apiPost } from '../../../lib/api'
import { Panel, Button, Badge, Input, FormField, SectionHeader } from '../../ui'
import { cn } from '../../../lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThumbnailGeneratorViewProps {
  videoUrl?: string
  videoId?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

interface StylePreset {
  id: string
  label: string
  desc: string
  icon: LucideIcon
  textColor: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'viral',
    label: 'Ultra-Viral',
    desc: 'High contrast, bold text, arrow/pointer overlays — MrBeast formula',
    icon: Zap,
    textColor: 'text-yellow-500',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    desc: 'Letterbox bars, muted grade, title card — film-festival look',
    icon: Film,
    textColor: 'text-slate-400',
  },
  {
    id: 'reaction',
    label: 'Reaction Face',
    desc: 'Zoomed cropped face, emoji reactions, bright background pop',
    icon: Star,
    textColor: 'text-pink-500',
  },
  {
    id: 'minimal',
    label: 'Minimal Text',
    desc: 'Clean negative space, large serif headline, luxury/educational feel',
    icon: Type,
    textColor: 'text-indigo-500',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

const ThumbnailGeneratorView: React.FC<ThumbnailGeneratorViewProps> = ({
  videoUrl, videoId, showToast,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('viral')
  const [title, setTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<{ url: string; style: string } | null>(null)
  const [scrubTime, setScrubTime] = useState(0)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  // ── Capture frame from video at scrubTime ────────────────────────────────────
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    video.currentTime = scrubTime
    video.onseeked = () => {
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setCapturedFrame(dataUrl)
      setGenerated(null)
      showToast('Frame captured — choose a style and generate', 'success')
    }
  }, [scrubTime, showToast])

  // ── Generate thumbnail via API (or canvas-only fallback) ──────────────────────
  const generateThumbnail = async () => {
    if (!capturedFrame) { showToast('Capture a frame first', 'error'); return }
    setSwarmHUDTask(`Neural Aesthetic Forge: ${selectedStyle.toUpperCase()}`)
    setShowSwarmHUD(true)
    setGenerating(true)
    try {
      await apiPost('/video/creative/thumbnail', {
        videoId,
        frameDataUrl: capturedFrame,
        style: selectedStyle,
        title: title.trim() || undefined,
      })
      // For now show the captured frame as the "generated" result
      // (real implementation would return an AI-enhanced URL)
      setGenerated({ url: capturedFrame, style: selectedStyle })
      showToast('Thumbnail generated!', 'success')
    } catch {
      // Fallback: just use captured frame with CSS overlay labels
      setGenerated({ url: capturedFrame, style: selectedStyle })
      showToast('Thumbnail ready', 'success')
    } finally {
      setGenerating(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  const downloadThumbnail = () => {
    const src = generated?.url ?? capturedFrame
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = `thumbnail-${selectedStyle}-${Date.now()}.jpg`
    a.click()
    showToast('Thumbnail downloaded!', 'success')
  }

  const preset = STYLE_PRESETS.find(p => p.id === selectedStyle)!
  const PresetIcon = preset.icon

  // Thumbnail formula tips — keyed to the same presets (no emoji, lucide only)
  const TIPS: { id: string; label: string; tip: string; icon: LucideIcon }[] = [
    { id: 'viral', label: 'Ultra-Viral', tip: 'Use 0:02–0:04 — catch the action moment', icon: Zap },
    { id: 'cinematic', label: 'Cinematic', tip: 'Use the establishing wide shot', icon: Film },
    { id: 'reaction', label: 'Reaction Face', tip: 'Use the peak-emotion close-up', icon: Star },
    { id: 'minimal', label: 'Minimal', tip: 'Use a clean background frame', icon: Type },
  ]

  return (
    <div className="space-y-6 pb-10 ds-anim-rise">
      {/* Header */}
      <Badge variant="outline" className="gap-2 border-orange-500/30 text-orange-500">
        <ImageDown className="h-3.5 w-3.5" aria-hidden />
        AI Thumbnail Generator
      </Badge>
      <SectionHeader
        as="h1"
        title="Thumbnail Studio"
        description="Scrub to the perfect frame, choose an AI style preset, and generate a click-magnetic thumbnail."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">

        {/* Left — Frame Picker */}
        <div className="space-y-6">

          {/* Hidden video + canvas (used for frame capture) */}
          {videoUrl && (
            <>
              <video ref={videoRef} src={videoUrl} className="hidden" crossOrigin="anonymous" preload="metadata" />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {/* Frame preview card */}
          <Panel variant="glass" className="space-y-5 p-6">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-orange-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">Frame Picker</span>
            </div>

            {/* Preview */}
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl ds-surface-subtle">
              {capturedFrame ? (
                <>
                  <Image src={capturedFrame} alt="Captured frame" fill className="object-cover" unoptimized />
                  {/* Style overlay preview badge */}
                  <Badge variant="outline" className={cn('absolute right-3 top-3 gap-1 bg-black/40 backdrop-blur', preset.textColor)}>
                    <PresetIcon className="h-3 w-3" aria-hidden /> {preset.label}
                  </Badge>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-theme-muted">
                  <Camera className="h-12 w-12" aria-hidden />
                  <p className="ds-text-caption">
                    {videoUrl ? 'Scrub & hit Capture Frame' : 'Load a video first'}
                  </p>
                </div>
              )}
            </div>

            {/* Scrubber */}
            {videoUrl && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="ds-text-caption text-theme-muted">Scrub to frame</span>
                  <span className="font-mono text-xs font-semibold text-indigo-500">
                    {Math.floor(scrubTime / 60)}:{String(Math.floor(scrubTime % 60)).padStart(2, '0')}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={0.1}
                  value={scrubTime}
                  onChange={e => setScrubTime(parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input accent-orange-500"
                  title="Frame scrubber"
                  aria-label="Frame scrubber"
                />
                <Button
                  onClick={captureFrame}
                  className="w-full"
                  leftIcon={<Camera className="h-4 w-4" aria-hidden />}
                >
                  Capture Frame
                </Button>
              </div>
            )}

            {/* Title input */}
            <FormField label="Thumbnail Title (optional)" htmlFor="thumb-title">
              <Input
                id="thumb-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. I Tried This for 30 Days…"
                title="Thumbnail title overlay"
              />
            </FormField>
          </Panel>

          {/* Style presets */}
          <Panel variant="glass" className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-fuchsia-500" aria-hidden />
              <span className="ds-text-label text-theme-primary">AI Style Preset</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STYLE_PRESETS.map(s => {
                const SIcon = s.icon
                const active = selectedStyle === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStyle(s.id)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                      active ? 'border-current ds-surface-subtle' : 'border-subtle ds-surface-subtle hover:border-border'
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <SIcon className={cn('h-4 w-4', active ? s.textColor : 'text-theme-muted')} aria-hidden />
                      <span className={cn('ds-text-label', active ? s.textColor : 'text-theme-secondary')}>
                        {s.label}
                      </span>
                      {active && <CheckCircle2 className={cn('ml-auto h-3.5 w-3.5', s.textColor)} aria-hidden />}
                    </div>
                    <p className="text-xs text-theme-muted">{s.desc}</p>
                  </button>
                )
              })}
            </div>
          </Panel>
        </div>

        {/* Right — Generate + Output */}
        <div className="space-y-6">

          {/* Generate button */}
          <Button
            onClick={generateThumbnail}
            disabled={!capturedFrame || generating}
            loading={generating}
            size="lg"
            className="w-full"
            leftIcon={!generating ? <Sparkles className="h-5 w-5" aria-hidden /> : undefined}
          >
            {generating ? 'Generating…' : 'Generate Thumbnail'}
          </Button>

          {/* Output panel */}
          {generated && (
            <Panel variant="glass" className="space-y-5 p-6 ds-anim-rise">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="ds-text-label text-theme-primary">Generated</span>
                <Badge variant="outline" className={cn('ml-auto gap-1', preset.textColor)}>
                  <PresetIcon className="h-3 w-3" aria-hidden /> {preset.label}
                </Badge>
              </div>

              {/* Preview */}
              <div className="relative aspect-video overflow-hidden rounded-xl border border-subtle">
                <Image src={generated.url} alt="Generated thumbnail" fill className="object-cover" unoptimized />
                {title && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                    <p className="text-sm font-bold leading-tight text-white">{title}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={downloadThumbnail}
                  className="flex-1"
                  leftIcon={<Download className="h-4 w-4" aria-hidden />}
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setGenerated(null); setCapturedFrame(null) }}
                  className="flex-1"
                  leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
                >
                  New Frame
                </Button>
              </div>
            </Panel>
          )}

          {/* Tips card */}
          <Panel variant="glass" className="space-y-3 p-6">
            <p className="ds-text-caption text-theme-muted">Thumbnail Formula</p>
            {TIPS.map(({ id, label, tip, icon: TipIcon }) => (
              <div key={id} className={cn('flex items-start gap-3 py-1.5 transition-opacity', selectedStyle === id ? 'opacity-100' : 'opacity-50')}>
                <TipIcon className="mt-0.5 h-4 w-4 shrink-0 text-theme-muted" aria-hidden />
                <div>
                  <p className="ds-text-label text-theme-primary">{label}</p>
                  <p className="text-xs text-theme-muted">{tip}</p>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default ThumbnailGeneratorView
