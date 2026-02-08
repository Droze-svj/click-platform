'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Eye, EyeOff } from 'lucide-react'
import { VideoFilter, TextOverlay, CaptionStyle, CAPTION_SIZE_PX, TemplateLayout, TEMPLATE_LAYOUTS, CaptionTextStyle, TextOverlayAnimationIn, TextOverlayAnimationOut, ShapeOverlay, MotionGraphicPreset, ImageOverlay, GradientOverlay } from '../../types/editor'

/** Compute opacity, transform, and optional filter for text overlay animation based on currentTime */
function getTextOverlayAnimationStyle(
  overlay: TextOverlay,
  currentTime: number
): { opacity: number; transform: string; filter?: string } {
  const start = overlay.startTime
  const end = overlay.endTime
  const inDur = Math.max(0.1, overlay.animationInDuration ?? 0.3)
  const outDur = Math.max(0.1, overlay.animationOutDuration ?? 0.3)
  const inEnd = start + inDur
  const outStart = end - outDur
  const animIn = (overlay.animationIn ?? 'none') as TextOverlayAnimationIn
  const animOut = (overlay.animationOut ?? 'none') as TextOverlayAnimationOut

  let filter: string | undefined
  if (currentTime < start || currentTime > end) return { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }
  if (currentTime >= inEnd && currentTime <= outStart) return { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }

  let opacity = 1
  let scale = 1
  let translateX = 0
  let translateY = 0
  let rotateY = 0

  if (currentTime < inEnd && animIn !== 'none') {
    const t = (currentTime - start) / inDur
    const e = 1 - Math.pow(1 - t, 2)
    if (animIn === 'fade' || animIn === 'typewriter') opacity = e
    else if (animIn === 'pop') scale = e
    else if (animIn === 'slide-top') translateY = -30 * (1 - e)
    else if (animIn === 'slide-bottom') translateY = 30 * (1 - e)
    else if (animIn === 'slide-left') translateX = -30 * (1 - e)
    else if (animIn === 'slide-right') translateX = 30 * (1 - e)
    else if (animIn === 'scale-in') scale = e
    else if (animIn === 'bounce') scale = e < 0.9 ? Math.min(1, e * (1 / 0.9) * 1.25) : 1 + ((1 - e) / 0.1) * -0.25
    else if (animIn === 'zoom-in') scale = 0.3 + 0.7 * e
    else if (animIn === 'blur-in') { opacity = e; filter = `blur(${8 * (1 - e)}px)` }
    else if (animIn === 'flip-in') rotateY = 90 * (1 - e)
  } else if (currentTime > outStart && animOut !== 'none') {
    const t = (end - currentTime) / outDur
    const e = 1 - Math.pow(1 - t, 2)
    if (animOut === 'fade') opacity = e
    else if (animOut === 'pop') scale = e
    else if (animOut === 'slide-top') translateY = -30 * (1 - e)
    else if (animOut === 'slide-bottom') translateY = 30 * (1 - e)
    else if (animOut === 'slide-left') translateX = -30 * (1 - e)
    else if (animOut === 'slide-right') translateX = 30 * (1 - e)
    else if (animOut === 'scale-out') scale = e
    else if (animOut === 'bounce-out') scale = e < 0.9 ? 1 + (e * (1 / 0.9) - 1) * 0.25 : e
    else if (animOut === 'zoom-out') scale = 0.3 + 0.7 * e
    else if (animOut === 'flip-out') rotateY = -90 * (1 - e)
  }

  const base = 'translate(-50%, -50%)'
  const tx = translateX ? ` translateX(${translateX}%)` : ''
  const ty = translateY ? ` translateY(${translateY}%)` : ''
  const sc = scale !== 1 ? ` scale(${scale})` : ''
  const ry = rotateY !== 0 ? ` rotateY(${rotateY}deg)` : ''
  return { opacity, transform: `${base}${tx}${ty}${sc}${ry}`, filter }
}

