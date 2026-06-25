'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Play, Pause, Eye, EyeOff, Circle, Activity, Crosshair, Fingerprint } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './EditorComponents.css'
import { 
  TimelineSegment, TimelineEffect, TextOverlay, CaptionStyle, CAPTION_SIZE_PX, 
  TemplateLayout, TEMPLATE_LAYOUTS, CaptionTextStyle, TextOverlayAnimationIn, 
  TextOverlayAnimationOut, ShapeOverlay, MotionGraphicPreset, ImageOverlay, 
  GradientOverlay, SvgOverlay, TransformKeyframe, VideoFilter 
} from '../../types/editor'
import { usePreviewRecorder } from '../../hooks/usePreviewRecorder'
import { getMatchingEmojiForChunk } from '../../utils/captionEmojiMap'
import { interpolateTransformAtTime, interpolateEffectTransformAtTime } from '../../utils/keyframeEasing'
import { Rnd } from 'react-rnd'
import { getAssetUrl } from '../../utils/url'

/** Coerce a possibly-undefined/NaN number to a finite fallback. */
function safeNum(n: any, fallback: number): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : fallback
}

/** Clamp n to [lo,hi] (returns lo if NaN). */
function clampNum(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, n))
}

// Caption preset signature colours — mirror the render CAPTION_STYLE_MAP so the
// editor PREVIEW matches the EXPORT (preview↔export parity).
const CAPTION_PRESET_COLORS: Record<string, string> = {
  hook: '#FFD700', stat: '#00FFFF', question: '#FFFFFF',
  punchline: '#FF3366', CTA: '#FFD700', default: '#FFFFFF',
}

/** The word active at time t for a word-by-word (karaoke) caption, or '' in a gap. */
function activeKaraokeWord(words: any[], t: number): string {
  if (!Array.isArray(words)) return ''
  for (const w of words) {
    if (!w) continue
    const start = Number(w.start ?? w.startTime)
    const end = Number(w.end ?? w.endTime)
    if (Number.isFinite(start) && Number.isFinite(end) && t >= start && t < end) {
      return String(w.word ?? w.text ?? '')
    }
  }
  return ''
}

/**
 * Interpolate a text/shape/image/svg overlay's keyframed transform at the
 * current playhead time, returning per-frame {x,y,scale,rotation,opacity}.
 *
 * Parity: matches the server export (videoRenderService.js buildTextOverlay /
 * buildDrawBoxFilter / buildImageOverlay) where keyframe `positionX`/`positionY`
 * are PERCENT OFFSETS added to the overlay's base x/y (server: `+w*(kfPx)/100`),
 * while `scale`/`rotation`/`opacity` are absolute keyframe values. Easing is
 * applied via interpolateTransformAtTime (client/utils/keyframeEasing.ts), which
 * the export's buildKeyframeExpr approximates with piecewise-linear segments.
 *
 * Returns null when the overlay has no keyframes (caller keeps base position).
 */
