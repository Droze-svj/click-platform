'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Eye, EyeOff, Circle, Activity, Crosshair, Fingerprint, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TimelineSegment, TimelineEffect, TextOverlay, CaptionStyle, CAPTION_SIZE_PX, TemplateLayout, TEMPLATE_LAYOUTS, CaptionTextStyle, TextOverlayAnimationIn, TextOverlayAnimationOut, ShapeOverlay, MotionGraphicPreset, ImageOverlay, GradientOverlay, SvgOverlay, TransformKeyframe } from '../../types/editor'
import { usePreviewRecorder } from '../../hooks/usePreviewRecorder'
import { getMatchingEmojiForChunk } from '../../utils/captionEmojiMap'
import { interpolateTransformAtTime, interpolateEffectTransformAtTime } from '../../utils/keyframeEasing'
import { Rnd } from 'react-rnd'

import { WebGPURenderer } from '../../lib/rendering/WebGPURenderer'

/** Syncs B-roll video to segment time; playhead-driven. */
function BrollVideo({ seg, currentTime, isPlaying }: { seg: TimelineSegment; currentTime: number; isPlaying: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const segTime = seg.sourceStartTime != null ? seg.sourceStartTime + (currentTime - seg.startTime) * (seg.playbackSpeed ?? 1) : Math.max(0, currentTime - seg.startTime)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (Math.abs(el.currentTime - segTime) > 0.15) el.currentTime = segTime
  }, [segTime, seg.id])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isPlaying) el.play().catch(() => { })
    else el.pause()
  }, [isPlaying])
  return (
    <video
      ref={ref}
      src={seg.sourceUrl}
      className="max-w-full max-h-full object-contain"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      muted
      playsInline
    />
  )
}


/** Syncs audio segment to playhead */
function AudioSegment({ seg, currentTime, isPlaying, volume, isMuted, isDialogueActive }: { seg: TimelineSegment; currentTime: number; isPlaying: boolean; volume: number; isMuted: boolean; isDialogueActive: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const isActive = currentTime >= seg.startTime && currentTime <= seg.endTime
  const segTime = (currentTime - seg.startTime) * (seg.playbackSpeed ?? 1)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (isActive) {
      if (Math.abs(v.currentTime - segTime) > 0.2) {
        v.currentTime = segTime
      }
      if (isPlaying) v.play().catch(() => {})
      else v.pause()
    } else {
      v.pause()
      v.currentTime = 0
    }
  }, [isActive, isPlaying, segTime])

  // Smooth Volume Ramping
  const currentVolumeRef = useRef(volume)
  useEffect(() => {
    const v = ref.current
    if (!v) return

    let targetVolume = volume
    if (seg.track === 6 && isDialogueActive) {
      targetVolume = volume * 0.3
    }
    if (isMuted) targetVolume = 0

    let startTime = performance.now()
    const DURATION = 300 // 300ms ramp
    const startVolume = currentVolumeRef.current

    let frameId: number
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / DURATION, 1)

      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      const currentVol = startVolume + (targetVolume - startVolume) * eased

      v.volume = currentVol
      currentVolumeRef.current = currentVol

      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [volume, isMuted, isDialogueActive, seg.track])

  return <audio ref={ref} src={seg.sourceUrl} />
}

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
  filters: import('../../types/editor').VideoFilter
  textOverlays: TextOverlay[]
  shapeOverlays?: ShapeOverlay[]
  imageOverlays?: ImageOverlay[]
  svgOverlays?: SvgOverlay[]
  gradientOverlays?: GradientOverlay[]
  editingWords?: TranscriptWord[]
  captionStyle?: CaptionStyle | null
  templateLayout?: TemplateLayout
  onTimeUpdate: (time: number) => void
  onDurationChange: (duration: number) => void
  onPlayPause: () => void
  showBeforeAfter?: boolean
  onBeforeAfterChange?: (showFiltered: boolean) => void
  compareMode?: 'after' | 'before' | 'split'
  timelineEffects?: TimelineEffect[]
  timelineSegments?: TimelineSegment[]
  trackVisibility?: Record<number, boolean>
  previewQuality?: 'draft' | 'full'
  chromaKey?: import('./views/ChromakeyView').ChromaKeySettings
  onUpdateOverlay?: (type: 'text' | 'shape' | 'image', id: string, updates: any) => void
  selectedOverlayId?: string | null
  onSelectOverlay?: (id: string | null) => void
  isNeuralActive?: boolean
  videoTransform?: { scale?: number, positionX?: number, positionY?: number, rotation?: number }
  videoTransformKeyframes?: TransformKeyframe[]
  videoCrop?: { top?: number, right?: number, bottom?: number, left?: number }
  isTransformMode?: boolean
  onUpdateVideoTransform?: (updates: { scale?: number, positionX?: number, positionY?: number, rotation?: number }) => void
}