/** Reusable animation style for image (and any overlay with same timing/animation fields) */
function getOverlayAnimationStyle(
  start: number,
  end: number,
  currentTime: number,
  animIn?: TextOverlayAnimationIn,
  animOut?: TextOverlayAnimationOut,
  inDur = 0.3,
  outDur = 0.3
): { opacity: number; transform: string; filter?: string } {
  const inD = Math.max(0.1, inDur)
  const outD = Math.max(0.1, outDur)
  const inEnd = start + inD
  const outStart = end - outD
  const aIn = (animIn ?? 'none') as TextOverlayAnimationIn
  const aOut = (animOut ?? 'none') as TextOverlayAnimationOut
  if (currentTime < start || currentTime > end) return { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }
  if (currentTime >= inEnd && currentTime <= outStart) return { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
  let opacity = 1
  let scale = 1
  let translateX = 0
  let translateY = 0
  if (currentTime < inEnd && aIn !== 'none') {
    const t = (currentTime - start) / inD
    const e = 1 - Math.pow(1 - t, 2)
    if (aIn === 'fade') opacity = e
    else if (aIn === 'pop' || aIn === 'scale-in') scale = e
    else if (aIn === 'slide-top') translateY = -30 * (1 - e)
    else if (aIn === 'slide-bottom') translateY = 30 * (1 - e)
    else if (aIn === 'slide-left') translateX = -30 * (1 - e)
    else if (aIn === 'slide-right') translateX = 30 * (1 - e)
    else if (aIn === 'zoom-in') scale = 0.3 + 0.7 * e
  } else if (currentTime > outStart && aOut !== 'none') {
    const t = (end - currentTime) / outD
    const e = 1 - Math.pow(1 - t, 2)
    if (aOut === 'fade') opacity = e
    else if (aOut === 'pop' || aOut === 'scale-out') scale = e
    else if (aOut === 'slide-top') translateY = -30 * (1 - e)
    else if (aOut === 'slide-bottom') translateY = 30 * (1 - e)
    else if (aOut === 'slide-left') translateX = -30 * (1 - e)
    else if (aOut === 'slide-right') translateX = 30 * (1 - e)
    else if (aOut === 'zoom-out') scale = 0.3 + 0.7 * e
  }
  const base = 'translate(-50%, -50%)'
  const tx = translateX ? ` translateX(${translateX}%)` : ''
  const ty = translateY ? ` translateY(${translateY}%)` : ''
  const sc = scale !== 1 ? ` scale(${scale})` : ''
  return { opacity, transform: `${base}${tx}${ty}${sc}` }
}

import { getMatchingEmojiForChunk } from '../../utils/captionEmojiMap'

export interface TranscriptWord {
  word: string
  start: number
  end: number
}

interface RealTimeVideoPreviewProps {
  videoUrl: string
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
  playbackSpeed: number
  filters: VideoFilter
  textOverlays: TextOverlay[]
  shapeOverlays?: ShapeOverlay[]
  imageOverlays?: ImageOverlay[]
  gradientOverlays?: GradientOverlay[]
  editingWords?: TranscriptWord[]
  captionStyle?: CaptionStyle | null
  templateLayout?: TemplateLayout
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
  onPlayPause: () => void
  /** When provided, control before/after from parent (e.g. Manual Edit Compare) */
  showBeforeAfter?: boolean
  onBeforeAfterChange?: (showFiltered: boolean) => void
  /** When provided, use for compare: after = filtered, before = original, split = side-by-side */
  compareMode?: 'after' | 'before' | 'split'
}

const RealTimeVideoPreview: React.FC<RealTimeVideoPreviewProps> = ({
  videoUrl, currentTime, isPlaying, volume, isMuted, playbackSpeed = 1, filters, textOverlays, shapeOverlays = [], imageOverlays = [], gradientOverlays = [], editingWords = [], captionStyle, templateLayout = 'standard', onTimeUpdate, onDurationChange, onPlayPause, showBeforeAfter, onBeforeAfterChange, compareMode
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoRefRight = useRef<HTMLVideoElement>(null)
  const [internalShowFilters, setInternalShowFilters] = useState(true)
  const [videoDimensions, setVideoDimensions] = useState<{ w: number; h: number } | null>(null)
  const useCompareMode = typeof compareMode === 'string'
  const isSplit = useCompareMode && compareMode === 'split'
  const showAppliedFilters = useCompareMode ? (compareMode === 'after') : (typeof showBeforeAfter === 'boolean' ? showBeforeAfter : internalShowFilters)
  const handleBeforeAfterToggle = () => {
    const next = !showAppliedFilters
    if (onBeforeAfterChange) onBeforeAfterChange(next)
    else setInternalShowFilters(next)
  }

  useEffect(() => {
    if (!isSplit || !videoRefRight.current || !videoRef.current) return
    const right = videoRefRight.current
    const left = videoRef.current
    if (Math.abs(right.currentTime - currentTime) > 0.2) right.currentTime = currentTime
  }, [currentTime, isSplit])

  const layoutSpec = (() => {
    const t = TEMPLATE_LAYOUTS.find((l) => l.id === templateLayout) ?? TEMPLATE_LAYOUTS[1]
    if (templateLayout === 'auto' && videoDimensions && videoDimensions.w > 0 && videoDimensions.h > 0) {
      return { ...t, aspect: `${videoDimensions.w}/${videoDimensions.h}` }
    }
    return t
  })()

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) v.play().catch(() => { })
    else v.pause()
  }, [isPlaying])

  useEffect(() => {
    if (!isSplit) return
    const right = videoRefRight.current
    if (!right) return
    if (isPlaying) right.play().catch(() => { })
    else right.pause()
  }, [isSplit, isPlaying])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = isMuted
  }, [volume, isMuted])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = Math.max(0.25, Math.min(4, playbackSpeed || 1))
  }, [playbackSpeed])

  /* Full filter chain: brightness, contrast, saturation, hue, sepia, blur, temperature, highlights, shadows, sharpen, clarity (approx) */
  const temp = filters.temperature ?? 100
  const sepiaAdj = Math.max(0, Math.min(100, (filters.sepia ?? 0) + ((temp - 100) / 100) * 15))
  const hueAdj = (filters.hue ?? 0) + (temp < 100 ? 8 : temp > 100 ? -4 : 0)
  const sat = filters.vibrance != null ? Math.round((filters.saturation ?? 100) * (filters.vibrance / 100)) : (filters.saturation ?? 100)
  const bright = filters.brightness ?? 100
  const shadowLift = (filters.shadows ?? 100) - 100  // >0 = lift shadows
  const highCrush = 100 - (filters.highlights ?? 100) // >0 = darken highlights
  const dehazeAdj = ((filters.dehaze ?? 100) - 100) / 100 * 0.04  // dehaze ≈ contrast/clarity boost
  const brightnessAdj = bright + shadowLift * 0.2 + highCrush * 0.15
  const contrastBase = filters.contrast ?? 100
  const sharpenAdj = (filters.sharpen ?? 0) / 100
  const clarityAdj = ((filters.clarity ?? 0) / 100) * 0.06
  const contrastAdj = Math.min(200, Math.max(50, contrastBase + sharpenAdj * 8 + clarityAdj * 100 + dehazeAdj * 100))
  const lutId = filters.lutId
  const lutBoost = showAppliedFilters && lutId && lutId !== 'none'
    ? (lutId === 'cinematic' ? { contrast: 1.08, saturate: 0.95 } : lutId === 'bleach' ? { contrast: 1.12, saturate: 0.7 } : lutId === 'log709' ? { contrast: 1.05, brightness: 1.02 } : {})
    : {}
  const finalContrast = lutBoost.contrast ? contrastAdj * lutBoost.contrast : contrastAdj
  const finalSat = lutBoost.saturate != null ? sat * lutBoost.saturate : sat
  const finalBright = lutBoost.brightness ? brightnessAdj * lutBoost.brightness : brightnessAdj

  const filterString = showAppliedFilters ? `
    brightness(${Math.min(150, Math.max(50, finalBright))}%)
    contrast(${finalContrast}%)
    saturate(${Math.min(200, Math.max(0, finalSat))}%)
    hue-rotate(${hueAdj}deg)
    sepia(${sepiaAdj}%)
    blur(${filters.blur ?? 0}px)
  ` : 'none'

  const vignetteOpacity = showAppliedFilters && (filters.vignette ?? 0) > 0
    ? (filters.vignette / 100) * 0.6
    : 0

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget
    onDurationChange(v.duration)
    if (v.videoWidth > 0 && v.videoHeight > 0) {
      setVideoDimensions({ w: v.videoWidth, h: v.videoHeight })
    }
  }

  const singleVideo = (
    <video
      ref={videoRef}
      src={videoUrl}
      className="max-w-full max-h-full object-contain transition-all duration-700 ease-in-out"
      style={{ filter: filterString }}
      onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
      onLoadedMetadata={handleLoadedMetadata}
      onClick={onPlayPause}
    />
  )

  if (isSplit) {
    return (
      <div className="w-full max-w-full flex flex-col items-center" style={{ aspectRatio: layoutSpec.aspect }}>
        <div className="relative w-full h-full min-h-0 bg-black rounded-3xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex border border-white/10 group">
          <div className="flex-1 relative flex flex-col items-center justify-center border-r border-white/10">
            <span className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/50 px-2 py-1 rounded">Before</span>
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-full object-contain w-full h-full"
              style={{ filter: 'none' }}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={onPlayPause}
            />
          </div>
          <div className="flex-1 relative flex flex-col items-center justify-center">
            <span className="absolute top-2 right-2 z-10 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/50 px-2 py-1 rounded">After</span>
            <video
              ref={videoRefRight}
              src={videoUrl}
              className="max-w-full max-h-full object-contain w-full h-full"
              style={{ filter: filterString }}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={onPlayPause}
            />
            {vignetteOpacity > 0 && (
              <div
                className="absolute inset-0 pointer-events-none rounded-r-3xl"
                style={{
                  background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`
                }}
              />
            )}
            {textOverlays
              .filter((o) => {
                if (o.startTime == null || o.endTime == null) return true
                return currentTime >= o.startTime && currentTime <= o.endTime
              })
              .map((overlay) => {
                const s = overlay.style ?? 'none'
                const baseShadow = '0 2px 10px rgba(0,0,0,0.5)'
                const overlayShadows: Record<string, string> = {
                  none: baseShadow,
                  shadow: '0 4px 16px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.5)',
                  outline: 'none',
                  neon: `0 0 10px ${overlay.color}, 0 0 20px ${overlay.color}, 0 0 30px rgba(0,0,0,0.8)`,
                  minimal: '0 1px 3px rgba(0,0,0,0.4)',
                  'bold-kinetic': '0 3px 12px rgba(0,0,0,0.6)',
                }
                const stroke = s === 'outline' ? `1.5px ${overlay.shadowColor ?? overlay.outlineColor ?? '#fff'}` : undefined
                const animStyle = getTextOverlayAnimationStyle(overlay, currentTime)
                const inDur = Math.max(0.1, overlay.animationInDuration ?? 0.3)
                const outDur = Math.max(0.1, overlay.animationOutDuration ?? 0.3)
                const inEnd = overlay.startTime + inDur
                const outStart = overlay.endTime - outDur
                const inVisibleRest = currentTime >= inEnd && currentTime <= outStart
                const motionPreset = (overlay.motionGraphic ?? 'none') as MotionGraphicPreset
                const motionClass = motionPreset !== 'none' && inVisibleRest ? `motion-graphic-${motionPreset}` : ''
                return (
                  <div
                    key={overlay.id}
                    className={`absolute pointer-events-none select-none text-center transition-opacity duration-75 ${motionClass}`.trim()}
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      fontSize: `${overlay.fontSize}px`,
                      color: s === 'outline' ? 'transparent' : overlay.color,
                      fontFamily: overlay.fontFamily,
                      transform: animStyle.transform,
                      opacity: animStyle.opacity,
                      filter: animStyle.filter,
                      textShadow: overlayShadows[s] ?? baseShadow,
                      WebkitTextStroke: stroke,
                      fontWeight: s === 'bold-kinetic' ? 800 : undefined,
                      letterSpacing: overlay.letterSpacing != null ? `${overlay.letterSpacing}px` : undefined,
                      lineHeight: overlay.lineHeight,
                      backgroundColor: overlay.backgroundColor,
                      padding: overlay.backgroundColor ? '4px 8px' : undefined,
                      borderRadius: overlay.backgroundColor ? 6 : undefined,
                    }}
                  >
                    {overlay.text}
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full flex flex-col items-center" style={{ aspectRatio: layoutSpec.aspect }}>
      <div className="relative w-full h-full min-h-0 bg-black rounded-3xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border border-white/10 group">
        {singleVideo}

        {/* Vignette overlay – darkens edges for film look */}
        {vignetteOpacity > 0 && (
          <div
            className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`
            }}
          />
        )}

        {/* Audio Waveform Simulation Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none overflow-hidden opacity-40">
          <div className="flex items-end gap-[1px] h-full px-4 w-fit animate-pulse">
            {Array.from({ length: 120 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500/50 rounded-full"
                style={{ height: `${Math.random() * 80 + 20}%`, transition: 'height 0.2s ease-in-out' }}
              />
            ))}
          </div>
        </div>

        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button
            onClick={handleBeforeAfterToggle}
            className={`p-2 rounded-xl backdrop-blur-xl border transition-all ${showAppliedFilters ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}
            title="Toggle Filters (Before/After)"
          >
            {showAppliedFilters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-black/40 backdrop-blur-2xl rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
          <button onClick={onPlayPause} className="text-white hover:text-blue-400 transition-colors">
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
          </button>
          <div className="w-[1px] h-4 bg-white/20" />
          <div className="text-[10px] font-black font-mono text-white/60 tracking-widest uppercase">Elite V3 Engine</div>
        </div>

        {textOverlays
          .filter((o) => {
            if (o.startTime == null || o.endTime == null) return true
            return currentTime >= o.startTime && currentTime <= o.endTime
          })
          .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
          .map((overlay) => {
            const s = overlay.style ?? 'none'
            const baseShadow = '0 2px 10px rgba(0,0,0,0.5)'
            const overlayShadows: Record<string, string> = {
              none: baseShadow,
              shadow: '0 4px 16px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.5)',
              outline: 'none',
              neon: `0 0 10px ${overlay.color}, 0 0 20px ${overlay.color}, 0 0 30px rgba(0,0,0,0.8)`,
              minimal: '0 1px 3px rgba(0,0,0,0.4)',
              'bold-kinetic': '0 3px 12px rgba(0,0,0,0.6)',
            }
            const stroke = s === 'outline' ? `1.5px ${overlay.shadowColor ?? overlay.outlineColor ?? '#fff'}` : undefined
            const animStyle = getTextOverlayAnimationStyle(overlay, currentTime)
            const inDur = Math.max(0.1, overlay.animationInDuration ?? 0.3)
            const outDur = Math.max(0.1, overlay.animationOutDuration ?? 0.3)
            const inEnd = overlay.startTime + inDur
            const outStart = overlay.endTime - outDur
            const inVisibleRest = currentTime >= inEnd && currentTime <= outStart
            const motionPreset = (overlay.motionGraphic ?? 'none') as MotionGraphicPreset
            const motionClass = motionPreset !== 'none' && inVisibleRest ? `motion-graphic-${motionPreset}` : ''
            return (
              <div
                key={overlay.id}
                className={`absolute pointer-events-none select-none text-center transition-opacity duration-75 ${motionClass}`.trim()}
                style={{
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  fontSize: `${overlay.fontSize}px`,
                  color: s === 'outline' ? 'transparent' : overlay.color,
                  fontFamily: overlay.fontFamily,
                  transform: animStyle.transform,
                  opacity: animStyle.opacity,
                  filter: animStyle.filter,
                  textShadow: overlayShadows[s] ?? baseShadow,
                  WebkitTextStroke: stroke,
                  fontWeight: s === 'bold-kinetic' ? 800 : undefined,
                  letterSpacing: overlay.letterSpacing != null ? `${overlay.letterSpacing}px` : undefined,
                  lineHeight: overlay.lineHeight,
                  backgroundColor: overlay.backgroundColor,
                  padding: overlay.backgroundColor ? '4px 8px' : undefined,
                  borderRadius: overlay.backgroundColor ? 6 : undefined,
                }}
              >
                {overlay.text}
              </div>
            )
          })}

        {/* Gradient overlays */}
        {gradientOverlays
          .filter((g) => currentTime >= g.startTime && currentTime <= g.endTime)
          .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
          .map((g) => {
            const [c0, c1] = g.colorStops
            const dir = g.direction === 'top-to-bottom' ? '180deg' : g.direction === 'bottom-to-top' ? '0deg' : g.direction === 'left-to-right' ? '90deg' : g.direction === 'right-to-left' ? '270deg' : ''
            const isRadial = g.direction === 'radial'
            const region = g.region ?? 'full'
            const regionStyle: React.CSSProperties = region === 'full' ? { inset: 0 } : region === 'lower-third' ? { bottom: 0, left: 0, right: 0, height: '33%' } : region === 'top-bar' ? { top: 0, left: 0, right: 0, height: '20%' } : region === 'top-half' ? { top: 0, left: 0, right: 0, height: '50%' } : { bottom: 0, left: 0, right: 0, height: '50%' }
            return (
              <div
                key={g.id}
                className="absolute pointer-events-none"
                style={{
                  ...regionStyle,
                  background: isRadial ? `radial-gradient(circle at center, ${c0}, ${c1})` : `linear-gradient(${dir}, ${c0}, ${c1})`,
                  opacity: g.opacity,
                  zIndex: 1,
                }}
              />
            )
          })}

        {/* Shape overlays – rect, circle, line */}
        {shapeOverlays
          .filter((sh) => currentTime >= sh.startTime && currentTime <= sh.endTime)
          .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
          .map((sh) => {
            const shapeMotion = (sh.motionGraphic ?? 'none') as MotionGraphicPreset
            const shapeMotionClass = shapeMotion !== 'none' ? `motion-graphic-${shapeMotion}` : ''
            return (
              <div
                key={sh.id}
                className={`absolute pointer-events-none ${shapeMotionClass}`.trim()}
                style={{
                  left: `${sh.x}%`,
                  top: `${sh.y}%`,
                  width: `${sh.width}%`,
                  height: sh.kind === 'line' ? `${sh.strokeWidth ?? 2}px` : `${sh.height}%`,
                  backgroundColor: sh.color,
                  opacity: sh.opacity,
                  borderRadius: sh.kind === 'circle' ? '50%' : 0,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )
          })}

        {/* Image overlays – logo, watermark, sticker */}
        {imageOverlays
          .filter((img) => currentTime >= img.startTime && currentTime <= img.endTime)
          .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
          .map((img) => {
            const anim = getOverlayAnimationStyle(
              img.startTime,
              img.endTime,
              currentTime,
              img.animationIn,
              img.animationOut,
              img.animationInDuration ?? 0.3,
              img.animationOutDuration ?? 0.3
            )
            return (
              <div
                key={img.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${img.x}%`,
                  top: `${img.y}%`,
                  width: `${img.width}%`,
                  height: `${img.height}%`,
                  transform: anim.transform,
                  opacity: anim.opacity * img.opacity,
                  zIndex: 2,
                }}
              >
                <img
                  src={img.url}
                  alt=""
                  className="w-full h-full object-contain"
                  style={{
                    borderRadius: img.borderRadius ?? 0,
                  }}
                  crossOrigin="anonymous"
                />
              </div>
            )
          })}

        {/* Transcript captions – word-level, synced to video dialogue */}
        {captionStyle?.enabled && editingWords.length > 0 && (() => {
          const words = editingWords as TranscriptWord[]
          const firstStart = words[0]?.start ?? 0
          const activeIdx = words.findIndex((w) => currentTime >= w.start && currentTime <= w.end)
          const windowSize = 8
          let start: number
          if (activeIdx >= 0) {
            start = Math.max(0, Math.min(activeIdx - 2, words.length - windowSize))
          } else if (currentTime < firstStart) {
            start = 0
          } else {
            start = Math.max(0, words.length - windowSize)
          }
          const chunk = words.slice(start, start + windowSize)
          const activeWord = activeIdx >= 0 ? words[activeIdx] : null
          const emoji = (captionStyle.emojisEnabled && getMatchingEmojiForChunk(chunk, activeWord)) || null
          const fontSize = CAPTION_SIZE_PX[captionStyle.size]
          const fontFamily = captionStyle.font || 'Inter, sans-serif'
          const ts: CaptionTextStyle = captionStyle.textStyle ?? 'default'

          const layoutStyles: Record<string, React.CSSProperties> = {
            'bottom-center': {
              bottom: '10%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'auto',
              maxWidth: '90%',
              textAlign: 'center',
              justifyContent: 'center'
            },
            'lower-third': {
              bottom: '20%',
              left: '6%',
              right: 'auto',
              width: '60%',
              maxWidth: '70%',
              textAlign: 'left',
              justifyContent: 'flex-start'
            },
            'top-center': {
              top: '8%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'auto',
              maxWidth: '90%',
              textAlign: 'center',
              justifyContent: 'center'
            },
            'full-width-bottom': {
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              padding: '12px 16px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
              textAlign: 'center',
              justifyContent: 'center'
            }
          }
          const pos = layoutStyles[captionStyle.layout] || layoutStyles['bottom-center']

          const baseShadow = '0 2px 8px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,1)'
          const shadowStrong = '0 4px 12px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.9)'
          const neonShadow = '0 0 8px #fff, 0 0 16px #0ef, 0 0 24px #0ef'
          const minimalShadow = '0 1px 2px rgba(0,0,0,0.6)'
          const highContrastStroke = '2px #000'
          const captionColor = ts === 'outline' || ts === 'subtitle' ? 'transparent' : ts === 'cinematic' ? '#f5f0e6' : ts === 'retro' ? '#f0e6d2' : '#fff'
          const captionStroke = ts === 'outline' || ts === 'subtitle' ? '1.5px #fff' : ts === 'high-contrast' ? highContrastStroke : undefined
          const captionShadow = ts === 'outline' || ts === 'subtitle' ? 'none' : ts === 'shadow' ? shadowStrong : ts === 'neon' ? neonShadow : ts === 'minimal' ? minimalShadow : ts === 'high-contrast' ? 'none' : baseShadow
          const captionFont = (ts === 'cinematic' || ts === 'serif') ? 'Georgia, "Times New Roman", serif' : fontFamily

          return (
            <div
              className="absolute flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-4 pointer-events-none select-none"
              style={{
                ...pos,
                fontFamily: captionFont,
                fontSize: `${fontSize}px`,
                color: captionColor,
                textShadow: captionShadow,
                lineHeight: 1.3,
                WebkitTextStroke: captionStroke
              }}
            >
              {emoji && (
                <span className="shrink-0" style={{ fontSize: `${Math.round(fontSize * 1.1)}px`, lineHeight: 1, opacity: 0.95 }} aria-hidden="true">
                  {emoji}
                </span>
              )}
              {chunk.map((w) => {
                const isActive = words.indexOf(w) === activeIdx
                const isPast = currentTime > w.end
                const isFuture = currentTime < w.start
                const dimmed = activeIdx < 0 && (currentTime < firstStart ? isFuture : isPast)
                const opacity = dimmed ? 0.4 : isActive ? 1 : 0.7
                const fontWeight = ts === 'bold' || ts === 'kinetic' || ts === 'karaoke' ? (isActive && ts === 'kinetic' ? 800 : 700) : isActive ? 700 : 400
                const scale = ts === 'kinetic' && isActive ? 1.15 : 1
                const transform = `scale(${scale})`
                const pill = ts === 'pill'
                return (
                  <span
                    key={`${w.word}-${w.start}-${w.end}`}
                    style={{
                      fontWeight,
                      opacity,
                      transition: 'opacity 0.1s ease, font-weight 0.1s ease, transform 0.12s ease',
                      transform,
                      textTransform: ts === 'uppercase' ? 'uppercase' : undefined,
                      backgroundColor: pill ? 'rgba(0,0,0,0.75)' : undefined,
                      borderRadius: pill ? 9999 : undefined,
                      padding: pill ? '2px 8px' : undefined,
                      margin: pill ? '0 2px' : undefined
                    }}
                  >
                    {w.word}
                  </span>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default RealTimeVideoPreview