function interpolateOverlayAtTime(
  overlay: { x?: number; y?: number; opacity?: number; keyframes?: TransformKeyframe[] },
  currentTime: number
): { x: number; y: number; scale: number; rotation: number; opacity: number } | null {
  const kf = Array.isArray(overlay.keyframes) ? overlay.keyframes : null
  if (!kf || kf.length === 0) return null
  const baseX = safeNum(overlay.x, 50)
  const baseY = safeNum(overlay.y, 50)
  // Defaults: positionX/Y default to 0 (offset), so absence of those keyframes
  // leaves the base position untouched. scale/rotation/opacity default to identity.
  const interp = interpolateTransformAtTime(kf, currentTime, {
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    opacity: safeNum(overlay.opacity, 1),
  })
  return {
    x: baseX + interp.positionX, // positionX is a % offset (server: +w*(kfPx)/100)
    y: baseY + interp.positionY,
    scale: interp.scale,
    rotation: interp.rotation,
    opacity: interp.opacity,
  }
}

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
  const normalizedUrl = getAssetUrl(seg.sourceUrl || '')
  return (
    <video
      ref={ref}
      src={normalizedUrl}
      className="max-w-full max-h-full object-contain video-fit-contain w-full h-full"
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

  const normalizedAudioUrl = getAssetUrl(seg.sourceUrl || '')
  return <audio ref={ref} src={normalizedAudioUrl} />
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

export interface RealTimeVideoPreviewProps {
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
  chromaKey?: any
  onUpdateOverlay?: (type: string, id: string, updates: any) => void
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

function blendFiltersAtTime(base: VideoFilter, effects: TimelineEffect[], t: number): VideoFilter {
  let out = { ...base };
  for (const e of effects) {
    if (e.type !== 'filter' || !e.enabled || t < e.startTime || t > e.endTime) continue;
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
  const normalizedVideoUrl = getAssetUrl(videoUrl || '')
  
  // Overlay active B-roll on top of the main video
  const activeBroll = timelineSegments.find(s => 
    (s.type === 'broll' || s.track === 1) && 
    currentTime >= s.startTime && 
    currentTime <= s.endTime && 
    (trackVisibility[s.track] !== false)
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoRefRight = useRef<HTMLVideoElement>(null)
  const previewRecorder = usePreviewRecorder(videoRef)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate
  const [internalShowFilters, setInternalShowFilters] = useState(true)
  const [fps, setFps] = useState(60)
  const [latency, setLatency] = useState(0.2)
  const [magneticSnapping, setMagneticSnapping] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingTextValue, setEditingTextValue] = useState<string>('')
  const [previewResolution, setPreviewResolution] = useState<'Full' | '1/2' | '1/4'>('Full')
  const [videoDimensions, setVideoDimensions] = useState<{ w: number; h: number } | null>(null)
  const [containerDimensions, setContainerDimensions] = useState<{ w: number; h: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Use the measured container if available; otherwise fall back to the live
  // overlay layer's current rect (fix #3 init race) and only then to a constant.
  // This keeps first-paint overlay positions correct before the ResizeObserver
  // has fired, avoiding the position jump/flicker on load.
  const containerW = (containerDimensions?.w
    ?? (containerRef.current?.getBoundingClientRect().width || 0)) || 800
  const containerH = (containerDimensions?.h
    ?? (containerRef.current?.getBoundingClientRect().height || 0)) || 600
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

  // Track container dimensions to map percentage coordinates to actual pixels
  useEffect(() => {
    if (!containerRef.current) return
    
    // Set initial size immediately on mount to prevent coordinate jump
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setContainerDimensions({
        w: rect.width,
        h: rect.height
      })
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === containerRef.current) {
          setContainerDimensions({
            w: entry.contentRect.width,
            h: entry.contentRect.height
          })
        }
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Smart Guides State. snapLines drives the on-screen guide rendering; the ref
  // mirrors it synchronously so onDragStop reads the latest snap target without
  // a React state-update race (fix #6: snapLines was set in onDrag but read
  // stale in onDragStop).
  const [snapLines, setSnapLines] = useState<{ x?: number, y?: number }>({})
  const snapLinesRef = useRef<{ x?: number, y?: number }>({})
  const setSnap = (next: { x?: number, y?: number }) => {
    snapLinesRef.current = next
    setSnapLines(next)
  }

  // Performance Monitoring
  const frameTimes = useRef<number[]>([])
  const lastTimeRef = useRef<number>(performance.now())

  // Timeline time is tracked independently from video.currentTime so that
  // segment ops (split/reorder/trim/freeze) can be honored — see
  // timelineToSource. For a flat single-segment timeline the two are equal.
  const timelineTimeRef = useRef<number>(currentTime)
  const lastSegmentIdRef = useRef<string | null>(null)
  const lastSegBoundarySeekRef = useRef<number>(0)
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
        // Hysteresis (0.1s): only seek when the element is meaningfully out of
        // sync, so float jitter exactly at a boundary doesn't re-seek every
        // frame (which audibly glitches audio). lastSegBoundarySeekRef guards
        // against re-issuing the same boundary seek before it settles.
        const now2 = now
        if (
          segId &&
          Math.abs(v.currentTime - mapping.sourceTime) > 0.1 &&
          now2 - lastSegBoundarySeekRef.current > 100
        ) {
          try { v.currentTime = mapping.sourceTime } catch (e) { /* pre-metadata */ }
          lastSegBoundarySeekRef.current = now2
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
    // previewQuality is read from a ref-like value within the render loop;
    // including it would tear down and re-create the rAF loop on quality
    // changes, which we want to avoid mid-playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Blur parity: server buildVideoFilterChain uses
  // `boxblur=lr=max(1, round(blur/10)):lp=1` (luma radius ≈ blur/10 px, applied
  // once). A CSS gaussian blur of the same px value looks far stronger, so scale
  // the CSS blur down to ~blur/10 px to land visually close to the export.
  const blurVal = effectiveFiltersAtTime.blur ?? 0
  const cssBlurPx = blurVal > 0 ? Math.max(1, Math.round(blurVal / 10)) : 0
  const baseFilterString = showAppliedFilters
    ? `brightness(${Math.min(150, Math.max(50, finalBright))}%) contrast(${finalContrast}%) saturate(${Math.min(200, Math.max(0, finalSat))}%) hue-rotate(${hueAdj}deg) sepia(${sepiaAdj}%) blur(${cssBlurPx}px)`
    : ''

  // Integrate Chromakey inline SVG filter if enabled
  const hasChroma = chromaKey?.enabled
  const filterString = hasChroma ? `url(#chroma-key-matrix) ${baseFilterString}` : (baseFilterString || 'none')

  // Parity: server buildVideoFilterChain applies `vignette=angle=PI/4` (a fixed,
  // non-intensity-scaled darkening at the corners) whenever vignette > 0. The
  // ffmpeg PI/4 vignette darkens corners to roughly 75% — so map our overlay
  // opacity toward ~0.75 at full intensity (was 0.6, too light vs export).
  const vignetteOpacity = showAppliedFilters && (effectiveFiltersAtTime.vignette ?? 0) > 0
    ? (effectiveFiltersAtTime.vignette / 100) * 0.75
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
  const aspectStyle = currentLayout.id === 'auto'
    ? {}
    : {
        aspectRatio: currentLayout.aspect.replace('/', ' / '),
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: '100%'
      };

  const animatedTransform = interpolateTransformAtTime(videoTransformKeyframes, currentTime, videoTransform as any);

  return (
    <>
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
        <div className="absolute inset-0 pointer-events-none video-cinematic-underlay" />

        {/* Core Video Frame */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => onSelectOverlay?.(null)}
        >
          <Rnd
            position={{
              // Fix #2: guard NaN/undefined transform/dimension values.
              x: (safeNum(animatedTransform.positionX, 0) / 100) * (videoDimensions?.w || 800),
              y: (safeNum(animatedTransform.positionY, 0) / 100) * (videoDimensions?.h || 600)
            }}
            onDragStop={(e, d) => {
               const rawX = (d.x / (videoDimensions?.w || 800)) * 100
               const rawY = (d.y / (videoDimensions?.h || 600)) * 100
               onUpdateVideoTransform?.({ ...videoTransform, positionX: safeNum(rawX, 0), positionY: safeNum(rawY, 0) })
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
              src={normalizedVideoUrl}
              className="w-full h-full object-contain pointer-events-none"
              style={{
                '--v-filter': filterString,
                '--v-transform': `scale(${animatedTransform.scale ?? 1}) rotate(${animatedTransform.rotation ?? 0}deg)`,
                '--v-clip': videoCrop ? `inset(${videoCrop.top || 0}% ${videoCrop.right || 0}% ${videoCrop.bottom || 0}% ${videoCrop.left || 0}%)` : 'none',
                filter: 'var(--v-filter)',
                transform: 'var(--v-transform)',
                clipPath: 'var(--v-clip)'
              } as any}
              onLoadedMetadata={handleLoadedMetadata}
              autoPlay={isPlaying}
              muted={isMuted}
            />
            {activeBroll && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                <BrollVideo
                  seg={activeBroll}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                />
              </div>
            )}
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
        <div ref={containerRef} className="absolute inset-0 pointer-events-none">
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
            const { opacity: animOpacity, transform, filter } = getTextOverlayAnimationStyle(text, currentTime)
            // Fix #1: live keyframe interpolation (parity: server buildTextOverlay
            // — positionX/Y are % offsets on base x/y, scale/rotation/opacity
            // absolute). Blends with animationIn/Out by multiplying opacities and
            // composing the keyframe transform on top of the enter/exit transform.
            const kfm = interpolateOverlayAtTime(text, currentTime)
            const opacity = animOpacity * (kfm ? kfm.opacity : 1)
            if (opacity === 0) return null
            // Fix #2: guard NaN/undefined coords before percent→px conversion.
            const safeX = clampNum(kfm ? kfm.x : safeNum(text.x, 50), -50, 150)
            const rawSafeY = clampNum(kfm ? kfm.y : safeNum(text.y, 50), -50, 150)
            // Preview parity: keep captions inside the safe band unless opted out.
            const safeY = (text as any).safeZone === false ? rawSafeY : clampNum(rawSafeY, 4, 92)
            // Preview parity: preset colour + word-by-word (karaoke) active word.
            const presetColor = (text as any).captionPreset ? CAPTION_PRESET_COLORS[(text as any).captionPreset] : null
            const isWordMode = (text as any).captionMode === 'word' && Array.isArray((text as any).words) && (text as any).words.length
            const displayText = isWordMode ? activeKaraokeWord((text as any).words, currentTime) : text.text
            // Highlight: if the active word is a designated keyword, use the accent.
            const hlSet: string[] = Array.isArray((text as any).highlightWords) ? (text as any).highlightWords : []
            const hlNorm = String(displayText || '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const isHighlightWord = isWordMode && (text as any).highlightColor && hlSet.includes(hlNorm)
            const displayColor = isHighlightWord ? (text as any).highlightColor : (presetColor || text.color)
            const kfTransform = kfm
              ? ` scale(${kfm.scale}) rotate(${kfm.rotation}deg)`
              : ''
            const isSelected = selectedOverlayId === text.id

            return (
              <div
                key={text.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, filter, zIndex: 10 + (text.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (safeX / 100) * containerW, y: (safeY / 100) * containerH }}
                  size={{
                    width: text.width ? (clampNum(safeNum(text.width, 30), 1, 100) / 100) * containerW : 'auto',
                    height: text.height ? (clampNum(safeNum(text.height, 10), 1, 100) / 100) * containerH : 'auto'
                  }}
                  onDragStart={() => setActiveDragId(text.id)}
                  onDrag={(e, d) => {
                    if (!magneticSnapping) return
                    const snapDist = 3 // 3% snap threshold
                    const pX = (d.x / containerW) * 100
                    const pY = (d.y / containerH) * 100
                    const newSnap: {x?: number, y?: number} = {}

                    const snapPoints = [0, 25, 50, 75, 100]
                    for (const pt of snapPoints) {
                      if (Math.abs(pX - pt) < snapDist) newSnap.x = pt
                      if (Math.abs(pY - pt) < snapDist) newSnap.y = pt
                    }
                    setSnap(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    const snap = snapLinesRef.current
                    setSnap({})
                    const rawX = (d.x / containerW) * 100
                    const rawY = (d.y / containerH) * 100
                    onUpdateOverlay?.('text', text.id, {
                      x: snap.x !== undefined ? snap.x : rawX,
                      y: snap.y !== undefined ? snap.y : rawY
                    })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     // Scale font size proportionally to height change
                     const oldHeight = ref.offsetHeight - delta.height
                     const ratio = oldHeight > 0 ? ref.offsetHeight / oldHeight : 1
                     const newFontSize = Math.max(12, Math.round(text.fontSize * ratio))
                     const rawX = (position.x / containerW) * 100
                     const rawY = (position.y / containerH) * 100
                     onUpdateOverlay?.('text', text.id, {
                       fontSize: newFontSize,
                       x: rawX,
                       y: rawY,
                       width: (ref.offsetWidth / containerW) * 100,
                       height: (ref.offsetHeight / containerH) * 100
                     })
                  }}
                  className={`pointer-events-auto flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                  style={{ maxWidth: '90%' }}
                  disableDragging={isPlaying || editingTextId === text.id}
                  enableResizing={{
                    topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
                    left: false, right: false, top: false, bottom: false
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(text.id) }}
                >
                  {isSelected && (
                    <>
                      <div className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                    </>
                  )}
                  {editingTextId === text.id ? (
                    <textarea
                      value={editingTextValue}
                      title="Edit caption text inline"
                      aria-label="Edit caption text inline"
                      placeholder="Type caption text..."
                      onChange={(e) => setEditingTextValue(e.target.value)}
                      onBlur={() => {
                        onUpdateOverlay?.('text', text.id, { text: editingTextValue })
                        setEditingTextId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          onUpdateOverlay?.('text', text.id, { text: editingTextValue })
                          setEditingTextId(null)
                        }
                      }}
                      className="bg-transparent border border-indigo-500 text-white outline-none resize-none p-1 text-center font-bold"
                      style={{
                        fontSize: `${text.fontSize}px`,
                        fontFamily: text.fontFamily,
                        lineHeight: text.lineHeight || 1.2,
                        width: '100%',
                        minWidth: '120px',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '4px',
                        color: text.color,
                      }}
                      autoFocus
                    />
                  ) : (
                    <div
                      className={
                        text.motionGraphic && text.motionGraphic !== 'none'
                          ? `motion-graphic-${text.motionGraphic} w-full h-full flex items-center justify-center`
                          : 'w-full h-full flex items-center justify-center'
                      }
                    >
                      <div
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingTextId(text.id)
                          setEditingTextValue(text.text)
                        }}
                        className="whitespace-pre-wrap break-words flex flex-col justify-center text-center drop-shadow-lg max-w-[90vw]"
                        style={{
                          fontSize: `${text.fontSize}px`,
                          color: displayColor,
                          fontFamily: text.fontFamily,
                          letterSpacing: text.letterSpacing ? `${text.letterSpacing}px` : 'normal',
                          lineHeight: text.lineHeight || 1.2,
                          textShadow: text.style === 'shadow' ? `2px 2px 4px ${text.shadowColor || 'rgba(0,0,0,0.5)'}` :
                                     text.style === 'neon' ? `0 0 10px ${displayColor}, 0 0 20px ${displayColor}` :
                                     text.style === 'outline' ? `-1px -1px 0 ${text.outlineColor || '#000'}, 1px -1px 0 ${text.outlineColor || '#000'}, -1px 1px 0 ${text.outlineColor || '#000'}, 1px 1px 0 ${text.outlineColor || '#000'}` : 'none',
                          backgroundColor: text.backgroundColor || 'transparent',
                          padding: text.backgroundColor ? '4px 8px' : '0',
                          borderRadius: text.backgroundColor ? '4px' : '0',
                          transform: `${transform.replace('translate(-50%, -50%)', '')}${kfTransform}`, // Rnd handles base positioning; kfTransform = live keyframe scale/rotation
                          transformOrigin: 'center center'
                        }}
                      >
                        {displayText}
                      </div>
                    </div>
                  )}
                </Rnd>
              </div>
            )
          })}

          {/* Engine Telemetry Overlay */}
          {/* Engine Telemetry Overlay */}
          {(() => {
            const ops = timelineHasExportOnlyOps(timelineSegments || [])
            const total = ops.reverse + ops.jcut + ops.lcut
            if (total === 0) return null
            const parts: string[] = []
            if (ops.reverse) parts.push(`${ops.reverse}× reverse`)
            if (ops.jcut) parts.push(`${ops.jcut}× J-cut`)
            if (ops.lcut) parts.push(`${ops.lcut}× L-cut`)
            return (
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
                <div
                  className="flex bg-amber-500/10 backdrop-blur-md rounded-xl px-3 py-2 border border-amber-500/25 shadow-2xl items-center gap-2 pointer-events-auto"
                  title="These ops are applied at export time only — preview shows segments in their original direction with normal audio sync."
                >
                  <span className="text-[9px] font-black uppercase text-amber-300/80 tracking-wider">Export-only</span>
                  <span className="text-[10px] font-mono font-bold text-amber-200">{parts.join(' · ')}</span>
                </div>
              </div>
            )
          })()}
          </div>

          {/* Image Overlays */}
          {imageOverlays.map((img) => {
            const { opacity: animOpacity, transform } = getOverlayAnimationStyle(img.startTime, img.endTime, currentTime, img.animationIn, img.animationOut)
            // Fix #1: live keyframes (parity: server buildImageOverlay — positionX/Y
            // % offsets, scale/rotation/opacity absolute).
            const kfm = interpolateOverlayAtTime(img, currentTime)
            const opacity = animOpacity * (kfm ? kfm.opacity : 1)
            if (opacity === 0) return null
            // Fix #2: NaN/undefined coord guards.
            const safeX = clampNum(kfm ? kfm.x : safeNum(img.x, 50), -50, 150)
            const safeY = clampNum(kfm ? kfm.y : safeNum(img.y, 50), -50, 150)
            const kfTransform = kfm ? ` scale(${kfm.scale}) rotate(${kfm.rotation}deg)` : ''
            const isSelected = selectedOverlayId === img.id

            return (
              <div
                key={img.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, zIndex: 10 + (img.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (safeX / 100) * containerW, y: (safeY / 100) * containerH }}
                  size={{
                    width: img.width ? (clampNum(safeNum(img.width, 30), 1, 100) / 100) * containerW : 'auto',
                    height: img.height ? (clampNum(safeNum(img.height, 30), 1, 100) / 100) * containerH : 'auto'
                  }}
                  onDragStart={() => setActiveDragId(img.id)}
                  onDrag={(e, d) => {
                    if (!magneticSnapping) return
                    const snapDist = 3
                    const pX = (d.x / containerW) * 100
                    const pY = (d.y / containerH) * 100
                    const newSnap: {x?: number, y?: number} = {}
                    const snapPoints = [0, 25, 50, 75, 100]
                    for (const pt of snapPoints) {
                      if (Math.abs(pX - pt) < snapDist) newSnap.x = pt
                      if (Math.abs(pY - pt) < snapDist) newSnap.y = pt
                    }
                    setSnap(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    const snap = snapLinesRef.current
                    setSnap({})
                    const rawX = (d.x / containerW) * 100
                    const rawY = (d.y / containerH) * 100
                    onUpdateOverlay?.('image', img.id, {
                      x: snap.x !== undefined ? snap.x : rawX,
                      y: snap.y !== undefined ? snap.y : rawY
                    })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     onUpdateOverlay?.('image', img.id, {
                       width: (ref.offsetWidth / containerW) * 100,
                       height: (ref.offsetHeight / containerH) * 100,
                       x: (position.x / containerW) * 100,
                       y: (position.y / containerH) * 100
                     })
                  }}
                  className={`pointer-events-auto ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(img.id) }}
                >
                  {isSelected && (
                    <>
                      <div className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                    </>
                  )}
                  <img
                    src={getAssetUrl(img.url)}
                    alt="Image Layer"
                    className="w-full h-full object-contain pointer-events-none"
                    style={{
                      // When keyframes drive opacity, kfm.opacity is already in the
                      // wrapper (seeded from img.opacity) — avoid double-applying.
                      opacity: kfm ? 1 : (img.opacity ?? 1),
                      transform: `${transform.replace('translate(-50%, -50%)', '')}${kfTransform}`,
                      transformOrigin: 'center center'
                    }}
                    onError={(e) => {
                      // Fix #7: surface broken image assets instead of silent blank.
                      console.warn('[Preview] image overlay failed to load:', getAssetUrl(img.url))
                      const el = e.currentTarget
                      el.style.opacity = '1'
                      el.style.background = 'repeating-linear-gradient(45deg,rgba(239,68,68,0.15),rgba(239,68,68,0.15)10px,rgba(239,68,68,0.3)10px,rgba(239,68,68,0.3)20px)'
                      el.style.outline = '1px dashed rgba(239,68,68,0.7)'
                      el.alt = 'Image failed to load'
                    }}
                  />
                </Rnd>
              </div>
            )
          })}

          {/* Shape Overlays */}
          {shapeOverlays.map((shape) => {
            const { opacity: animOpacity, transform } = getOverlayAnimationStyle(shape.startTime, shape.endTime, currentTime)
            // Fix #1: live keyframes (parity: server buildDrawBoxFilter — positionX/Y
            // % offsets; opacity collapses to keyframe average in export, but the
            // preview can show true per-frame opacity).
            const kfm = interpolateOverlayAtTime(shape, currentTime)
            const opacity = animOpacity * (kfm ? kfm.opacity : 1)
            if (opacity === 0) return null
            // Fix #2: NaN/undefined coord guards.
            const safeX = clampNum(kfm ? kfm.x : safeNum(shape.x, 50), -50, 150)
            const safeY = clampNum(kfm ? kfm.y : safeNum(shape.y, 50), -50, 150)
            const kfTransform = kfm ? ` scale(${kfm.scale}) rotate(${kfm.rotation}deg)` : ''
            const isSelected = selectedOverlayId === shape.id

            return (
              <div
                key={shape.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity, zIndex: 10 + (shape.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (safeX / 100) * containerW, y: (safeY / 100) * containerH }}
                  size={{
                    width: shape.width ? (clampNum(safeNum(shape.width, 20), 1, 100) / 100) * containerW : 'auto',
                    height: shape.height ? (clampNum(safeNum(shape.height, 20), 1, 100) / 100) * containerH : 'auto'
                  }}
                  onDragStart={() => setActiveDragId(shape.id)}
                  onDrag={(e, d) => {
                    if (!magneticSnapping) return
                    const snapDist = 3
                    const pX = (d.x / containerW) * 100
                    const pY = (d.y / containerH) * 100
                    const newSnap: {x?: number, y?: number} = {}
                    const snapPoints = [0, 25, 50, 75, 100]
                    for (const pt of snapPoints) {
                      if (Math.abs(pX - pt) < snapDist) newSnap.x = pt
                      if (Math.abs(pY - pt) < snapDist) newSnap.y = pt
                    }
                    setSnap(newSnap)
                  }}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    const snap = snapLinesRef.current
                    setSnap({})
                    const rawX = (d.x / containerW) * 100
                    const rawY = (d.y / containerH) * 100
                    onUpdateOverlay?.('shape', shape.id, {
                      x: snap.x !== undefined ? snap.x : rawX,
                      y: snap.y !== undefined ? snap.y : rawY
                    })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     onUpdateOverlay?.('shape', shape.id, {
                       width: (ref.offsetWidth / containerW) * 100,
                       height: (ref.offsetHeight / containerH) * 100,
                       x: (position.x / containerW) * 100,
                       y: (position.y / containerH) * 100
                     })
                  }}
                  className={`pointer-events-auto flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(shape.id) }}
                >
                  {isSelected && (
                    <>
                      <div className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                    </>
                  )}
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: shape.kind === 'rect' ? shape.color : 'transparent',
                      borderRadius: shape.kind === 'circle' ? '50%' : '0',
                      border: shape.kind === 'line' ? `${shape.strokeWidth || 2}px solid ${shape.color}` : 'none',
                      transform: `${transform.replace('translate(-50%, -50%)', '')}${kfTransform}`,
                      transformOrigin: 'center center',
                      // kfm.opacity (seeded from shape.opacity) already in wrapper.
                      opacity: kfm ? 1 : shape.opacity
                    }}
                  />
                </Rnd>
              </div>
            )
          })}

          {/* SVG Overlays */}
          {svgOverlays.map((svg) => {
            const isActive = currentTime >= svg.startTime && currentTime <= svg.endTime
            if (!isActive) return null
            const isSelected = selectedOverlayId === svg.id

            return (
              <div
                key={svg.id}
                className="absolute top-0 left-0 w-full h-full"
                style={{ opacity: svg.opacity, zIndex: 10 + (svg.layer || 0) }}
              >
                <Rnd
                  bounds="parent"
                  position={{ x: (clampNum(safeNum(svg.x, 50), -50, 150) / 100) * containerW, y: (clampNum(safeNum(svg.y, 50), -50, 150) / 100) * containerH }}
                  size={{
                    width: svg.width ? (clampNum(safeNum(svg.width, 20), 1, 100) / 100) * containerW : 'auto',
                    height: svg.height ? (clampNum(safeNum(svg.height, 20), 1, 100) / 100) * containerH : 'auto'
                  }}
                  onDragStart={() => setActiveDragId(svg.id)}
                  onDragStop={(e, d) => {
                    setActiveDragId(null)
                    const rawX = (d.x / containerW) * 100
                    const rawY = (d.y / containerH) * 100
                    onUpdateOverlay?.('svg', svg.id, { x: rawX, y: rawY })
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                     onUpdateOverlay?.('svg', svg.id, {
                       width: (ref.offsetWidth / containerW) * 100,
                       height: (ref.offsetHeight / containerH) * 100,
                       x: (position.x / containerW) * 100,
                       y: (position.y / containerH) * 100
                     })
                  }}
                  className={`pointer-events-auto ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                  disableDragging={isPlaying}
                  onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(svg.id) }}
                >
                  {isSelected && (
                    <>
                      <div className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                    </>
                  )}
                  {svg.url && svg.url.startsWith('<svg') ? (
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: svg.url }} />
                  ) : (
                    <img
                      src={getAssetUrl(svg.url)}
                      alt="SVG Layer"
                      className="w-full h-full object-contain pointer-events-none"
                      onError={(e) => {
                        // Fix #7: surface broken SVG assets instead of silent blank.
                        console.warn('[Preview] svg overlay failed to load:', getAssetUrl(svg.url))
                        const el = e.currentTarget
                        el.style.background = 'repeating-linear-gradient(45deg,rgba(239,68,68,0.15),rgba(239,68,68,0.15)10px,rgba(239,68,68,0.3)10px,rgba(239,68,68,0.3)20px)'
                        el.style.outline = '1px dashed rgba(239,68,68,0.7)'
                        el.alt = 'SVG failed to load'
                      }}
                    />
                  )}
                </Rnd>
              </div>
            )
          })}

          {/* Gradient Overlays */}
          {(() => {
            const getGradientCss = (direction: string, stops: [string, string]) => {
              const dirMap: Record<string, string> = {
                'top-to-bottom': 'to bottom',
                'bottom-to-top': 'to top',
                'left-to-right': 'to right',
                'right-to-left': 'to left',
                'radial': 'circle'
              }
              const dir = dirMap[direction] || 'to bottom'
              if (dir === 'circle') {
                return `radial-gradient(circle, ${stops[0]}, ${stops[1]})`
              }
              return `linear-gradient(${dir}, ${stops[0]}, ${stops[1]})`
            }

            return gradientOverlays.map((grad) => {
              const isActive = currentTime >= grad.startTime && currentTime <= grad.endTime
              if (!isActive) return null
              const isSelected = selectedOverlayId === grad.id

              // Region layout — parity with server generateGradientPng pixel
              // bands (videoRenderService.js): lower-third = bottom 33%
              // (y0=0.67H), top-bar = top 20%, top-half = top 50%, bottom-half =
              // bottom 50%, full = entire frame. Expressed here as percent of the
              // container so it lands identically at any aspect ratio.
              const region = grad.region || 'full'
              const width = 100
              const x = 0
              let y = 0
              let height = 100
              if (region === 'lower-third') { y = 67; height = 33 }
              else if (region === 'top-bar') { y = 0; height = 20 }
              else if (region === 'top-half') { y = 0; height = 50 }
              else if (region === 'bottom-half') { y = 50; height = 50 }

              return (
                <div
                  key={grad.id}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ opacity: grad.opacity, zIndex: 10 + (grad.layer || 0) }}
                >
                  <Rnd
                    bounds="parent"
                    position={{ x: (x / 100) * containerW, y: (y / 100) * containerH }}
                    size={{ width: `${width}%`, height: `${height}%` }}
                    className={`pointer-events-auto ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/50'}`}
                    disableDragging={isPlaying}
                    onMouseDown={(e) => { e.stopPropagation(); onSelectOverlay?.(grad.id) }}
                  >
                    {isSelected && (
                      <>
                        <div className="absolute top-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mt-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -ml-1.5 rounded-full z-50 pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-white border-2 border-indigo-500 -mb-1.5 -mr-1.5 rounded-full z-50 pointer-events-none" />
                      </>
                    )}
                    <div
                      className="w-full h-full"
                      style={{
                        background: getGradientCss(grad.direction, grad.colorStops),
                      }}
                    />
                  </Rnd>
                </div>
              )
            })
          })()}
        </div>

        {/* HUD Elements */}
        <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300">
          <div className="flex justify-between items-start">
            <div className="px-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg">
              <span className="text-[11px] font-medium text-white/80">Preview</span>
            </div>
            <div className="px-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg">
              <span className="text-[11px] text-white/50 font-mono tabular-nums">{videoDimensions?.w ?? 0}×{videoDimensions?.h ?? 0}</span>
            </div>
          </div>

          <div className="flex justify-between items-end">
            <div className="px-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-white/40">Latency</span>
              <span className="text-[11px] font-mono tabular-nums text-white/80">{latency}ms</span>
            </div>

            <div className="px-4 py-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-5 pointer-events-auto">
              <button type="button" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'} className="text-white hover:text-primary-400 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button type="button" onClick={handleBeforeAfterToggle} aria-label="Toggle before/after" title="Before / after" className={`transition-colors ${showAppliedFilters ? 'text-primary-400' : 'text-white/40 hover:text-white/70'}`}>
                {showAppliedFilters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Framing Corners — subtle */}
        <div className="absolute top-8 left-8 w-5 h-5 border-t border-l border-white/10 pointer-events-none" />
        <div className="absolute top-8 right-8 w-5 h-5 border-t border-r border-white/10 pointer-events-none" />
        <div className="absolute bottom-8 left-8 w-5 h-5 border-b border-l border-white/10 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-5 h-5 border-b border-r border-white/10 pointer-events-none" />

        {/* AI styling active — quiet, honest indicator (no fabricated metrics) */}
        <AnimatePresence>
          {isNeuralActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none z-40"
            >
              <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2">
                <Fingerprint className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-[11px] font-medium text-white/80 leading-none">AI styling active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Filter Overlays */}
        {vignetteOpacity > 0 && (
          <div className="absolute inset-0 pointer-events-none video-vignette" style={{ '--vignette-opacity': vignetteOpacity } as any} />
        )}
      </div>
    </>
  );
};

export default RealTimeVideoPreview