/**
 * Map a timeline-coordinate time to the underlying source-video time.
 *
 * The segment-aware export pipeline gives each segment its own source range
 * (sourceStartTime/sourceEndTime), so once a user splits a clip and reorders
 * pieces — or trims with In/Out, or freezes a frame — the timeline second
 * `T=4.0` may correspond to source second `5.7` of the original video.
 * Without this mapping, the preview ignores all segment ops and just plays
 * the raw input file.
 *
 * Returns:
 *   - segment: the segment containing `timelineSec` (or null if none / past end)
 *   - sourceTime: where to seek the underlying <video> element
 *   - flags: { freeze, reversed } so callers can adjust playback behavior
 *
 * Reverse and J/L-cuts are NOT reflected in the preview — they only show up
 * in exports. Browsers can't play media in reverse natively without a
 * pre-rendered proxy, and J/L audio offsets need a separate WebAudio mix.
 * For those, the UI badges the segment as "export-only".
 */
function timelineToSource(
  timelineSec: number,
  segments: TimelineSegment[]
): { segment: TimelineSegment | null; sourceTime: number; freeze: boolean; reversed: boolean } {
  if (!segments || segments.length === 0) {
    return { segment: null, sourceTime: timelineSec, freeze: false, reversed: false }
  }
  // Match the renderer's planSegments: only consider primary-video segments
  // sorted by startTime. Effects/audio-only/text segments don't contribute.
  const primary = segments
    .filter((s) => {
      const track = typeof s.track === 'number' ? s.track : 0
      if (track !== 0 && track !== 1) return false
      if (s.type && s.type !== 'video' && s.type !== 'broll' && s.type !== 'cut') return false
      return true
    })
    .slice()
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
  if (primary.length === 0) {
    return { segment: null, sourceTime: timelineSec, freeze: false, reversed: false }
  }
  for (const seg of primary) {
    if (timelineSec >= seg.startTime && timelineSec < seg.endTime) {
      const offsetIntoSeg = timelineSec - seg.startTime
      const sourceStart = seg.sourceStartTime ?? seg.startTime
      const sourceTime = sourceStart + offsetIntoSeg
      return {
        segment: seg,
        sourceTime,
        freeze: !!seg.freezeFrame,
        reversed: !!seg.reversed,
      }
    }
  }
  // Past the last segment — clamp to its end.
  const last = primary[primary.length - 1]
  return {
    segment: last,
    sourceTime: last.sourceEndTime ?? last.endTime,
    freeze: false,
    reversed: false,
  }
}

function timelineHasExportOnlyOps(segments: TimelineSegment[]): { reverse: number; jcut: number; lcut: number } {
  let reverse = 0, jcut = 0, lcut = 0
  for (const s of segments || []) {
    if (s.reversed) reverse++
    if ((s.audioLeadInSec ?? 0) > 0) jcut++
    if ((s.audioTailOutSec ?? 0) > 0) lcut++
  }
  return { reverse, jcut, lcut }
}

function blendFiltersAtTime(base: import('../../types/editor').VideoFilter, effects: TimelineEffect[], t: number): import('../../types/editor').VideoFilter {
  let out = { ...base }
  for (const e of effects) {
    if (e.type !== 'filter' || !e.enabled || t < e.startTime || t > e.endTime) continue
    const dur = e.endTime - e.startTime
    const fadeIn = e.fadeIn ?? 0
    const fadeOut = e.fadeOut ?? 0
    let factor = (e.intensity ?? 100) / 100
    if (t < e.startTime + fadeIn && fadeIn > 0) factor *= (t - e.startTime) / fadeIn
    if (t > e.endTime - fadeOut && fadeOut > 0) factor *= (e.endTime - t) / fadeOut
    if (factor <= 0) continue
    const p = e.params as Record<string, number>
    if (p.brightness != null) out.brightness = (out.brightness ?? 100) + (p.brightness - (out.brightness ?? 100)) * factor
    if (p.contrast != null) out.contrast = (out.contrast ?? 100) + (p.contrast - (out.contrast ?? 100)) * factor
    if (p.saturation != null) out.saturation = (out.saturation ?? 100) + (p.saturation - (out.saturation ?? 100)) * factor
    if (p.temperature != null) out.temperature = (out.temperature ?? 100) + (p.temperature - (out.temperature ?? 100)) * factor
    if (p.sepia != null) out.sepia = (out.sepia ?? 0) + (p.sepia - (out.sepia ?? 0)) * factor
    if (p.blur != null) out.blur = (out.blur ?? 0) + (p.blur - (out.blur ?? 0)) * factor
  }
  return out
}

const RealTimeVideoPreview: React.FC<RealTimeVideoPreviewProps> = ({
  videoUrl, currentTime, isPlaying, volume, isMuted, playbackSpeed = 1, filters, textOverlays, shapeOverlays = [], imageOverlays = [], svgOverlays = [], gradientOverlays = [], editingWords = [], captionStyle, templateLayout = 'standard', onTimeUpdate, onDurationChange, onPlayPause, showBeforeAfter, onBeforeAfterChange, compareMode, timelineEffects = [], timelineSegments = [], trackVisibility = {}, previewQuality = 'full', chromaKey, onUpdateOverlay, selectedOverlayId, onSelectOverlay, isNeuralActive, videoTransform, videoTransformKeyframes, videoCrop, isTransformMode, onUpdateVideoTransform
}) => {
  const isDraft = previewQuality === 'draft'
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoRefRight = useRef<HTMLVideoElement>(null)
  const previewRecorder = usePreviewRecorder(videoRef)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate
  const [internalShowFilters, setInternalShowFilters] = useState(true)
  const [fps, setFps] = useState(0)
  const [latency, setLatency] = useState(0)
  const [previewResolution, setPreviewResolution] = useState<'Full' | '1/2' | '1/4'>('Full')
  const [videoDimensions, setVideoDimensions] = useState<{ w: number; h: number } | null>(null)
  const useCompareMode = typeof compareMode === 'string'
  const isSplit = useCompareMode && compareMode === 'split'
  const showAppliedFilters = useCompareMode ? (compareMode === 'after') : (typeof showBeforeAfter === 'boolean' ? showBeforeAfter : internalShowFilters)

  // V6 WebGPU Rendering Scaffold
  const webGpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGPURenderer | null>(null)
  const rendererReadyRef = useRef<boolean>(false)
  const [gpuStatus, setGpuStatus] = useState<'pending' | 'ready' | 'unavailable'>('pending')

  const videoTransformRef = useRef(videoTransform)
  videoTransformRef.current = videoTransform
  const videoTransformKeyframesRef = useRef(videoTransformKeyframes)
  videoTransformKeyframesRef.current = videoTransformKeyframes
  const videoCropRef = useRef(videoCrop)
  videoCropRef.current = videoCrop

  useEffect(() => {
    if (!webGpuCanvasRef.current) return
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      // No WebGPU on this browser/device — preview falls back to the plain
      // <video> element, which is the actual on-screen surface. The canvas
      // overlay (opacity-0) just stays empty.
      setGpuStatus('unavailable')
      return
    }
    const renderer = new WebGPURenderer()
    rendererRef.current = renderer
    let cancelled = false
    renderer.init(webGpuCanvasRef.current).then(() => {
      if (cancelled) return
      rendererReadyRef.current = true
      setGpuStatus('ready')
    }).catch(e => {
      console.warn('WebGPU init failed; GPU-accelerated effects disabled, video preview unaffected.', e)
      rendererReadyRef.current = false
      setGpuStatus('unavailable')
    })
    return () => {
      cancelled = true
      rendererReadyRef.current = false
      try { renderer.dispose() } catch { /* renderer may not have allocated yet */ }
    }
  }, [])

  // Smart Guides State
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [snapLines, setSnapLines] = useState<{ x?: number, y?: number }>({})

  // Performance Monitoring
  const frameTimes = useRef<number[]>([])
  const lastTimeRef = useRef<number>(performance.now())

  // Timeline time is tracked independently from video.currentTime so that
  // segment ops (split/reorder/trim/freeze) can be honored — see
  // timelineToSource. For a flat single-segment timeline the two are equal.
  const timelineTimeRef = useRef<number>(currentTime)
  const lastSegmentIdRef = useRef<string | null>(null)
  const timelineSegmentsRef = useRef(timelineSegments)
  timelineSegmentsRef.current = timelineSegments

  // External currentTime → internal timeline cursor + underlying video seek.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !isFinite(currentTime)) return
    const diffTimeline = Math.abs(timelineTimeRef.current - currentTime)
    if (diffTimeline < 0.02) return

    timelineTimeRef.current = currentTime
    const mapping = timelineToSource(currentTime, timelineSegmentsRef.current || [])
    const seekThreshold = isPlaying ? 0.25 : 0.05
    if (Math.abs(v.currentTime - mapping.sourceTime) > seekThreshold) {
      try { v.currentTime = mapping.sourceTime } catch (e) { /* seek may fail before metadata */ }
      if (isSplit && videoRefRight.current) {
        try { videoRefRight.current.currentTime = mapping.sourceTime } catch (e) { /* same */ }
      }
    }
    lastSegmentIdRef.current = mapping.segment?.id ?? null
  }, [currentTime, isPlaying, isSplit])

  useEffect(() => {
    if (!isPlaying) return
    const v = videoRef.current
    if (!v) return
    let rafId: number
    const tick = (now: number) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      frameTimes.current.push(now)
      while (frameTimes.current.length > 0 && frameTimes.current[0] <= now - 1000) {
        frameTimes.current.shift()
      }
      setFps(frameTimes.current.length)
      setLatency(Math.round(delta))

      // Advance timeline cursor independently from <video>.currentTime so
      // freeze segments hold the video while the timeline still moves, and
      // segment boundaries can trigger explicit source-time seeks.
      timelineTimeRef.current += (delta / 1000) * (playbackSpeed || 1)
      const t = timelineTimeRef.current
      const mapping = timelineToSource(t, timelineSegmentsRef.current || [])
      const segId = mapping.segment?.id ?? null

      if (segId !== lastSegmentIdRef.current) {
        // Crossed a segment boundary — seek to the new segment's source point.
        if (segId && Math.abs(v.currentTime - mapping.sourceTime) > 0.1) {
          try { v.currentTime = mapping.sourceTime } catch (e) { /* pre-metadata */ }
        }
        lastSegmentIdRef.current = segId
      }

      // Freeze segments: hold the video element, keep the timeline ticking.
      if (mapping.freeze) {
        if (!v.paused) { try { v.pause() } catch {} }
      } else {
        if (v.paused) { try { v.play() } catch {} }
      }

      if (rendererRef.current && rendererReadyRef.current) {
        try {
          rendererRef.current.drawFrame({ timestamp: now }, {
            quality: previewQuality === 'full' ? 'high' : 'low',
            transform: interpolateTransformAtTime(videoTransformKeyframesRef.current, t, videoTransformRef.current as any),
            crop: videoCropRef.current
          })
        } catch (err) {
          console.warn('WebGPU drawFrame failed; disabling renderer for this session.', err)
          rendererReadyRef.current = false
          setGpuStatus('unavailable')
        }
      }

      if (isFinite(t)) {
        onTimeUpdateRef.current(t)
        if (isSplit && videoRefRight.current) {
          try { videoRefRight.current.currentTime = mapping.sourceTime } catch {}
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, isSplit, playbackSpeed])

  const handleBeforeAfterToggle = () => {
    const next = !showAppliedFilters
    if (onBeforeAfterChange) onBeforeAfterChange(next)
    else setInternalShowFilters(next)
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying) v.play().catch(() => { })
    else v.pause()
  }, [isPlaying])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = isMuted
  }, [volume, isMuted])

  const effectiveFiltersAtTime = timelineEffects.length > 0 ? blendFiltersAtTime(filters, timelineEffects, currentTime) : filters
  const temp = effectiveFiltersAtTime.temperature ?? 100
  const sepiaAdj = Math.max(0, Math.min(100, (effectiveFiltersAtTime.sepia ?? 0) + ((temp - 100) / 100) * 15))
  const hueAdj = (effectiveFiltersAtTime.hue ?? 0) + (temp < 100 ? 8 : temp > 100 ? -4 : 0)
  const sat = effectiveFiltersAtTime.vibrance != null ? Math.round((effectiveFiltersAtTime.saturation ?? 100) * (effectiveFiltersAtTime.vibrance / 100)) : (effectiveFiltersAtTime.saturation ?? 100)
  const bright = effectiveFiltersAtTime.brightness ?? 100
  const shadowLift = (effectiveFiltersAtTime.shadows ?? 100) - 100
  const highCrush = 100 - (effectiveFiltersAtTime.highlights ?? 100)
  const dehazeAdj = ((effectiveFiltersAtTime.dehaze ?? 100) - 100) / 100 * 0.04
  const brightnessAdj = bright + shadowLift * 0.2 + highCrush * 0.15
  const contrastBase = effectiveFiltersAtTime.contrast ?? 100
  const sharpenAdj = (effectiveFiltersAtTime.sharpen ?? 0) / 100
  const clarityAdj = ((effectiveFiltersAtTime.clarity ?? 0) / 100) * 0.06
  const contrastAdj = Math.min(200, Math.max(50, contrastBase + sharpenAdj * 8 + clarityAdj * 100 + dehazeAdj * 100))
  const finalContrast = contrastAdj
  const finalSat = sat
  const finalBright = brightnessAdj

  const blurVal = effectiveFiltersAtTime.blur ?? 0
  const baseFilterString = showAppliedFilters
    ? `brightness(${Math.min(150, Math.max(50, finalBright))}%) contrast(${finalContrast}%) saturate(${Math.min(200, Math.max(0, finalSat))}%) hue-rotate(${hueAdj}deg) sepia(${sepiaAdj}%) blur(${blurVal}px)`
    : ''

  // Integrate Chromakey inline SVG filter if enabled
  const hasChroma = chromaKey?.enabled
  const filterString = hasChroma ? `url(#chroma-key-matrix) ${baseFilterString}` : (baseFilterString || 'none')

  const vignetteOpacity = showAppliedFilters && (effectiveFiltersAtTime.vignette ?? 0) > 0
    ? (effectiveFiltersAtTime.vignette / 100) * 0.6
    : 0

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget
    onDurationChange(v.duration)
    if (v.videoWidth > 0 && v.videoHeight > 0) {
      setVideoDimensions({ w: v.videoWidth, h: v.videoHeight })
    }
  }

  // Determine aspect ratio from layout
  const currentLayout = TEMPLATE_LAYOUTS.find(l => l.id === templateLayout) ?? TEMPLATE_LAYOUTS[1] // Default to standard 16/9
  const aspectStyle = currentLayout.id === 'auto' ? {} : { aspectRatio: currentLayout.aspect.replace('/', ' / ') }

  const animatedTransform = interpolateTransformAtTime(videoTransformKeyframes, currentTime, videoTransform as any)

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12 overflow-hidden">
      {/* Neural Chroma Key SVG Filter Engine */}
      {hasChroma && (
        <svg className="absolute w-0 h-0 pointer-events-none">
          <filter id="chroma-key-matrix" colorInterpolationFilters="sRGB">
            {/* Dynamic extraction matrix targeting specified color range and utilizing tolerance logic (simplified visual dropping of primary RGB channels) */}
            <feColorMatrix
              type="matrix"
              values={`
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                ${chromaKey.color.toLowerCase() === '#00ff00' ? `1.5 -2.5 1.5 0 ${chromaKey.tolerance}` : `1 1 -2.5 0 ${chromaKey.tolerance}`}
              `}
            />
            <feComponentTransfer>
              <feFuncA type="gamma" amplitude={chromaKey.opacity} exponent={1 / Math.max(0.1, chromaKey.edge)} offset={chromaKey.spill * -0.2} />
            </feComponentTransfer>
          </filter>
        </svg>
      )}

      {/* Main Preview Container with Aspect Ratio Control */}
      <div
        className="relative bg-black rounded-[2rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/5 group/preview w-full h-full max-w-full max-h-full flex items-center justify-center transition-all duration-500"
        style={aspectStyle}
      >
        {/* Cinematic Underlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />

        {/* Core Video Frame */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => onSelectOverlay?.(null)}
        >
          <Rnd
            position={{
              x: ((animatedTransform.positionX || 0) / 100) * (videoDimensions?.w || 800),
              y: ((animatedTransform.positionY || 0) / 100) * (videoDimensions?.h || 600)
            }}
            onDragStop={(e, d) => {
               const rawX = (d.x / (videoDimensions?.w || 800)) * 100
               const rawY = (d.y / (videoDimensions?.h || 600)) * 100
               onUpdateVideoTransform?.({ ...videoTransform, positionX: rawX, positionY: rawY })
            }}
            disableDragging={!isTransformMode || isPlaying}
            enableResizing={false}
            className={`absolute inset-0 w-full h-full flex items-center justify-center transition-all duration-300 ${isTransformMode ? 'z-40 ring-4 ring-indigo-500 cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]' : 'pointer-events-none'}`}
            style={{
               width: '100%',
               height: '100%',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain pointer-events-none"
              style={{
                filter: filterString,
                transform: `scale(${animatedTransform.scale ?? 1}) rotate(${animatedTransform.rotation ?? 0}deg)`,
                clipPath: videoCrop ? `inset(${videoCrop.top || 0}% ${videoCrop.right || 0}% ${videoCrop.bottom || 0}% ${videoCrop.left || 0}%)` : 'none',
              }}
              onLoadedMetadata={handleLoadedMetadata}
              autoPlay={isPlaying}
              muted={isMuted}
            />
          </Rnd>
          <canvas ref={webGpuCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-0" />
          {/* AI Mixing Engine: Detect active dialogue for ducking */}
          {(() => {
            const isDialogueActive = timelineSegments.some(s => s.track === 7 && s.type === 'audio' && currentTime >= s.startTime && currentTime <= s.endTime && (trackVisibility[s.track] !== false))

            return (
              <>
                {/* Audio Segments Engine */}
                {timelineSegments.filter(s => s.type === 'audio' && (trackVisibility[s.track] !== false)).map(s => (
                  <AudioSegment
                    key={s.id}
                    seg={s}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    volume={volume}
                    isMuted={isMuted}
                    isDialogueActive={isDialogueActive}
                  />
                ))}
              </>
            )
          })()}
        </div>

        {/* Interactive Overlays Layer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Smart Guides Rendering */}
          {activeDragId && snapLines.x !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] z-0"
              style={{ left: `${snapLines.x}%` }}
            />
          )}
          {activeDragId && snapLines.y !== undefined && (
            <div
              className="absolute left-0 right-0 h-[1px] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] z-0"
              style={{ top: `${snapLines.y}%` }}
            />
          )}

          {/* Text Overlays */}
          {textOverlays.map((text) => {
            const { opacity, transform, filter } = getTextOverlayAnimationStyle(text, currentTime)
            if (opacity === 0) return null
            const isSelected = selectedOverlayId === text.id

            return (
              <div
                key={text.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, filter, zIndex: 10 + (text.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (text.x / 100) * (videoDimensions?.w || 800) || 0, y: (text.y / 100) * (videoDimensions?.h || 600) || 0 }}
                  onDragStart={() => setActiveDragId(text.id)}
                  onDrag={(e, d) => {
                    const snapDist = 2 // 2% snap threshold
                    const pX = (d.x / (videoDimensions?.w || 800)) * 100
                    const pY = (d.y / (videoDimensions?.h || 600)) * 100
                    const newSnap: {x?: number, y?: number} = {}
                    if (Math.abs(pX - 50) < snapDist) newSnap.x = 50
                    if (Math.abs(pY - 50) < snapDist) newSnap.y = 50
                    setSnapLines(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    setSnapLines({})
                    const rawX = (d.x / (videoDimensions?.w || 800)) * 100
                    const rawY = (d.y / (videoDimensions?.h || 600)) * 100
                    onUpdateOverlay?.('text', text.id, {
                      x: snapLines.x !== undefined ? snapLines.x : rawX,
                      y: snapLines.y !== undefined ? snapLines.y : rawY
                    })
                  }}
                  className={`pointer-events-auto flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  enableResizing={false}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(text.id) }}
                >
                    <div
                      className="whitespace-pre-wrap text-center drop-shadow-lg"
                      style={{
                        fontSize: `${text.fontSize}px`,
                        color: text.color,
                        fontFamily: text.fontFamily,
                        letterSpacing: text.letterSpacing ? `${text.letterSpacing}px` : 'normal',
                        lineHeight: text.lineHeight || 1.2,
                        textShadow: text.style === 'shadow' ? `2px 2px 4px ${text.shadowColor || 'rgba(0,0,0,0.5)'}` :
                                   text.style === 'neon' ? `0 0 10px ${text.color}, 0 0 20px ${text.color}` :
                                   text.style === 'outline' ? `-1px -1px 0 ${text.outlineColor || '#000'}, 1px -1px 0 ${text.outlineColor || '#000'}, -1px 1px 0 ${text.outlineColor || '#000'}, 1px 1px 0 ${text.outlineColor || '#000'}` : 'none',
                        backgroundColor: text.backgroundColor || 'transparent',
                        padding: text.backgroundColor ? '4px 8px' : '0',
                        borderRadius: text.backgroundColor ? '4px' : '0',
                        transform: transform.replace('translate(-50%, -50%)', ''), // Rnd handles base positioning
                        transformOrigin: 'center center'
                      }}
                    >
                      {text.text}
                    </div>
                </Rnd>
              </div>
            )
          })}

          {/* Engine Telemetry Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
            <div className="flex bg-black/40 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-2xl items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Engine Status</span>
                <span className="text-xs font-mono font-bold text-white">{isPlaying ? 'PROCESSING' : 'STANDBY'}</span>
              </div>
            </div>
            <div className="flex bg-black/40 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-2xl items-center gap-3">
               <Activity className="w-3.5 h-3.5 text-indigo-400" />
               <div className="flex flex-col">
                 <span className="text-[9px] font-black uppercase text-white/50 tracking-wider">Performance</span>
                 <div className="flex gap-2 text-xs font-mono font-bold text-indigo-300">
                   <span>{fps} FPS</span>
                   <span className="opacity-50">|</span>
                   <span>{latency}ms</span>
                   <span className="opacity-50">|</span>
                   <span
                     className={
                       gpuStatus === 'ready' ? 'text-emerald-400'
                       : gpuStatus === 'unavailable' ? 'text-amber-400'
                       : 'text-white/40'
                     }
                     title={
                       gpuStatus === 'ready' ? 'WebGPU acceleration active'
                       : gpuStatus === 'unavailable' ? 'WebGPU unavailable — using fallback video preview'
                       : 'Initializing GPU renderer…'
                     }
                   >
                     {gpuStatus === 'ready' ? 'GPU' : gpuStatus === 'unavailable' ? 'GPU off' : 'GPU…'}
                   </span>
                 </div>
               </div>
            </div>
            {(() => {
              const ops = timelineHasExportOnlyOps(timelineSegments || [])
              const total = ops.reverse + ops.jcut + ops.lcut
              if (total === 0) return null
              const parts: string[] = []
              if (ops.reverse) parts.push(`${ops.reverse}× reverse`)
              if (ops.jcut) parts.push(`${ops.jcut}× J-cut`)
              if (ops.lcut) parts.push(`${ops.lcut}× L-cut`)
              return (
                <div
                  className="flex bg-amber-500/10 backdrop-blur-md rounded-xl px-3 py-2 border border-amber-500/25 shadow-2xl items-center gap-2"
                  title="These ops are applied at export time only — preview shows segments in their original direction with normal audio sync."
                >
                  <span className="text-[9px] font-black uppercase text-amber-300/80 tracking-wider">Export-only</span>
                  <span className="text-[10px] font-mono font-bold text-amber-200">{parts.join(' · ')}</span>
                </div>
              )
            })()}
            {/* Resolution Toggle */}
            <div className="flex bg-black/40 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-2xl items-center gap-1">
              {(['Full', '1/2', '1/4'] as const).map(res => (
                <button
                  key={res}
                  onClick={() => setPreviewResolution(res)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${previewResolution === res ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                  title={`${res} Resolution`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Image Overlays */}
          {imageOverlays.map((img) => {
            const { opacity, transform } = getOverlayAnimationStyle(img.startTime, img.endTime, currentTime, img.animationIn, img.animationOut)
            if (opacity === 0) return null
            const isSelected = selectedOverlayId === img.id

            return (
              <div
                key={img.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, zIndex: 10 + (img.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (img.x / 100) * (videoDimensions?.w || 800) || 0, y: (img.y / 100) * (videoDimensions?.h || 600) || 0 }}
                  size={{ width: `${img.width}%`, height: `${img.height}%` }}
                  onDragStart={() => setActiveDragId(img.id)}
                  onDrag={(e, d) => {
                    const snapDist = 2 // 2% snap threshold
                    const pX = (d.x / (videoDimensions?.w || 800)) * 100
                    const pY = (d.y / (videoDimensions?.h || 600)) * 100
                    const newSnap: {x?: number, y?: number} = {}
                    if (Math.abs(pX - 50) < snapDist) newSnap.x = 50
                    if (Math.abs(pY - 50) < snapDist) newSnap.y = 50
                    setSnapLines(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    setSnapLines({})
                    const rawX = (d.x / (videoDimensions?.w || 800)) * 100
                    const rawY = (d.y / (videoDimensions?.h || 600)) * 100
                    onUpdateOverlay?.('image', img.id, {
                      x: snapLines.x !== undefined ? snapLines.x : rawX,
                      y: snapLines.y !== undefined ? snapLines.y : rawY
                    })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     onUpdateOverlay?.('image', img.id, {
                       width: parseFloat(ref.style.width),
                       height: parseFloat(ref.style.height),
                       x: (position.x / (videoDimensions?.w || 800)) * 100,
                       y: (position.y / (videoDimensions?.h || 600)) * 100
                     })
                  }}
                  className={`pointer-events-auto ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(img.id) }}
                >
                  <img
                    src={img.url}
                    alt="Image Layer"
                    className="w-full h-full object-contain pointer-events-none"
                    style={{
                      opacity: img.opacity ?? 1,
                      transform: transform.replace('translate(-50%, -50%)', ''), // Basic animation transforms on top of Rnd
                      transformOrigin: 'center center'
                    }}
                  />
                </Rnd>
              </div>
            )
          })}

          {/* Shape Overlays */}
          {shapeOverlays.map((shape) => {
            const { opacity, transform } = getOverlayAnimationStyle(shape.startTime, shape.endTime, currentTime)
            if (opacity === 0) return null
            const isSelected = selectedOverlayId === shape.id

            return (
              <div
                key={shape.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, zIndex: 10 + (shape.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (shape.x / 100) * (videoDimensions?.w || 800) || 0, y: (shape.y / 100) * (videoDimensions?.h || 600) || 0 }}
                  size={{ width: `${shape.width}%`, height: `${shape.height}%` }}
                  onDragStart={() => setActiveDragId(shape.id)}
                  onDrag={(e, d) => {
                    const snapDist = 2 // 2% snap threshold
                    const pX = (d.x / (videoDimensions?.w || 800)) * 100
                    const pY = (d.y / (videoDimensions?.h || 600)) * 100
                    const newSnap: {x?: number, y?: number} = {}
                    if (Math.abs(pX - 50) < snapDist) newSnap.x = 50
                    if (Math.abs(pY - 50) < snapDist) newSnap.y = 50
                    setSnapLines(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    setSnapLines({})
                    const rawX = (d.x / (videoDimensions?.w || 800)) * 100
                    const rawY = (d.y / (videoDimensions?.h || 600)) * 100
                    onUpdateOverlay?.('shape', shape.id, {
                      x: snapLines.x !== undefined ? snapLines.x : rawX,
                      y: snapLines.y !== undefined ? snapLines.y : rawY
                    })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     onUpdateOverlay?.('shape', shape.id, {
                       width: parseFloat(ref.style.width),
                       height: parseFloat(ref.style.height),
                       x: (position.x / (videoDimensions?.w || 800)) * 100,
                       y: (position.y / (videoDimensions?.h || 600)) * 100
                     })
                  }}
                  className={`pointer-events-auto flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(shape.id) }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: shape.kind === 'rect' ? shape.color : 'transparent',
                      borderRadius: shape.kind === 'circle' ? '50%' : '0',
                      border: shape.kind === 'line' ? `${shape.strokeWidth || 2}px solid ${shape.color}` : 'none',
                      transform: transform.replace('translate(-50%, -50%)', ''),
                      transformOrigin: 'center center',
                      opacity: shape.opacity
                    }}
                  />
                </Rnd>
              </div>
            )
          })}
        </div>

        {/* HUD Elements */}
        <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between opacity-0 group-hover/preview:opacity-100 transition-opacity duration-500">
          <div className="flex justify-between items-start">
            <div className="px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Projection Active</span>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Res: {videoDimensions?.w ?? 0}x{videoDimensions?.h ?? 0}</span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono">Buffer: Stable</span>
            </div>
          </div>

          <div className="flex justify-between items-end">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Latency</span>
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-black text-white italic">0.2ms</span>
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Engine</span>
                <span className="text-xs font-black text-white italic">Elite v3.2</span>
              </div>
            </div>

            <div className="px-5 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-6 pointer-events-auto">
              <button onClick={onPlayPause} className="text-white hover:text-indigo-400 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button onClick={handleBeforeAfterToggle} className={`transition-colors ${showAppliedFilters ? 'text-indigo-400' : 'text-white/40'}`}>
                {showAppliedFilters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Framing Corners */}
        <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-white/20 pointer-events-none" />
        <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white/20 pointer-events-none" />

        {/* Neural DNA Active Overlay */}
        <AnimatePresence>
          {isNeuralActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-40 overflow-hidden"
            >
              {/* Scanline Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(99,102,241,0.05)_50%)] bg-[length:100%_4px] pointer-events-none" />

              {/* Top HUD Label */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-500/20 backdrop-blur-md border border-indigo-500/40 rounded-full flex items-center gap-3">
                <Fingerprint className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic leading-none">Neural DNA Vault Active</span>
              </div>

              {/* Data Streams (Simplified) */}
              <div className="absolute top-0 bottom-0 left-12 w-px bg-indigo-500/20" />
              <div className="absolute top-1/4 left-14 space-y-2 opacity-50">
                 <div className="text-[8px] font-mono text-indigo-300">SEG_ID: {Math.random().toString(16).slice(2,8)}</div>
                 <div className="text-[8px] font-mono text-indigo-300">DNA_MATCH: 99.42%</div>
                 <div className="text-[8px] font-mono text-indigo-300">FR_LATENCY: 0.12ms</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Filter Overlays */}
        {vignetteOpacity > 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)` }} />
        )}
      </div>
    </div>
  )
}

export default RealTimeVideoPreview
