'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './EditorComponents.css'
import {
  Layers,
  Clock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ScanSearch,
  Focus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Copy,
  Lock,
  Eye,
  EyeOff,
  Type,
  Image as ImageIcon,
  Scissors,
  MapPin,
  Magnet,
  Orbit,
  Zap,
  Radio,
  Fingerprint,
  Link,
  SplitSquareHorizontal,
  ArrowLeftRight,
  Activity,
  Video,
  Film,
  MessageSquare,
  Wand2
} from 'lucide-react'
import {
  TimelineSegment,
  TimelineEffect,
  TimelineMarker,
  TransformKeyframe,
  EFFECT_TYPE_COLORS,
  SegmentTransitionType,
  TextOverlay,
  ImageOverlay,
  ALL_TIMELINE_TRACKS,
  VIDEO_TRACKS,
  AUDIO_TRACKS,
  Transcript,
  AIDirectorSuggestion,
  EngagementScore
} from '../../types/editor'
import { formatTime, formatTimeDetailed, formatTimePrecise, formatTimeFrames, parseTime, snapToGrid, SNAP_STEPS, resolveTimelineOverlaps, rippleDeleteAcrossTracks, intersectsRange } from '../../utils/editorUtils'
import { getSegmentColor } from '../../utils/editorUtils'
import { buildSnapIndex, snapWithIndex, speechStopsFromWords, SPEECH_KINDS, type SnapIndex, type SnapKind, type SnapResult } from '../../utils/snapIndex'
import { realignOverlaysToSpeech } from '../../utils/captionAlign'
import { apiGet } from '../../lib/api'

/** Per-lane track state: locked rejects edits, muted hides from preview, solo isolates. */
export interface TrackLaneState {
  locked?: boolean
  muted?: boolean
  solo?: boolean
}

interface ResizableTimelineProps {
  duration: number
  currentTime: number
  segments: TimelineSegment[]
  onTimeUpdate: (time: number) => void
  onSegmentsChange?: (fn: (prev: TimelineSegment[]) => TimelineSegment[]) => void
  selectedSegmentId?: string | null
  selectedSegmentIds?: string[]
  onSegmentSelect?: (id: string | null, addToSelection?: boolean) => void
  onSegmentDeleted?: () => void
  effects?: TimelineEffect[]
  onEffectsChange?: (fn: (prev: TimelineEffect[]) => TimelineEffect[]) => void
  selectedEffectId?: string | null
  onEffectSelect?: (id: string | null) => void
  onEffectDeleted?: () => void
  textOverlays?: TextOverlay[]
  onTextOverlaysChange?: (fn: (prev: TextOverlay[]) => TextOverlay[]) => void
  imageOverlays?: ImageOverlay[]
  onDuplicateSegmentAtPlayhead?: (segmentId: string) => void
  isPlaying?: boolean
  onPlayPause?: () => void
  density?: 'compact' | 'comfortable' | 'expanded'
  trackVisibility?: Record<number, boolean>
  onTrackVisibilityChange?: (trackIndex: number, visible: boolean) => void
  /** Per-track lock/mute/solo state keyed by track index. Optional + backward compatible. */
  trackState?: Record<number, TrackLaneState>
  onTrackStateChange?: (trackIndex: number, patch: Partial<TrackLaneState>) => void
  markers?: TimelineMarker[]
  onMarkersChange?: (fn: (prev: TimelineMarker[]) => TimelineMarker[]) => void
  onAssetDrop?: (asset: any, trackIndex: number, time: number) => void
  transcript?: Transcript | null
  /** Detected music beat times (seconds). When provided, clips/captions also snap
   *  to the beat grid — a differentiator no major competitor ships. */
  beatTimes?: number[]
  aiDirectorSuggestions?: AIDirectorSuggestion[]
  engagementScore?: EngagementScore | null
  /** Source the waveform peaks are decoded from. Either is enough; videoSrc wins. */
  videoSrc?: string | null
  contentId?: string | null
}

/** Minimum allowed duration (seconds) so an edge drag can never invert or zero a clip/overlay. */
const MIN_SEG_DURATION = 0.05
const STORAGE_KEY_TIME_FORMAT = 'click-timeline-time-format'
const STORAGE_KEY_FPS = 'click-timeline-fps'
const STORAGE_KEY_ZOOM = 'click-timeline-zoom'
const STORAGE_KEY_SNAP = 'click-timeline-snap'
const STORAGE_KEY_SNAP_SPEECH = 'click-timeline-snap-speech'
type TimeFormatPreference = 'short' | 'tenths' | 'frames'

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

/** Colour + label for the live active-snap guideline, by snapped stop kind. */
const SNAP_KIND_COLOR: Record<SnapKind, string> = {
  word: '#34d399', silence: '#22d3ee', beat: '#f472b6', marker: '#fbbf24',
  edge: '#818cf8', playhead: '#a78bfa', boundary: '#94a3b8',
}
const SNAP_KIND_LABEL: Record<SnapKind, string> = {
  word: 'Word', silence: 'Pause', beat: 'Beat', marker: 'Marker',
  edge: 'Edge', playhead: 'Playhead', boundary: 'Bound',
}

const ResizableTimeline: React.FC<ResizableTimelineProps> = ({ duration, currentTime, segments, onTimeUpdate, onSegmentsChange, selectedSegmentId: selectedSegmentIdProp, selectedSegmentIds: selectedSegmentIdsProp, onSegmentSelect, onSegmentDeleted, effects = [], onEffectsChange, selectedEffectId, onEffectSelect, onEffectDeleted, textOverlays = [], onTextOverlaysChange, imageOverlays = [], onDuplicateSegmentAtPlayhead, isPlaying, onPlayPause, density = 'comfortable', trackVisibility = {}, onTrackVisibilityChange, trackState: trackStateProp, onTrackStateChange, markers: controlledMarkers, onMarkersChange, onAssetDrop, transcript, beatTimes = [], aiDirectorSuggestions = [], engagementScore = null, videoSrc = null, contentId = null }) => {
  const [timelineMode, setTimelineMode] = useState<'hybrid' | 'visual' | 'text'>('hybrid')
  const [focusLane, setFocusLane] = useState<string | null>(null)

  const selectedIds = useMemo(() => selectedSegmentIdsProp ?? (selectedSegmentIdProp ? [selectedSegmentIdProp] : []), [selectedSegmentIdsProp, selectedSegmentIdProp])
  const selectedSegmentId = selectedSegmentIdProp ?? selectedIds[0] ?? null
  const selectedSegment = useMemo(() => segments.find(s => s.id === selectedSegmentId), [segments, selectedSegmentId])

  const currentScene = useMemo(() => {
    return transcript?.scenes?.find(s => currentTime >= s.startTime && currentTime <= s.endTime) || null
  }, [transcript?.scenes, currentTime])

  const currentSection = useMemo(() => {
    if (!currentScene) return null
    return currentScene.title
  }, [currentScene])
  const [timestampInput, setTimestampInput] = useState('')
  const [isSnapPulse, setIsSnapPulse] = useState(false)
  const snapPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSnapPulse = useCallback(() => {
    setIsSnapPulse(true)
    if (snapPulseTimeoutRef.current) clearTimeout(snapPulseTimeoutRef.current)
    snapPulseTimeoutRef.current = setTimeout(() => setIsSnapPulse(false), 400)
  }, [])

  const [timeFormat, setTimeFormat] = useState<TimeFormatPreference>(() => {
    if (typeof window === 'undefined') return 'short'
    const v = localStorage.getItem(STORAGE_KEY_TIME_FORMAT) as TimeFormatPreference | null
    return (v === 'short' || v === 'tenths' || v === 'frames') ? v : 'short'
  })
  const [framesPerSecond, setFramesPerSecond] = useState<24 | 30>(() => {
    if (typeof window === 'undefined') return 30
    const v = localStorage.getItem(STORAGE_KEY_FPS)
    return v === '24' ? 24 : 30
  })
  const [snapEnabled, setSnapEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    const v = localStorage.getItem(STORAGE_KEY_SNAP)
    return v !== 'false'
  })
  // Snap-to-Speech: magnetically lock clips/captions to Whisper word boundaries.
  // Default ON (matches CapCut per-word sync / VEED "Snap to Speech"); persisted.
  const [snapToSpeech, setSnapToSpeech] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(STORAGE_KEY_SNAP_SPEECH) !== 'false'
  })
  const [snapStepIndex, setSnapStepIndex] = useState(2)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [zoom, setZoom] = useState(() => {
    if (typeof window === 'undefined') return 1
    const v = localStorage.getItem(STORAGE_KEY_ZOOM)
    const n = parseFloat(v || '1')
    return Number.isFinite(n) && n >= 0.5 && n <= 4 ? n : 1
  })

  // REAL audio peaks for the waveform track. Fetched from the backend
  // (ffmpeg-decoded PCM), cached per-source. No fabricated/synthetic data:
  // while loading or when the source has no audio we render a flat baseline.
  const WAVEFORM_BUCKETS = 400
  const peaksCacheRef = useRef<Map<string, number[]>>(new Map())
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([])
  const [waveformHasAudio, setWaveformHasAudio] = useState(false)
  const waveformWarnedRef = useRef(false)

  // The cache/fetch key: prefer the explicit source URL, else the contentId.
  const waveformKey = useMemo(() => videoSrc || (contentId ? `id:${contentId}` : null), [videoSrc, contentId])

  useEffect(() => {
    if (!waveformKey) {
      setWaveformPeaks([])
      setWaveformHasAudio(false)
      return
    }
    // Serve from cache instantly when we've already decoded this source.
    const cached = peaksCacheRef.current.get(waveformKey)
    if (cached) {
      setWaveformPeaks(cached)
      setWaveformHasAudio(cached.length > 0)
      return
    }

    let cancelled = false
    const params = new URLSearchParams({ buckets: String(WAVEFORM_BUCKETS) })
    if (videoSrc) params.set('videoUrl', videoSrc)
    else if (contentId) params.set('contentId', contentId)

    apiGet<{ data?: { peaks?: number[]; hasAudio?: boolean } }>(
      `/video/manual-editing/waveform-peaks?${params.toString()}`
    )
      .then((res) => {
        if (cancelled) return
        const payload = res?.data ?? (res as any)
        const peaks: number[] = Array.isArray(payload?.peaks) ? payload.peaks : []
        const hasAudio = !!payload?.hasAudio && peaks.length > 0
        peaksCacheRef.current.set(waveformKey, hasAudio ? peaks : [])
        setWaveformPeaks(hasAudio ? peaks : [])
        setWaveformHasAudio(hasAudio)
      })
      .catch(() => {
        if (cancelled) return
        // Resilient: never crash the timeline. Flat baseline + a one-time warn.
        if (!waveformWarnedRef.current) {
          waveformWarnedRef.current = true
          console.warn('[ResizableTimeline] Failed to load audio waveform peaks; showing flat baseline.')
        }
        setWaveformPeaks([])
        setWaveformHasAudio(false)
      })

    return () => { cancelled = true }
  }, [waveformKey, videoSrc, contentId])

  // SVG path for the waveform track (viewBox 0 0 100 48, baseline at y=24).
  // Real peaks (0..1) → a symmetric envelope scaled to the track height. When
  // there are no peaks (loading / no audio / fetch failure) we draw a flat
  // baseline — never a fabricated wave.
  const waveformPath = useMemo(() => {
    if (!waveformPeaks.length) return 'M 0 24 L 100 24'
    const n = waveformPeaks.length
    const amp = 22 // max half-height within the 48-unit viewBox
    const up = waveformPeaks.map((p, i) => {
      const x = (i * 100) / (n - 1 || 1)
      return `L ${x.toFixed(3)} ${(24 - Math.max(0, Math.min(1, p)) * amp).toFixed(3)}`
    }).join(' ')
    const down = waveformPeaks.map((p, i) => {
      const x = ((n - 1 - i) * 100) / (n - 1 || 1)
      return `L ${x.toFixed(3)} ${(24 + Math.max(0, Math.min(1, waveformPeaks[n - 1 - i])) * amp).toFixed(3)}`
    }).join(' ')
    return `M 0 24 ${up} ${down} Z`
  }, [waveformPeaks])
  // REAL clip thumbnails (filmstrip) for VIDEO/IMAGE segments. Fetched from the
  // backend (ffmpeg-extracted JPEG frames), cached per source URL — mirrors the
  // waveform-peaks pattern. No fabrication: while loading or on failure the
  // segment keeps its solid color. Audio segments are never fetched.
  const FILMSTRIP_COUNT = 8
  const filmstripCacheRef = useRef<Map<string, string[]>>(new Map())
  const [filmstrips, setFilmstrips] = useState<Record<string, string[]>>({})
  const filmstripInFlightRef = useRef<Set<string>>(new Set())
  const filmstripWarnedRef = useRef(false)

  // Distinct source URLs for visual (video/image) segments currently in the
  // timeline. Audio segments are excluded — thumbnails are meaningless there.
  const filmstripSources = useMemo(() => {
    const urls = new Set<string>()
    for (const s of segments) {
      const isVisual = s.type === 'video' || s.type === 'image' || s.type === 'broll' || s.type === 'gif'
      if (!isVisual) continue
      const url = s.sourceUrl || (s.track < 6 ? videoSrc : null)
      if (url) urls.add(url)
    }
    return Array.from(urls)
  }, [segments, videoSrc])

  useEffect(() => {
    let cancelled = false
    for (const url of filmstripSources) {
      // Serve from cache / skip if already loaded or being fetched.
      if (filmstripCacheRef.current.has(url) || filmstripInFlightRef.current.has(url)) {
        const cached = filmstripCacheRef.current.get(url)
        if (cached && !filmstrips[url]) setFilmstrips((prev) => ({ ...prev, [url]: cached }))
        continue
      }
      filmstripInFlightRef.current.add(url)
      const params = new URLSearchParams({ videoUrl: url, count: String(FILMSTRIP_COUNT) })
      apiGet<{ data?: { frames?: string[] } }>(
        `/video/manual-editing/filmstrip?${params.toString()}`
      )
        .then((res) => {
          if (cancelled) return
          const payload = res?.data ?? (res as any)
          const frames: string[] = Array.isArray(payload?.frames) ? payload.frames : []
          filmstripCacheRef.current.set(url, frames)
          if (frames.length) setFilmstrips((prev) => ({ ...prev, [url]: frames }))
        })
        .catch(() => {
          if (cancelled) return
          // Resilient: cache an empty strip so we don't retry; keep solid color.
          filmstripCacheRef.current.set(url, [])
          if (!filmstripWarnedRef.current) {
            filmstripWarnedRef.current = true
            console.warn('[ResizableTimeline] Failed to load clip filmstrip; keeping solid clip color.')
          }
        })
        .finally(() => { filmstripInFlightRef.current.delete(url) })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmstripSources])

  // Resolve the filmstrip frames for a given segment (null when none loaded).
  const filmstripForSegment = useCallback((s: TimelineSegment): string[] | null => {
    const url = s.sourceUrl || (s.track < 6 ? videoSrc : null)
    if (!url) return null
    const frames = filmstrips[url]
    return frames && frames.length ? frames : null
  }, [filmstrips, videoSrc])

  // CSS background for a tiled filmstrip across a clip block. Frames are laid
  // out as evenly-spaced cover-cropped slices via multiple background-images.
  const filmstripStyle = useCallback((frames: string[]): React.CSSProperties => {
    const n = frames.length
    // Each frame occupies an even horizontal slice; `auto 100%` makes it cover
    // the lane height and crop horizontally (object-fit: cover semantics).
    return {
      backgroundImage: frames.map((f) => `url(${f})`).join(', '),
      backgroundRepeat: frames.map(() => 'no-repeat').join(', '),
      backgroundSize: frames.map(() => 'auto 100%').join(', '),
      backgroundPosition: frames.map((_, i) => `${n > 1 ? (i / (n - 1)) * 100 : 0}% center`).join(', '),
    }
  }, [])

  // --- Dedicated KEYFRAME LANE state/handlers (for the selected segment) ---
  // Currently-selected keyframe in the dedicated lane (for click-select + Delete).
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null)
  // Drop the keyframe selection whenever the selected clip changes.
  useEffect(() => { setSelectedKeyframeId(null) }, [selectedSegmentId])

  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [rulerHoverTime, setRulerHoverTime] = useState<number | null>(null)
  const [draggingSegmentId, setDraggingSegmentId] = useState<string | null>(null)
  const [inPoint, setInPoint] = useState<number | null>(null)
  const [outPoint, setOutPoint] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segmentId: string; type: 'segment' | 'marker' } | null>(null)
  const [internalMarkers, setInternalMarkers] = useState<TimelineMarker[]>([])
  const [rippleOnDelete, setRippleOnDelete] = useState(false)
  const markers = controlledMarkers ?? internalMarkers
  const setMarkersList = onMarkersChange ?? setInternalMarkers

  // --- Per-track lock / mute / solo state (uncontrolled fallback when no prop given) ---
  const [internalTrackState, setInternalTrackState] = useState<Record<number, TrackLaneState>>({})
  const trackState = trackStateProp ?? internalTrackState
  const setTrackStatePatch = useCallback((trackIndex: number, patch: Partial<TrackLaneState>) => {
    if (onTrackStateChange) onTrackStateChange(trackIndex, patch)
    else setInternalTrackState((prev) => ({ ...prev, [trackIndex]: { ...prev[trackIndex], ...patch } }))
  }, [onTrackStateChange])

  // Lanes are visual groupings of underlying track indices. Track-state buttons
  // act on the representative track index for each lane; segment lookups treat a
  // lane's whole index range as sharing that state.
  const laneTrackIndex = useCallback((lane: 'captions' | 'a-roll' | 'b-roll' | 'audio'): number => {
    switch (lane) {
      case 'captions': return 4   // V5 Graphics (text/captions)
      case 'a-roll': return 0     // V1 A-Roll
      case 'b-roll': return 2     // V3 B-Roll
      case 'audio': return 6      // A1 Audio
    }
  }, [])

  // Resolve effective state for a given segment's track index, honouring lane grouping.
  const trackStateForIndex = useCallback((trackIndex: number): TrackLaneState => {
    let lane: number
    if (trackIndex < 2) lane = 0
    else if (trackIndex < 5) lane = 2
    else if (trackIndex === 5 || trackIndex === 4) lane = 4
    else lane = 6
    // captions lane (4) and a-roll lane (0): track 4 is captions, tracks 0/1 are a-roll
    if (trackIndex === 4) lane = 4
    return trackState[lane] ?? {}
  }, [trackState])

  const anySolo = useMemo(() => Object.values(trackState).some((s) => s?.solo), [trackState])

  const isTrackLocked = useCallback((trackIndex: number) => !!trackStateForIndex(trackIndex).locked, [trackStateForIndex])
  const isSegmentLocked = useCallback((id: string) => {
    const seg = segments.find((s) => s.id === id)
    return seg ? isTrackLocked(seg.track) : false
  }, [segments, isTrackLocked])

  // --- Dedicated KEYFRAME LANE handlers (operate on the selected segment) ---
  // Clamp + retime a keyframe of the selected segment, routed through the
  // existing onSegmentsChange path. The time is kept within the clip range.
  const retimeSegmentKeyframe = useCallback((segId: string, kfId: string, newTime: number) => {
    if (!onSegmentsChange) return
    onSegmentsChange((prev) => prev.map((seg) => {
      if (seg.id !== segId || !seg.transformKeyframes) return seg
      if (isSegmentLocked(seg.id)) return seg // respect lock state
      const clamped = Math.max(seg.startTime, Math.min(seg.endTime, newTime))
      return {
        ...seg,
        transformKeyframes: seg.transformKeyframes
          .map((k) => (k.id === kfId ? { ...k, time: clamped } : k))
          .sort((a, b) => a.time - b.time),
      }
    }))
  }, [onSegmentsChange, isSegmentLocked])

  // Add a keyframe to the selected segment at the given absolute time. Snapshots
  // the current transform (identity fallback) so the new keyframe is sensible.
  const addSegmentKeyframe = useCallback((segId: string, atTime: number) => {
    if (!onSegmentsChange) return
    onSegmentsChange((prev) => prev.map((seg) => {
      if (seg.id !== segId) return seg
      if (isSegmentLocked(seg.id)) return seg // respect lock state
      const clamped = Math.max(seg.startTime, Math.min(seg.endTime, atTime))
      const tr = seg.transform || {}
      const newKf: TransformKeyframe = {
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: clamped,
        positionX: tr.positionX ?? 0,
        positionY: tr.positionY ?? 0,
        scale: tr.scale ?? 1,
        rotation: tr.rotation ?? 0,
        opacity: 1,
        easing: 'ease-in-out',
      }
      const next = [...(seg.transformKeyframes || []), newKf].sort((a, b) => a.time - b.time)
      return { ...seg, transformKeyframes: next }
    }))
  }, [onSegmentsChange, isSegmentLocked])

  // Remove a keyframe from the selected segment.
  const removeSegmentKeyframe = useCallback((segId: string, kfId: string) => {
    if (!onSegmentsChange) return
    onSegmentsChange((prev) => prev.map((seg) => {
      if (seg.id !== segId || !seg.transformKeyframes) return seg
      if (isSegmentLocked(seg.id)) return seg // respect lock state
      return { ...seg, transformKeyframes: seg.transformKeyframes.filter((k) => k.id !== kfId) }
    }))
  }, [onSegmentsChange, isSegmentLocked])

  // --- Mock Stakeholder Comments ---
  const [mockComments, setMockComments] = useState([
     { id: 'c1', time: 2.5, author: 'Acme Client', text: 'Make this logo bigger if possible.', resolved: false },
     { id: 'c2', time: 8.1, author: 'Sarah J.', text: 'Audio mix is too loud here, duck it more.', resolved: false }
  ])
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY_TIME_FORMAT, timeFormat)
    localStorage.setItem(STORAGE_KEY_FPS, String(framesPerSecond))
    localStorage.setItem(STORAGE_KEY_SNAP, String(snapEnabled))
    localStorage.setItem(STORAGE_KEY_SNAP_SPEECH, String(snapToSpeech))
    localStorage.setItem(STORAGE_KEY_ZOOM, String(zoom))
  }, [timeFormat, framesPerSecond, snapEnabled, snapToSpeech, zoom])

  const displayTime = useCallback((time: number) => {
    if (timeFormat === 'short') return formatTime(time)
    if (timeFormat === 'tenths') return formatTimePrecise(time, 1)
    return formatTimeFrames(time, framesPerSecond)
  }, [timeFormat, framesPerSecond])

  const dragSegmentStartRef = useRef<{ x: number; y: number; startTime: number; endTime: number; track: number } | null>(null)
  const [draggingEdgeId, setDraggingEdgeId] = useState<string | null>(null)
  const dragEdgeStartRef = useRef<{ id: string, edge: 'start' | 'end', startX: number, startTime: number, endTime: number } | null>(null)

  const seekRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const userSeekRef = useRef(false)
  const maxDur = Math.max(duration || 1, 0.1)

  // LOGARITHMIC / FISH-EYE MAPPING HELPERS (Lens View around Playhead)
  const timeToX = useCallback((t: number) => {
    if (maxDur <= 0) return 0
    return (t / maxDur) * 100
  }, [maxDur])

  const xToTime = useCallback((percent: number) => {
    return (percent / 100) * maxDur
  }, [maxDur])

  const [visibleTimeRange, setVisibleTimeRange] = useState<{ start: number; end: number } | null>(null)

  useEffect(() => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl || maxDur <= 0) return
    const update = () => {
      // Bug 7: the visible fraction must be relative to the FULL zoomed content
      // width (scrollWidth), not the viewport width (offsetWidth). Using offsetWidth
      // made the fractions scale wrong at zoom>1, so the mini-map viewport and
      // visible-word culling drifted as you zoomed.
      const totalWidth = Math.max(scrollEl.scrollWidth, contentEl.scrollWidth, 1)
      const sw = scrollEl.clientWidth
      if (totalWidth <= 0) return
      const buffer = 0.05
      const startFrac = Math.max(0, scrollEl.scrollLeft / totalWidth - buffer)
      const endFrac = Math.min(1, (scrollEl.scrollLeft + sw) / totalWidth + buffer)
      setVisibleTimeRange({ start: startFrac * maxDur, end: endFrac * maxDur })
    }
    update()
    scrollEl.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(scrollEl)
    ro.observe(contentEl)
    return () => { scrollEl.removeEventListener('scroll', update); ro.disconnect() }
  }, [maxDur, zoom])

  const visibleWords = useMemo(() => {
    if (!transcript?.words) return []
    if (!visibleTimeRange) return transcript.words
    const buffer = 2 // 2 seconds leeway
    const s = visibleTimeRange.start - buffer
    const e = visibleTimeRange.end + buffer
    return transcript.words.filter(w => w.end >= s && w.start <= e)
  }, [transcript?.words, visibleTimeRange])

  const progress = timeToX(currentTime)
  const snapStep = SNAP_STEPS[Math.min(snapStepIndex, SNAP_STEPS.length - 1)]
  const stepAmount = snapEnabled ? snapStep : 0.25

  const magneticEdges = useMemo(() => {
    const edges: number[] = [0, maxDur]
    segments.forEach((s) => { edges.push(s.startTime, s.endTime) })
    effects.forEach((e) => { edges.push(e.startTime, e.endTime) })
    return edges
  }, [maxDur, segments, effects])

  // Phase 2 — Snap-to-Speech: derive word + silence-gap stops from the Whisper
  // transcript once per transcript change (NOT per drag frame).
  const speechStops = useMemo(
    () => (snapToSpeech ? speechStopsFromWords(transcript?.words) : { words: [], silences: [] }),
    [snapToSpeech, transcript?.words],
  )

  // The precomputed, sorted, de-duped snap index queried per frame with a binary
  // search. Replaces the legacy per-frame Set-build + full re-sort inside
  // snapToNearestEdge — O(log n) per query instead of O(n·log n).
  const snapIndex: SnapIndex = useMemo(
    () => buildSnapIndex({
      edges: magneticEdges,
      words: speechStops.words,
      silences: speechStops.silences,
      beats: beatTimes,
      duration: maxDur,
    }),
    [magneticEdges, speechStops, beatTimes, maxDur],
  )

  // Active-snap guideline: the stop the current drag is locked onto (word/beat/edge…).
  // Updated only when the snapped stop CHANGES, so it adds no per-frame re-renders.
  const [activeSnap, setActiveSnap] = useState<{ time: number; kind: SnapKind } | null>(null)
  const activeSnapKeyRef = useRef<string>('')
  const noteSnap = useCallback((r: SnapResult | null) => {
    const key = r && r.snapped && r.kind ? `${r.kind}:${r.stop.toFixed(3)}` : ''
    if (key === activeSnapKeyRef.current) return
    activeSnapKeyRef.current = key
    setActiveSnap(r && r.snapped && r.kind ? { time: r.stop, kind: r.kind } : null)
  }, [])

  // Snap one point to the nearest stop (speech-preferred), grid as the fallback.
  const snapPoint = useCallback((value: number, threshold: number, exclude?: number[]): number => {
    const r = snapWithIndex(value, snapIndex, threshold, { exclude, preferKinds: SPEECH_KINDS })
    noteSnap(r)
    return r.snapped ? r.time : snapToGrid(value, snapStep)
  }, [snapIndex, snapStep, noteSnap])

  // Snap a moved block: try snapping BOTH its start and end to stops, keep whichever
  // edge lands nearer a stop, else fall back to grid. Returns the new start time.
  // `exclude` holds the block's own original edges so it never snaps to itself.
  const snapMovedBlockStart = useCallback((rawStart: number, dur: number, exclude: number[]): number => {
    const th = snapStep * 1.5
    const rStart = snapWithIndex(rawStart, snapIndex, th, { exclude, preferKinds: SPEECH_KINDS })
    const rEnd = snapWithIndex(rawStart + dur, snapIndex, th, { exclude, preferKinds: SPEECH_KINDS })
    const dStart = rStart.snapped ? Math.abs(rStart.time - rawStart) : Infinity
    const dEnd = rEnd.snapped ? Math.abs(rEnd.time - (rawStart + dur)) : Infinity
    if (dStart === Infinity && dEnd === Infinity) { noteSnap(null); return snapToGrid(rawStart, snapStep) }
    const chosen = dStart <= dEnd ? rStart : rEnd
    noteSnap(chosen)
    return dStart <= dEnd ? rStart.time : rEnd.time - dur
  }, [snapIndex, snapStep, noteSnap])

  // One-click "Re-align ALL captions to speech": re-time every text/caption overlay
  // to the Whisper word boundaries at once — the fix competitors only do per-line.
  const [captionRealignNote, setCaptionRealignNote] = useState<string | null>(null)
  const captionRealignNoteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRealignCaptions = useCallback(() => {
    const words = transcript?.words
    if (!onTextOverlaysChange || !words?.length || textOverlays.length === 0) return
    const { overlays, changed } = realignOverlaysToSpeech(textOverlays, words)
    onTextOverlaysChange(() => overlays)
    setCaptionRealignNote(changed > 0 ? `Snapped ${changed} caption${changed === 1 ? '' : 's'} to speech` : 'Captions already aligned')
    if (captionRealignNoteTimeout.current) clearTimeout(captionRealignNoteTimeout.current)
    captionRealignNoteTimeout.current = setTimeout(() => setCaptionRealignNote(null), 2600)
  }, [transcript?.words, onTextOverlaysChange, textOverlays])

  const segmentAtPlayhead = useMemo(() =>
    segments.find((s) => currentTime >= s.startTime && currentTime < s.endTime),
    [segments, currentTime])

  // Bug 5: `live` = continuous scrub (no coarse grid snap, so the preview follows
  // the playhead smoothly). On click/release we still snap for precise landing.
  const seekTo = useCallback((clientX: number, live = false) => {
    const contentEl = contentRef.current
    if (!contentEl) return
    const innerEl = contentEl.firstElementChild as HTMLElement
    if (!innerEl) return

    const rect = innerEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let t = x * maxDur

    if (snapEnabled && !live) {
      const r = snapWithIndex(t, snapIndex, snapStep * 1.2, { preferKinds: SPEECH_KINDS })
      if (r.snapped) {
        t = r.time
        triggerSnapPulse()
      } else {
        const tGrid = snapToGrid(t, snapStep)
        if (tGrid !== t) triggerSnapPulse()
        t = tGrid
      }
    }
    userSeekRef.current = true
    onTimeUpdate(Math.max(0, Math.min(maxDur, t)))
  }, [maxDur, snapEnabled, snapStep, snapIndex, onTimeUpdate, triggerSnapPulse])

  useEffect(() => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl || zoom <= 1) return
    const scrollWidth = scrollEl.scrollWidth
    const clientWidth = scrollEl.clientWidth
    if (scrollWidth <= 0) return
    // Bug 7: playhead position must be measured against the full zoomed content
    // (scrollWidth), not the viewport (offsetWidth), so the playhead stays centered
    // and doesn't jump when zooming.
    const playheadPosition = (currentTime / maxDur) * scrollWidth
    const targetScroll = Math.max(0, Math.min(scrollWidth - clientWidth, playheadPosition - clientWidth / 2))
    if (userSeekRef.current) {
      scrollEl.scrollTo({ left: targetScroll, behavior: 'smooth' })
      userSeekRef.current = false
    } else {
      scrollEl.scrollLeft = targetScroll
    }
  }, [currentTime, maxDur, zoom])

  const handleGoToTimestamp = () => {
    let t = parseTime(timestampInput, maxDur)
    if (snapEnabled) {
      t = snapPoint(t, snapStep * 1.2)
    }
    userSeekRef.current = true
    onTimeUpdate(Math.max(0, Math.min(maxDur, t)))
    setTimestampInput(formatTimeDetailed(t))
  }

  useEffect(() => {
    if (!isScrubbing) return
    // Bug 5: rAF-throttle live scrub so the preview follows smoothly (one update
    // per frame) without a heavy debounce; coalesce intra-frame moves.
    let rafId: number | null = null
    let pendingX: number | null = null
    let lastX = 0
    const flush = () => {
      rafId = null
      if (pendingX !== null) { lastX = pendingX; seekTo(pendingX, true); pendingX = null }
    }
    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }
    const onUp = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      // Final landing snaps to grid/edges for precision.
      seekTo(pendingX ?? lastX, false)
      pendingX = null
      setIsScrubbing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isScrubbing, seekTo])

  const stepTime = useCallback((dir: -1 | 1, bigStep = false) => {
    const amount = bigStep ? 5 : stepAmount
    const next = Math.max(0, Math.min(maxDur, currentTime + dir * amount))
    userSeekRef.current = true
    onTimeUpdate(snapEnabled && !bigStep ? snapToGrid(next, snapStep) : next)
  }, [currentTime, maxDur, stepAmount, snapStep, snapEnabled, onTimeUpdate])

  const deleteSegmentById = useCallback((id: string) => {
    if (!onSegmentsChange) return
    if (isSegmentLocked(id)) return // Bug 6: locked tracks reject delete
    onSegmentsChange((prev) => {
      const target = prev.find((seg) => seg.id === id)
      // Segment groups: deleting one member deletes the whole linked group,
      // except members on locked tracks (their lane rejects edits).
      if (target?.groupId) {
        return prev.filter((seg) =>
          seg.groupId !== target.groupId || isTrackLocked(seg.track)
        )
      }
      return prev.filter((seg) => seg.id !== id)
    })
    if (selectedSegmentId === id) onSegmentSelect?.(null)
    onSegmentDeleted?.()
  }, [onSegmentsChange, onSegmentSelect, onSegmentDeleted, selectedSegmentId, isSegmentLocked, isTrackLocked])

  const handleDeleteSelected = useCallback(() => {
    if (selectedEffectId && onEffectsChange) {
      onEffectsChange((prev) => prev.filter((eff) => eff.id !== selectedEffectId))
      onEffectSelect?.(null)
      onEffectDeleted?.()
      return
    }
    if (selectedIds.length > 0 && onSegmentsChange) {
      // Bug 6: never delete segments on locked tracks.
      const toRemove = segments.filter((s) => selectedIds.includes(s.id) && !isTrackLocked(s.track))
      if (toRemove.length === 0) return
      const removeIds = toRemove.map((s) => s.id)
      const rangeStart = Math.min(...toRemove.map((s) => s.startTime))
      const rangeEnd = Math.max(...toRemove.map((s) => s.endTime))
      onSegmentsChange((prev) => {
        const surviving = prev.filter((seg) => !removeIds.includes(seg.id))
        // Bug 3: true ripple — shift subsequent segments on ALL tracks to close the gap.
        if (rippleOnDelete && rangeEnd > rangeStart) {
          const locked = surviving.filter((s) => isTrackLocked(s.track)).map((s) => s.id)
          return rippleDeleteAcrossTracks(surviving, rangeStart, rangeEnd, locked)
        }
        return surviving
      })
      onSegmentSelect?.(null)
      onSegmentDeleted?.()
    }
  }, [selectedIds, selectedEffectId, segments, rippleOnDelete, onSegmentsChange, onEffectsChange, onEffectSelect, onSegmentSelect, onEffectDeleted, onSegmentDeleted, isTrackLocked])

  const handleDuplicateEffect = useCallback((effectId: string) => {
    if (!onEffectsChange) return
    onEffectsChange((prev) => {
      const effect = prev.find((e) => e.id === effectId)
      if (!effect) return prev
      const newEffect: TimelineEffect = {
        ...effect,
        id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        startTime: Math.min(effect.endTime, maxDur - 1),
        endTime: Math.min(effect.endTime + (effect.endTime - effect.startTime), maxDur),
      }
      return [...prev, newEffect]
    })
  }, [onEffectsChange, maxDur])

  const handleToggleEffect = useCallback((effectId: string) => {
    if (!onEffectsChange) return
    onEffectsChange((prev) => prev.map((e) => e.id === effectId ? { ...e, enabled: !e.enabled } : e))
  }, [onEffectsChange])

  const updateEffectEdge = useCallback((id: string, edge: 'start' | 'end', value: number) => {
    if (!onEffectsChange) return
    const v = Math.max(0, Math.min(maxDur, snapEnabled ? snapToGrid(value, snapStep) : value))
    onEffectsChange((prev) => prev.map((eff) => {
      if (eff.id !== id) return eff
      if (edge === 'start') {
        const start = Math.min(v, eff.endTime - 0.1)
        return { ...eff, startTime: start }
      }
      const end = Math.max(v, eff.startTime + 0.1)
      return { ...eff, endTime: Math.min(end, maxDur) }
    }))
  }, [maxDur, snapEnabled, snapStep, onEffectsChange])

  // --- VIRTUALIZATION WINDOW ---------------------------------------------
  // Expand the measured visible range by an overscan margin (±20% of the window
  // width) so items just outside the viewport are still mounted — this keeps
  // scrolling smooth and prevents pop-in at the edges. `visibleTimeRange` is
  // already recomputed only on scroll / zoom / resize (rAF-coalesced by the
  // browser's native scroll event), so this memo never causes per-frame storms.
  const virtualWindow = useMemo(() => {
    if (!visibleTimeRange) return null
    const width = Math.max(0, visibleTimeRange.end - visibleTimeRange.start)
    const overscan = width * 0.2
    return {
      start: Math.max(0, visibleTimeRange.start - overscan),
      end: Math.min(maxDur, visibleTimeRange.end + overscan),
    }
  }, [visibleTimeRange, maxDur])

  // An item must stay mounted while it is actively being dragged or is selected,
  // regardless of the window, so it can never vanish mid-drag near an edge.
  const isItemPinned = useCallback((id: string) => {
    return id === draggingSegmentId || id === draggingEdgeId || id === selectedEffectId || selectedIds.includes(id)
  }, [draggingSegmentId, draggingEdgeId, selectedEffectId, selectedIds])

  // Keep a timed [start,end] item if it intersects the overscan window OR is pinned.
  const isItemVisible = useCallback((id: string, start: number, end: number) => {
    return isItemPinned(id) || intersectsRange(start, end, virtualWindow)
  }, [isItemPinned, virtualWindow])

  const visibleSegments = useMemo(
    () => segments.filter((s) => isItemVisible(s.id, s.startTime, s.endTime)),
    [segments, isItemVisible])
  const visibleEffects = useMemo(
    () => effects.filter((e) => isItemVisible(e.id, e.startTime, e.endTime)),
    [effects, isItemVisible])
  const visibleTextOverlays = useMemo(
    () => textOverlays.filter((o) => isItemVisible(o.id, o.startTime, o.endTime)),
    [textOverlays, isItemVisible])
  const visibleMarkers = useMemo(
    () => markers.filter((m) => isItemPinned(m.id) || intersectsRange(m.time, m.time, virtualWindow)),
    [markers, isItemPinned, virtualWindow])

  // --- EFFECT LANE: drag-to-move + selection -----------------------------
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null)
  const dragEffectStartRef = useRef<{ id: string; startX: number; startTime: number; endTime: number } | null>(null)
  const [draggingEffectEdgeId, setDraggingEffectEdgeId] = useState<string | null>(null)
  const dragEffectEdgeStartRef = useRef<{ id: string; edge: 'start' | 'end'; startX: number; startTime: number; endTime: number } | null>(null)

  // Hide the active-snap guideline once nothing is being dragged.
  useEffect(() => {
    if (!draggingSegmentId && !draggingEffectId && !draggingEffectEdgeId) {
      activeSnapKeyRef.current = ''
      setActiveSnap(null)
    }
  }, [draggingSegmentId, draggingEffectId, draggingEffectEdgeId])

  // Move an effect block by a delta, keeping its duration and snapping like segments.
  const moveEffectTo = useCallback((id: string, originalStart: number, originalEnd: number, deltaTime: number) => {
    if (!onEffectsChange) return
    const effDur = originalEnd - originalStart
    let newStart = originalStart + deltaTime
    if (snapEnabled) {
      newStart = snapMovedBlockStart(newStart, effDur, [originalStart, originalEnd])
    }
    newStart = Math.max(0, Math.min(maxDur - effDur, newStart))
    const newEnd = newStart + effDur
    onEffectsChange((prev) => prev.map((eff) => eff.id === id ? { ...eff, startTime: newStart, endTime: Math.min(newEnd, maxDur) } : eff))
  }, [onEffectsChange, snapEnabled, snapMovedBlockStart, snapStep, maxDur])

  const handleEffectBodyMouseDown = useCallback((e: React.MouseEvent, eff: TimelineEffect) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    e.stopPropagation()
    onEffectSelect?.(eff.id)
    if (eff.locked) return // respect lock model — selectable but not draggable
    setDraggingEffectId(eff.id)
    dragEffectStartRef.current = { id: eff.id, startX: e.clientX, startTime: eff.startTime, endTime: eff.endTime }
  }, [onEffectSelect])

  const handleEffectEdgeMouseDown = useCallback((e: React.MouseEvent, eff: TimelineEffect, edge: 'start' | 'end') => {
    e.stopPropagation()
    onEffectSelect?.(eff.id)
    if (eff.locked) return
    setDraggingEffectEdgeId(eff.id)
    dragEffectEdgeStartRef.current = { id: eff.id, edge, startX: e.clientX, startTime: eff.startTime, endTime: eff.endTime }
  }, [onEffectSelect])

  // Effect body drag listener (move whole block).
  useEffect(() => {
    if (!draggingEffectId || !dragEffectStartRef.current) return
    const { id, startX, startTime, endTime } = dragEffectStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      const innerEl = contentEl?.firstElementChild as HTMLElement | undefined
      const w = innerEl?.offsetWidth || contentEl?.offsetWidth
      if (!w) return
      const deltaTime = ((e.clientX - startX) / w) * maxDur
      moveEffectTo(id, startTime, endTime, deltaTime)
    }
    const onUp = () => {
      setDraggingEffectId(null)
      dragEffectStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingEffectId, maxDur, moveEffectTo])

  // Effect edge-trim drag listener (resize via updateEffectEdge — keeps min-duration clamp).
  useEffect(() => {
    if (!draggingEffectEdgeId || !dragEffectEdgeStartRef.current) return
    const { id, edge, startX, startTime, endTime } = dragEffectEdgeStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      const innerEl = contentEl?.firstElementChild as HTMLElement | undefined
      const w = innerEl?.offsetWidth || contentEl?.offsetWidth
      if (!w) return
      const deltaTime = ((e.clientX - startX) / w) * maxDur
      if (edge === 'start') updateEffectEdge(id, 'start', startTime + deltaTime)
      else updateEffectEdge(id, 'end', endTime + deltaTime)
    }
    const onUp = () => {
      setDraggingEffectEdgeId(null)
      dragEffectEdgeStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingEffectEdgeId, maxDur, updateEffectEdge])

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const contentEl = contentRef.current
    if (!contentEl) return
    const innerEl = contentEl.firstElementChild as HTMLElement
    if (!innerEl) return

    const rect = innerEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverTime(x * maxDur)
  }

  const handleRulerHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const contentEl = contentRef.current
    if (!contentEl) return
    const innerEl = contentEl.firstElementChild as HTMLElement
    if (!innerEl) return
    
    const rect = innerEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setRulerHoverTime(x * maxDur)
  }

  const handleScrollSync = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const zoomToSelection = useCallback(() => {
    if (selectedIds.length > 1) {
      const selectedSegs = segments.filter((s) => selectedIds.includes(s.id))
      if (selectedSegs.length > 0) {
        const minStart = Math.min(...selectedSegs.map((s) => s.startTime))
        const maxEnd = Math.max(...selectedSegs.map((s) => s.endTime))
        const rangeDur = Math.max(0.5, maxEnd - minStart)
        const z = Math.min(4, Math.max(0.5, (maxDur / rangeDur) * 1.05))
        setZoom(z)
        userSeekRef.current = true
        onTimeUpdate(minStart)
      }
    } else if (selectedSegmentId) {
      const seg = segments.find((s) => s.id === selectedSegmentId)
      if (seg) {
        const rangeDur = seg.endTime - seg.startTime
        if (rangeDur > 0) {
          const z = Math.min(4, Math.max(0.5, maxDur / rangeDur))
          setZoom(z)
          userSeekRef.current = true
          onTimeUpdate(seg.startTime)
        }
      }
    } else if (selectedEffectId) {
      const eff = effects.find((e) => e.id === selectedEffectId)
      if (eff) {
        const rangeDur = eff.endTime - eff.startTime
        if (rangeDur > 0) {
          const z = Math.min(4, Math.max(0.5, maxDur / rangeDur))
          setZoom(z)
          userSeekRef.current = true
          onTimeUpdate(eff.startTime)
        }
      }
    }
  }, [selectedIds, selectedSegmentId, selectedEffectId, segments, effects, maxDur, onTimeUpdate])

  const snapStepLabel = snapStep < 1 ? (snapStep === 1 / 30 ? '1/30' : snapStep === 1 / 24 ? '1/24' : `${snapStep}s`) : `${snapStep}s`

  const updateSegmentEdge = useCallback((id: string, edge: 'start' | 'end', value: number) => {
    const isTextOverlay = textOverlays.some(o => o.id === id)
    if (isTextOverlay) {
      if (!onTextOverlaysChange) return
      let v = value
      if (snapEnabled) {
        v = snapPoint(v, snapStep * 1.5)
      }
      v = Math.max(0, Math.min(maxDur, v))
      onTextOverlaysChange((prev) => prev.map(o => {
        if (o.id !== id) return o
        if (edge === 'start') {
          // Clamp so start can never reach/pass end: keep at least MIN_SEG_DURATION.
          const start = Math.max(0, Math.min(v, o.endTime - MIN_SEG_DURATION))
          return { ...o, startTime: start }
        } else {
          // Clamp so end can never reach/pass start.
          const end = Math.min(maxDur, Math.max(v, o.startTime + MIN_SEG_DURATION))
          return { ...o, endTime: end }
        }
      }))
      return
    }

    if (!onSegmentsChange) return
    if (isSegmentLocked(id)) return // Bug 6: locked tracks reject trim
    let v = value
    if (snapEnabled) {
      v = snapPoint(v, snapStep * 1.5)
    }
    v = Math.max(0, Math.min(maxDur, v))

    onSegmentsChange((prev) => {
      const segIndex = prev.findIndex(s => s.id === id)
      if (segIndex === -1) return prev
      const seg = prev[segIndex]

      let next = [...prev]
      let diff = 0

      if (edge === 'start') {
        // Bug 1: clamp start strictly below end (min duration) so it can never invert.
        const start = Math.max(0, Math.min(v, seg.endTime - MIN_SEG_DURATION))
        diff = start - seg.startTime
        next[segIndex] = { ...seg, startTime: start, duration: seg.endTime - start }
      } else {
        // Bug 1: clamp end strictly above start (min duration), then to maxDur.
        const end = Math.min(maxDur, Math.max(v, seg.startTime + MIN_SEG_DURATION))
        diff = end - seg.endTime
        next[segIndex] = { ...seg, endTime: end, duration: end - seg.startTime }
      }

      if (diff === 0) return next

      // Bug 3: ripple subsequent clips on ALL tracks when ripple is enabled.
      if (rippleOnDelete) {
        const boundary = edge === 'start' ? seg.startTime : seg.endTime
        next = next.map(s => {
          if (s.id === id) return s
          if (s.startTime >= boundary && !isTrackLocked(s.track)) {
            const newStart = Math.max(0, s.startTime + diff)
            const newEnd = Math.max(newStart + MIN_SEG_DURATION, s.endTime + diff)
            return { ...s, startTime: newStart, endTime: newEnd, duration: newEnd - newStart }
          }
          return s
        })
      }

      return next
    })
  }, [maxDur, snapEnabled, snapStep, snapPoint, onSegmentsChange, rippleOnDelete, textOverlays, onTextOverlaysChange, isSegmentLocked, isTrackLocked])

  const trimSegmentStartToPlayhead = useCallback((seg: TimelineSegment) => {
    if (!onSegmentsChange || currentTime <= seg.startTime || currentTime >= seg.endTime) return
    updateSegmentEdge(seg.id, 'start', currentTime)
  }, [currentTime, onSegmentsChange, updateSegmentEdge])

  const trimSegmentEndToPlayhead = useCallback((seg: TimelineSegment) => {
    if (!onSegmentsChange || currentTime <= seg.startTime || currentTime >= seg.endTime) return
    updateSegmentEdge(seg.id, 'end', currentTime)
  }, [currentTime, onSegmentsChange, updateSegmentEdge])

  const trimSelectedStartToPlayhead = useCallback(() => {
    if (!selectedSegmentId) return
    const seg = segments.find((s) => s.id === selectedSegmentId)
    if (seg) trimSegmentStartToPlayhead(seg)
  }, [selectedSegmentId, segments, trimSegmentStartToPlayhead])

  const trimSelectedEndToPlayhead = useCallback(() => {
    if (!selectedSegmentId) return
    const seg = segments.find((s) => s.id === selectedSegmentId)
    if (seg) trimSegmentEndToPlayhead(seg)
  }, [selectedSegmentId, segments, trimSegmentEndToPlayhead])

  const canTrimIn = !!selectedSegment && currentTime > selectedSegment.startTime && currentTime < selectedSegment.endTime
  const canTrimOut = !!selectedSegment && currentTime > selectedSegment.startTime && currentTime < selectedSegment.endTime

  const moveSegmentTo = useCallback((id: string, originalStart: number, originalEnd: number, deltaTime: number, newTrack?: number) => {
    const isTextOverlay = textOverlays.some(o => o.id === id)
    if (isTextOverlay) {
      if (!onTextOverlaysChange) return
      const segDur = originalEnd - originalStart
      let newStart = originalStart + deltaTime

      if (snapEnabled) {
        newStart = snapMovedBlockStart(newStart, segDur, [originalStart, originalEnd])
      }

      newStart = Math.max(0, Math.min(maxDur - segDur, newStart))
      const newEnd = newStart + segDur

      onTextOverlaysChange((prev) => prev.map(o => {
        if (o.id !== id) return o
        return { ...o, startTime: newStart, endTime: Math.min(newEnd, maxDur) }
      }))
      return
    }

    if (!onSegmentsChange) return
    if (isSegmentLocked(id)) return // Bug 6: locked tracks reject move
    const segDur = originalEnd - originalStart
    let newStart = originalStart + deltaTime

    if (snapEnabled) {
      // Exclude the segment's own edges so it can't snap to itself; prefer speech stops.
      newStart = snapMovedBlockStart(newStart, segDur, [originalStart, originalEnd])
    }

    newStart = Math.max(0, Math.min(maxDur - segDur, newStart))
    const newEnd = newStart + segDur

    onSegmentsChange((prev) => {
      let next = [...prev]
      const oldSeg = next.find(s => s.id === id)
      if (!oldSeg) return prev

      const diff = newStart - originalStart
      // Segment groups: when the dragged clip belongs to a group, every other
      // member shifts by the same Δt so the group stays linked. Locked members
      // are skipped (their lane rejects edits), matching single-move behaviour.
      const groupId = oldSeg.groupId

      next = next.map((seg) => {
        if (seg.id !== id) {
          if (groupId && seg.groupId === groupId && diff !== 0 && !isTrackLocked(seg.track)) {
            const ns = Math.max(0, Math.min(maxDur - (seg.endTime - seg.startTime), seg.startTime + diff))
            const ne = ns + (seg.endTime - seg.startTime)
            const shiftedKf = seg.transformKeyframes
              ? seg.transformKeyframes.map(kf => ({ ...kf, time: kf.time + (ns - seg.startTime) }))
              : seg.transformKeyframes
            return { ...seg, startTime: ns, endTime: ne, duration: ne - ns, transformKeyframes: shiftedKf }
          }
          return seg
        }
        const updatedTrack = newTrack !== undefined ? newTrack : seg.track
        const clampedEnd = Math.min(newEnd, maxDur)
        // Bug 4: keyframe times are absolute — shift them by the same Δt the segment
        // moved so they stay attached to their original frames within the clip.
        const shiftedKeyframes = (diff !== 0 && seg.transformKeyframes)
          ? seg.transformKeyframes.map(kf => ({ ...kf, time: kf.time + diff }))
          : seg.transformKeyframes
        return { ...seg, startTime: newStart, endTime: clampedEnd, duration: clampedEnd - newStart, track: updatedTrack, transformKeyframes: shiftedKeyframes }
      })

      // Bug 3: ripple subsequent clips on ALL tracks when ripple is enabled.
      if (rippleOnDelete && diff !== 0) {
        next = next.map(seg => {
          if (seg.id === id) return seg
          // Group members were already shifted above; don't ripple them again.
          if (groupId && seg.groupId === groupId) return seg
          if (seg.startTime >= originalStart && !isTrackLocked(seg.track)) {
            const ns = Math.max(0, seg.startTime + diff)
            const ne = Math.max(ns + MIN_SEG_DURATION, seg.endTime + diff)
            return { ...seg, startTime: ns, endTime: ne, duration: ne - ns }
          }
          return seg
        })
      }

      return next
    })
  }, [maxDur, snapEnabled, snapStep, snapMovedBlockStart, onSegmentsChange, rippleOnDelete, textOverlays, onTextOverlaysChange, isSegmentLocked, isTrackLocked])

  const splitSegmentAt = useCallback((seg: TimelineSegment, atTime: number) => {
    if (!onSegmentsChange) return
    if (atTime <= seg.startTime || atTime >= seg.endTime) return
    const durLeft = atTime - seg.startTime
    const durRight = seg.endTime - atTime
    if (durLeft < 0.25 || durRight < 0.25) return
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const right: TimelineSegment = { ...seg, id: newId, startTime: atTime, endTime: seg.endTime, duration: durRight }
    onSegmentsChange((prev) => prev.flatMap((s) => {
      if (s.id !== seg.id) return [s]
      const left: TimelineSegment = { ...seg, endTime: atTime, duration: durLeft }
      return [left, right]
    }))
    onSegmentSelect?.(newId, false)
  }, [onSegmentsChange, onSegmentSelect])

  const splitAtPlayhead = useCallback(() => {
    const seg = segments.find((s) => currentTime > s.startTime && currentTime < s.endTime)
    if (seg) splitSegmentAt(seg, currentTime)
  }, [segments, currentTime, splitSegmentAt])

  const duplicateSegment = useCallback((seg: TimelineSegment) => {
    if (!onSegmentsChange) return
    const segDur = seg.endTime - seg.startTime
    const newStart = Math.min(seg.endTime, maxDur - segDur)
    const newEnd = newStart + segDur
    if (newEnd <= maxDur + 0.01) {
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const copy: TimelineSegment = { ...seg, id: newId, startTime: newStart, endTime: newEnd, duration: segDur }
      onSegmentsChange((prev) => {
        const next = [...prev, copy]
        return resolveTimelineOverlaps(next, copy.id, copy.startTime, copy.endTime, copy.track ?? 0)
      })
      onSegmentSelect?.(newId, false)
    }
  }, [maxDur, onSegmentsChange, onSegmentSelect])

  const duplicateSelectedSegment = useCallback(() => {
    if (selectedIds.length === 0) return
    const toDuplicate = segments.filter((s) => selectedIds.includes(s.id)).sort((a, b) => a.startTime - b.startTime)
    if (toDuplicate.length === 0) return
    if (toDuplicate.length === 1) {
      duplicateSegment(toDuplicate[0])
      return
    }
    if (!onSegmentsChange) return
    let insertStart = Math.max(...toDuplicate.map((s) => s.endTime), 0)
    const copies: TimelineSegment[] = []
    toDuplicate.forEach((seg) => {
      const segDur = seg.endTime - seg.startTime
      if (insertStart + segDur <= maxDur + 0.01) {
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
        copies.push({ ...seg, id: newId, startTime: insertStart, endTime: insertStart + segDur, duration: segDur })
        insertStart += segDur
      }
    })
    if (copies.length > 0) {
      onSegmentsChange((prev) => {
        let next = [...prev]
        copies.forEach(copy => {
          next = resolveTimelineOverlaps([...next, copy], copy.id, copy.startTime, copy.endTime, copy.track ?? 0)
        })
        return next
      })
      onSegmentSelect?.(copies[0].id, false)
    }
  }, [selectedIds, segments, duplicateSegment, onSegmentsChange, maxDur, onSegmentSelect])

  // Segment groups: assign a shared groupId to the current multi-selection so the
  // clips move/trim/delete together. Requires 2+ selected segments.
  const groupSelectedSegments = useCallback(() => {
    if (!onSegmentsChange || selectedIds.length < 2) return
    const newGroupId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `grp-${crypto.randomUUID()}`
      : `grp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    onSegmentsChange((prev) => prev.map((seg) =>
      selectedIds.includes(seg.id) ? { ...seg, groupId: newGroupId } : seg
    ))
  }, [onSegmentsChange, selectedIds])

  // Ungroup: clear groupId from every segment in any group touched by the
  // current selection (selecting one member ungroups the whole group).
  const ungroupSelectedSegments = useCallback(() => {
    if (!onSegmentsChange || selectedIds.length === 0) return
    const groupIds = new Set(
      segments.filter((s) => selectedIds.includes(s.id) && s.groupId).map((s) => s.groupId)
    )
    if (groupIds.size === 0) return
    onSegmentsChange((prev) => prev.map((seg) =>
      seg.groupId && groupIds.has(seg.groupId) ? { ...seg, groupId: undefined } : seg
    ))
  }, [onSegmentsChange, selectedIds, segments])

  // True when any segment in the current selection already belongs to a group.
  const selectionHasGroup = useMemo(
    () => segments.some((s) => selectedIds.includes(s.id) && !!s.groupId),
    [segments, selectedIds]
  )

  const nudgeSelectedSegment = useCallback((dir: -1 | 1) => {
    if (!selectedSegmentId || !onSegmentsChange) return
    const seg = segments.find((s) => s.id === selectedSegmentId)
    if (!seg) return
    const delta = dir * stepAmount
    moveSegmentTo(selectedSegmentId, seg.startTime, seg.endTime, delta)
  }, [selectedSegmentId, segments, stepAmount, onSegmentsChange, moveSegmentTo])

  const zoomToFitContent = useCallback(() => {
    let contentStart = 0
    let contentEnd = maxDur
    segments.forEach((s) => {
      contentStart = Math.min(contentStart, s.startTime)
      contentEnd = Math.max(contentEnd, s.endTime)
    })
    effects.forEach((e) => {
      contentStart = Math.min(contentStart, e.startTime)
      contentEnd = Math.max(contentEnd, e.endTime)
    })
    const range = Math.max(0.5, contentEnd - contentStart)
    const z = Math.min(4, Math.max(0.5, (maxDur / range) * 1.05))
    setZoom(z)
  }, [segments, effects, maxDur])

  const addMarkerAtPlayhead = useCallback(() => {
    const nameRaw = typeof window !== 'undefined' ? window.prompt('Marker name (optional):', '') : null
    const name = (nameRaw != null && nameRaw.trim() !== '') ? nameRaw.trim() : undefined
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`
    setMarkersList((m) => [...m, { id, time: currentTime, name }])
  }, [currentTime, setMarkersList])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ') { e.preventDefault(); onPlayPause?.(); return }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); onPlayPause?.(); return }
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); stepTime(-1); return }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); stepTime(1); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepTime(-1, e.shiftKey) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepTime(1, e.shiftKey) }
      else if (e.key === 'Home') { e.preventDefault(); userSeekRef.current = true; onTimeUpdate(0) }
      else if (e.key === 'End') { e.preventDefault(); userSeekRef.current = true; onTimeUpdate(maxDur) }
      else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); setInPoint(currentTime) }
      else if (e.key === 'o' || e.key === 'O') { e.preventDefault(); setOutPoint(currentTime) }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeId && selectedSegmentId) {
        // A selected keyframe in the dedicated lane takes priority over deleting
        // the whole clip, so Delete removes just that keyframe.
        e.preventDefault(); removeSegmentKeyframe(selectedSegmentId, selectedKeyframeId); setSelectedKeyframeId(null)
      }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedIds.length > 0 || selectedEffectId)) { e.preventDefault(); handleDeleteSelected() }
      else if (e.key === 'Escape') { setContextMenu(null); onSegmentSelect?.(null); onEffectSelect?.(null); setDraggingSegmentId(null) }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitAtPlayhead() }
      else if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateSelectedSegment() }
      else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelectedSegment(-1) }
      else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); nudgeSelectedSegment(1) }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); addMarkerAtPlayhead() }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [stepTime, selectedIds, selectedEffectId, handleDeleteSelected, onSegmentSelect, onEffectSelect, onTimeUpdate, onPlayPause, maxDur, currentTime, splitAtPlayhead, duplicateSelectedSegment, nudgeSelectedSegment, addMarkerAtPlayhead, selectedKeyframeId, selectedSegmentId, removeSegmentKeyframe])

  const removeMarker = useCallback((id: string) => {
    setMarkersList((m) => m.filter((x) => x.id !== id))
    setContextMenu(null)
  }, [setMarkersList])

  const segmentAtPlayheadForSplit = segmentAtPlayhead && currentTime > segmentAtPlayhead.startTime && currentTime < segmentAtPlayhead.endTime

  const contextMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!contextMenu) return
    const onClose = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return
      setContextMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    window.addEventListener('mousedown', onClose, true)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onClose, true); window.removeEventListener('keydown', onKey) }
  }, [contextMenu])

  useEffect(() => {
    if (!draggingSegmentId || !dragSegmentStartRef.current) return
    const { x: startX, y: startY, startTime: origStart, endTime: origEnd, track: origTrack } = dragSegmentStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      // Bug 7: convert pixel delta using the inner (zoomed) content width, not the
      // viewport, so drag distance maps to the correct time delta at any zoom.
      const innerEl = contentEl?.firstElementChild as HTMLElement | undefined
      const w = innerEl?.offsetWidth || contentEl?.offsetWidth
      if (!w) return
      const deltaTime = ((e.clientX - startX) / w) * maxDur

      const hoveredEl = document.elementFromPoint(e.clientX, e.clientY)
      const trackEl = hoveredEl?.closest('[data-track-drop]') as HTMLElement | null
      let newTrack = origTrack
      if (trackEl && trackEl.dataset.trackDrop) {
        newTrack = parseInt(trackEl.dataset.trackDrop, 10)
      }

      moveSegmentTo(draggingSegmentId, origStart, origEnd, deltaTime, newTrack)
    }
    const onUp = () => {
      const segId = draggingSegmentId
      setDraggingSegmentId(null)
      dragSegmentStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)

      if (segId && onSegmentsChange) {
        onSegmentsChange((prev) => {
          const dragged = prev.find(s => s.id === segId)
          if (!dragged) return prev
          return resolveTimelineOverlaps(prev, segId, dragged.startTime, dragged.endTime, dragged.track ?? 0)
        })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingSegmentId, maxDur, moveSegmentTo, onSegmentsChange])

  const handleSegmentBodyMouseDown = useCallback((e: React.MouseEvent, seg: TimelineSegment) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    e.stopPropagation()
    // 1) Right click = context menu
    if (e.button === 2) {
      setContextMenu({ x: e.clientX, y: e.clientY, segmentId: seg.id, type: 'segment' })
      if (!selectedIds.includes(seg.id)) onSegmentSelect?.(seg.id, false)
      return
    }
    // 2) Left click + Shift/Meta = add to selection
    if (e.button === 0 && (e.shiftKey || e.metaKey)) {
      onSegmentSelect?.(seg.id, true)
    }
    // 3) Normal Click = select
    if (e.button === 0) {
      onSegmentSelect?.(e.metaKey || e.ctrlKey ? null : seg.id, e.metaKey || e.ctrlKey)
    }
    // Bug 6: locked tracks may be selected but not dragged.
    if (isTrackLocked(seg.track)) return
    setDraggingSegmentId(seg.id)
    dragSegmentStartRef.current = { x: e.clientX, y: e.clientY, startTime: seg.startTime, endTime: seg.endTime, track: seg.track }
  }, [selectedIds, onSegmentSelect, isTrackLocked])

  const handleSegmentEdgeMouseDown = useCallback((e: React.MouseEvent, seg: TimelineSegment, edge: 'start' | 'end') => {
    e.stopPropagation()
    if (isTrackLocked(seg.track)) return // Bug 6: locked tracks reject trim
    setDraggingEdgeId(seg.id)
    dragEdgeStartRef.current = { id: seg.id, edge, startX: e.clientX, startTime: seg.startTime, endTime: seg.endTime }
  }, [isTrackLocked])

  // Bug 2: dedicated overlay handlers — overlays have no track/duration, so the old
  // `seg as any` cast through the segment handlers was unsafe. These retime the
  // overlay through updateSegmentEdge/moveSegmentTo, both of which detect overlays
  // by id and operate on startTime/endTime only (no track field).
  const handleOverlayEdgeMouseDown = useCallback((e: React.MouseEvent, overlay: TextOverlay, edge: 'start' | 'end') => {
    e.stopPropagation()
    setDraggingEdgeId(overlay.id)
    dragEdgeStartRef.current = { id: overlay.id, edge, startX: e.clientX, startTime: overlay.startTime, endTime: overlay.endTime }
  }, [])

  const handleOverlayBodyMouseDown = useCallback((e: React.MouseEvent, overlay: TextOverlay) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    e.stopPropagation()
    if (e.button === 0 && (e.shiftKey || e.metaKey)) {
      onSegmentSelect?.(overlay.id, true)
    } else if (e.button === 0) {
      onSegmentSelect?.(overlay.id, false)
    }
    setDraggingSegmentId(overlay.id)
    // track is irrelevant for overlays; moveSegmentTo's overlay branch ignores it.
    dragSegmentStartRef.current = { x: e.clientX, y: e.clientY, startTime: overlay.startTime, endTime: overlay.endTime, track: 0 }
  }, [onSegmentSelect])

  useEffect(() => {
    if (!draggingEdgeId || !dragEdgeStartRef.current) return
    const { id, edge, startX, startTime, endTime } = dragEdgeStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      // Bug 7: use inner zoomed content width for accurate delta at any zoom.
      const innerEl = contentEl?.firstElementChild as HTMLElement | undefined
      const w = innerEl?.offsetWidth || contentEl?.offsetWidth
      if (!w) return
      const deltaTime = ((e.clientX - startX) / w) * maxDur
      if (edge === 'start') {
        updateSegmentEdge(id, 'start', startTime + deltaTime)
      } else {
        updateSegmentEdge(id, 'end', endTime + deltaTime)
      }
    }
    const onUp = () => {
      setDraggingEdgeId(null)
      dragEdgeStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingEdgeId, maxDur, updateSegmentEdge])

  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.25 : 0.25
    setZoom((z) => Math.max(0.5, Math.min(10, z + delta))) // Increased max zoom to 10 for fine manipulation
  }, [])

  const touchStartRef = useRef<{ dist: number, zoom: number } | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchStartRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom }
    }
  }, [zoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = dist / touchStartRef.current.dist
      setZoom(Math.max(0.5, Math.min(10, touchStartRef.current.zoom * scale)))
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) touchStartRef.current = null
  }, [])

  // Single-finger scrub on the ruler. The ruler sets touch-action:none so the
  // browser doesn't steal the gesture for native scroll; seekTo auto-recentres
  // the viewport on the playhead when zoomed in, so dragging still navigates.
  const handleRulerTouch = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    seekTo(e.touches[0].clientX)
  }, [seekTo])

  const handleTrackDrop = useCallback((e: React.DragEvent, trackIndex: number) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'library-asset' && data.asset) {
        const contentEl = contentRef.current
        if (!contentEl) return
        // Bug 7: measure against the inner (zoomed) content element so the drop
        // lands at the correct time when zoomed/scrolled, not the viewport.
        const innerEl = (contentEl.firstElementChild as HTMLElement | null) ?? contentEl
        const rect = innerEl.getBoundingClientRect()
        const dropX = e.clientX - rect.left
        const rawTime = (dropX / (rect.width || contentEl.offsetWidth)) * maxDur
        // Snap drop time to grid or playhead
        let t = rawTime
        if (snapEnabled) {
          t = snapPoint(t, snapStep * 1.5)
        }
        t = Math.max(0, Math.min(maxDur, t))
        onAssetDrop?.(data.asset, trackIndex, t)
      }
    } catch {
      // Ignore invalid drag data
    }
  }, [maxDur, snapEnabled, snapStep, snapPoint, onAssetDrop])

  const isCompact = density === 'compact'

  // Bug 6: reusable lock/mute/solo controls wired to per-track state.
  // Mute is mapped onto trackVisibility (already consumed by the preview to hide a
  // track); lock/solo use trackState. `muted = trackVisibility[idx] === false`.
  const renderLaneControls = (laneKey: 'captions' | 'a-roll' | 'b-roll' | 'audio') => {
    const idx = laneTrackIndex(laneKey)
    const st = trackState[idx] ?? {}
    const muted = trackVisibility[idx] === false
    const dimmed = anySolo && !st.solo
    const toggleMute = () => onTrackVisibilityChange?.(idx, muted)
    const toggleLock = () => setTrackStatePatch(idx, { locked: !st.locked })
    const toggleSolo = () => setTrackStatePatch(idx, { solo: !st.solo })
    return (
      <div className={`flex items-center gap-1 transition-opacity ${dimmed ? 'opacity-30' : 'opacity-40 group-hover/track:opacity-100'}`}>
        <button type="button" onClick={toggleSolo} title={st.solo ? 'Unsolo Track' : 'Solo Track'} aria-pressed={st.solo ? 'true' : 'false'}
          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-colors ${st.solo ? 'bg-amber-500 text-black' : 'hover:bg-white/10 hover:text-white text-slate-400'}`}>S</button>
        <button type="button" onClick={toggleMute} title={muted ? 'Unmute Track' : 'Mute Track'} aria-pressed={muted ? 'true' : 'false'}
          className={`p-1 rounded transition-colors ${muted ? 'bg-rose-500/30 text-rose-300' : 'hover:bg-white/10 hover:text-white text-slate-400'}`}>
          {muted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button type="button" onClick={toggleLock} title={st.locked ? 'Unlock Track' : 'Lock Track'} aria-pressed={st.locked ? 'true' : 'false'}
          className={`p-1 rounded transition-colors ${st.locked ? 'bg-indigo-500/30 text-indigo-300' : 'hover:bg-white/10 hover:text-white text-slate-400'}`}>
          <Lock className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full bg-[#0A0A0B] backdrop-blur-[100px] border border-white/5 flex flex-row overflow-hidden outline-none relative group/timeline select-none"
    >
      {/* Decorative Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />

      {/* TOP: BREADCRUMB PRECISION TRACKER (NEW) */}
      <div className="absolute top-0 inset-x-0 h-10 bg-black/60 border-b border-white/5 z-[60] flex items-center px-8 gap-4 backdrop-blur-3xl">
        <div className="flex items-center gap-2">
           <Orbit className="w-3.5 h-3.5 text-indigo-400" />
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Workspace</span>
        </div>
        <ChevronRight className="w-3 h-3 text-slate-700" />
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-black text-white hover:text-indigo-400 cursor-pointer transition-colors uppercase italic">
             {currentScene ? `Scene ${currentScene.index}: ${currentScene.title}` : 'Universal Thread'}
           </span>
        </div>
        {selectedSegment && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-700" />
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full group/crumb">
               <Fingerprint className="w-3 h-3 text-indigo-400 group-hover/crumb:animate-pulse" />
               <span className="text-[9px] font-black text-indigo-300 uppercase italic truncate max-w-[150px]">{selectedSegment.name}</span>
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-4">
           {/* Mode Toggles */}
           <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
              <button
                type="button"
                onClick={() => setTimelineMode('visual')}
                className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${timelineMode === 'visual' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setTimelineMode('hybrid')}
                className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${timelineMode === 'hybrid' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
              >
                Hybrid
              </button>
           </div>
        </div>
      </div>

      {/* RIGHT: VISUAL MULTI-TRACK ENGINE (ENHANCED) */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-black/20 pt-10">
        {/* Superior Toolbar */}
        <div className="shrink-0 h-16 flex items-center justify-between px-10 border-b border-white/5 z-30">
           <div className="flex items-center gap-8">
             <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shadow-inner">
                {[
                  { id: 'hybrid', icon: <SplitSquareHorizontal className="w-4 h-4" /> },
                  { id: 'visual', icon: <Layers className="w-4 h-4" /> },
                  { id: 'text', icon: <Type className="w-4 h-4" /> },
                ].map(m => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setTimelineMode(m.id as any)}
                    className={`p-2.5 rounded-xl transition-all ${timelineMode === m.id ? 'bg-white text-black shadow-xl scale-110' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    title={`Switch to ${m.id} mode`}
                  >
                    {m.icon}
                  </button>
                ))}
             </div>

             <div className="h-8 w-px bg-white/10" />

             <div className="flex items-center gap-6">
                <div className="relative group/timeinput">
                   <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/timeinput:text-indigo-400" />
                   <input
                     type="text"
                     value={timestampInput}
                     onChange={(e) => setTimestampInput(e.target.value)}
                     className="w-32 pl-12 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-2xl text-xs font-mono font-bold text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-700"
                     placeholder="0:00.00"
                     aria-label="Current playing time"
                   />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-white italic tabular-nums">{formatTimeDetailed(currentTime)}</span>
                   <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Current Frame Matrix</span>
                </div>
             </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="hidden xl:flex items-center gap-2">
                 <button className="px-5 py-2.5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    Auto-Sync Audio
                 </button>
                 <button className="px-5 py-2.5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest text-fuchsia-400 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 transition-all flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Motion Track
                 </button>
              </div>

              <div className="hidden xl:flex items-center bg-white/5 px-5 py-2.5 rounded-2xl border border-white/5 gap-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Focus:</span>
                 <select
                   title="Select Focus Lane"
                   value={focusLane || 'all'}
                   onChange={(e) => setFocusLane(e.target.value === 'all' ? null : e.target.value)}
                   className="bg-transparent text-[10px] font-black text-indigo-400 uppercase tracking-widest italic outline-none cursor-pointer"
                 >
                    <option value="all">Dynamic Grid</option>
                    <option value="captions">Speech Nodes</option>
                    <option value="a-roll">Prime Sequence</option>
                    <option value="b-roll">Visual Assets</option>
                    <option value="fx">Neural Layers</option>
                 </select>
              </div>

              <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/5">
                 <button type="button" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-2.5 rounded-xl text-slate-500 hover:text-white transition-all" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                 <div className="w-12 text-center text-[10px] font-black text-slate-400 tabular-nums">{Math.round(zoom * 100)}%</div>
                 <button type="button" onClick={() => setZoom(Math.min(10, zoom + 0.25))} className="p-2.5 rounded-xl text-slate-500 hover:text-white transition-all" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
              </div>
           </div>
        </div>

         {/* Dynamic Multi-Track Canvas */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
           {/* ELITE NAVIGATOR MINI-MAP (NEW) */}
           <div className="shrink-0 h-8 border-b border-white/5 bg-[#0a0a0c] relative z-40 px-64">
              <div className="w-full h-full relative cursor-pointer group/minimap">
                 {/* Mini-map track representation */}
                 <div className="absolute inset-y-2 left-0 right-0 bg-white/5 rounded-full overflow-hidden flex flex-col gap-[1px] p-[1px]">
                    <div className="flex-1 bg-indigo-500/20 rounded-full w-full" />
                    <div className="flex-1 bg-blue-500/20 rounded-full w-[80%]" />
                    <div className="flex-1 bg-emerald-500/20 rounded-full w-[40%] ml-[20%]" />
                 </div>

                 {/* Viewport Bounds Indicator */}
                 {visibleTimeRange && (
                    <motion.div
                      layout
                      className="absolute inset-y-1 rounded-md border-2 border-white/40 bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)] cursor-grab active:cursor-grabbing hover:bg-white/20 transition-colors"
                      style={{
                        left: `${(visibleTimeRange.start / maxDur) * 100}%`,
                        width: `${((visibleTimeRange.end - visibleTimeRange.start) / maxDur) * 100}%`
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-white/50 rounded-l-sm" />
                       <div className="absolute inset-y-0 right-0 w-1 bg-white/50 rounded-r-sm" />
                    </motion.div>
                 )}
                 {/* Mini Playhead */}
                 <div
                   className="absolute top-0 bottom-0 w-px bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] z-10 pointer-events-none"
                   style={{ '--playhead-left': `${timeToX(currentTime)}%`, left: 'var(--playhead-left)' } as any}
                 />
              </div>
           </div>

           {/* Timeline Header (High Precision Ruler) — taller on touch for easier scrubbing */}
           <div className="shrink-0 h-12 md:h-10 border-b border-white/5 relative bg-white/[0.01] z-30">
              <div
                ref={scrollRef}
                className="h-full overflow-x-auto overflow-y-hidden select-none scrollbar-hide touch-none cursor-pointer"
                onMouseMove={handleRulerHover}
                onMouseLeave={() => setRulerHoverTime(null)}
                onMouseDown={(e) => { if (e.button === 0) { seekTo(e.clientX, true); setIsScrubbing(true) } }}
                onClick={(e) => seekTo(e.clientX)}
                onTouchStart={handleRulerTouch}
                onTouchMove={handleRulerTouch}
              >
                <div className="h-full relative min-w-full" style={{ '--content-width': `${zoom * 100}%`, width: 'var(--content-width)' } as any}>
                   {/* Rule Ticks (Ultra Precision) */}
                   <div className="absolute inset-0 flex items-end opacity-40">
                      {Array.from({ length: 81 }).map((_, i) => {
                        const isMajor = i % 10 === 0
                        const isMid = i % 5 === 0 && !isMajor
                        return (
                           <div key={i} className={`flex-1 border-l flex flex-col justify-end ${isMajor ? 'border-white/60 h-4' : isMid ? 'border-white/30 h-2' : 'border-white/10 h-1'}`}>
                              {isMajor && (
                                 <span className="absolute -top-5 -ml-4 text-[9px] font-black text-slate-400 uppercase tracking-widest drop-shadow-md">
                                    {displayTime((i / 80) * maxDur)}
                                 </span>
                              )}
                           </div>
                        )
                      })}
                   </div>

                   {/* AI Peak Energy Beats */}
                   {[2.5, 5.8, 8.2, 12.4, 17.1].map((t, idx) => (
                      <div
                        key={`beat-${idx}`}
                        className="absolute top-1/2 -translate-y-1/2 z-20 group/beat cursor-pointer"
                        style={{ left: `${timeToX(t)}%` }}
                        onClick={(e) => { e.stopPropagation(); onTimeUpdate(t) }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse shadow-[0_0_8px_rgba(240,79,216,1)] border border-white/20" />
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-fuchsia-950/90 text-[7px] font-black text-fuchsia-300 uppercase tracking-widest rounded border border-fuchsia-500/30 opacity-0 group-hover/beat:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Peak Beat ({t.toFixed(1)}s)
                        </div>
                      </div>
                    ))}

                   {/* Markers */}
                   {visibleMarkers.map(m => (
                     <div
                       key={m.id}
                       className="absolute top-0 h-full w-[2px] bg-amber-500/50 cursor-pointer group/marker z-20"
                       style={{ '--marker-left': `${timeToX(m.time)}%`, left: 'var(--marker-left)' } as any}
                     >
                        <div className="absolute top-0 -left-[4px] w-2.5 h-2.5 bg-amber-500 rotate-45 border border-black/50 shadow-lg group-hover/marker:scale-150 transition-transform" />
                        <span className="absolute top-4 left-3 px-2 py-0.5 bg-amber-500 text-black text-[8px] font-black uppercase rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">{m.name || 'Marker'}</span>
                     </div>
                   ))}

                   {/* Playhead */}
                   {rulerHoverTime !== null && (
                     <div className="absolute top-0 bottom-0 w-px bg-white/20 z-10 pointer-events-none" style={{ '--ruler-hover-left': `${timeToX(rulerHoverTime)}%`, left: 'var(--ruler-hover-left)' } as any}>
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono text-white/80 backdrop-blur-md border border-white/10 shadow-lg">{displayTime(rulerHoverTime)}</div>
                     </div>
                   )}
                   
                   {/* Stakeholder Comments Layer */}
                   {mockComments.map(c => (
                      <div
                         key={c.id}
                         className="absolute top-1/2 -translate-y-1/2 z-30 group/comment cursor-pointer"
                         style={{ '--comment-left': `${timeToX(c.time)}%`, left: 'var(--comment-left)' } as any}
                         onClick={(e) => { e.stopPropagation(); setActiveCommentId(activeCommentId === c.id ? null : c.id) }}
                      >
                         <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 border-black shadow-lg transition-transform ${activeCommentId === c.id ? 'bg-indigo-500 scale-125' : 'bg-rose-500 hover:scale-110'}`}>
                            <MessageSquare className="w-2.5 h-2.5 text-white" />
                         </div>
                         
                         {/* Comment Popover */}
                         {activeCommentId === c.id && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                               <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{c.author}</span>
                                  <span className="text-[8px] font-mono text-slate-500">{formatTime(c.time)}</span>
                               </div>
                               <p className="text-xs text-slate-200 leading-snug">{c.text}</p>
                               <div className="mt-3 flex items-center gap-2">
                                  <button type="button" onClick={() => setMockComments(prev => prev.filter(mc => mc.id !== c.id))} className="flex-1 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-slate-300 transition-colors">Resolve</button>
                                  <button type="button" onClick={() => setActiveCommentId(null)} className="flex-1 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-slate-300 transition-colors">Close</button>
                               </div>
                            </div>
                         )}
                      </div>
                   ))}
                </div>
              </div>
           </div>

           {/* Track Content Engine */}
           <div className="flex-1 flex overflow-hidden">
              {/* Intent-Based Lanes Labels */}
              <div className="shrink-0 w-64 border-r border-white/5 bg-black/40 flex flex-col z-30 shadow-2xl">
                 <div className="flex-1 overflow-y-auto custom-scrollbar-thin">
                    <div className="p-4 space-y-2">
                       {/* LANE: SPEECH NODES */}
                       {(!focusLane || focusLane === 'captions') && (
                         <div className={`h-24 px-3 rounded-2xl border border-white/5 flex flex-col justify-center gap-2 transition-all duration-500 relative group/track ${focusLane === 'captions' ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-black/40 hover:bg-white-[0.02]'}`}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-2xl opacity-50 group-hover/track:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between pl-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[10px] font-black font-mono text-emerald-400 border border-emerald-500/30">
                                     V1
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Speech Projection</span>
                                     <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Neural Metadata</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center justify-between pl-2 mt-1">
                               <div className="flex items-center gap-1.5 opacity-60">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse" />
                                  <span className="text-[8px] font-bold text-emerald-100/50 uppercase tracking-widest">Active Sync</span>
                               </div>
                               {renderLaneControls('captions')}
                            </div>
                         </div>
                       )}

                       {/* LANE: PRIME SEQUENCE */}
                       {(!focusLane || focusLane === 'a-roll') && (
                         <div className={`h-32 px-3 rounded-2xl border border-white/5 flex flex-col justify-center gap-3 transition-all duration-500 relative group/track ${focusLane === 'a-roll' ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20' : 'bg-black/40 hover:bg-white-[0.02]'}`}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-700 rounded-l-2xl opacity-50 group-hover/track:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between pl-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black font-mono text-blue-400 border border-blue-500/30">
                                     V2
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[11px] font-black text-white uppercase tracking-widest italic drop-shadow-md">Prime Sequence</span>
                                     <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Primary A-Roll Stream</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center justify-between pl-2">
                               <div className="flex items-center gap-1.5 opacity-60">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]" />
                                  <span className="text-[8px] font-bold text-blue-100/50 uppercase tracking-widest">Locked 4K RAW</span>
                               </div>
                               <div className="bg-black/40 rounded-lg p-0.5 border border-white/5">
                                  {renderLaneControls('a-roll')}
                               </div>
                            </div>
                         </div>
                       )}

                       {/* LANE: VISUAL ASSETS */}
                       {(!focusLane || focusLane === 'b-roll') && (
                         <div className={`h-28 px-3 rounded-2xl border border-white/5 flex flex-col justify-center gap-2 transition-all duration-500 relative group/track ${focusLane === 'b-roll' ? 'bg-amber-600/10 border-amber-500/30 ring-1 ring-amber-500/20' : 'bg-black/40 hover:bg-white-[0.02]'}`}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-600 rounded-l-2xl opacity-50 group-hover/track:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between pl-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-[10px] font-black font-mono text-amber-400 border border-amber-500/30">
                                     V3
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Visual Assets</span>
                                     <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">B-Roll & Overlays</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center justify-between pl-2 mt-1">
                               <div className="flex items-center gap-1.5 opacity-60">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)]" />
                                  <span className="text-[8px] font-bold text-amber-100/50 uppercase tracking-widest">Global Vault</span>
                               </div>
                               {renderLaneControls('b-roll')}
                            </div>
                         </div>
                       )}

                       {/* LANE: AUDIO ASSETS */}
                       {(!focusLane || focusLane === 'audio') && (
                         <div className={`h-24 px-3 rounded-2xl border border-white/5 flex flex-col justify-center gap-2 transition-all duration-500 relative group/track ${focusLane === 'audio' ? 'bg-fuchsia-600/10 border-fuchsia-500/30 ring-1 ring-fuchsia-500/20' : 'bg-black/40 hover:bg-white-[0.02]'}`}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 rounded-l-2xl opacity-50 group-hover/track:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between pl-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-[10px] font-black font-mono text-fuchsia-400 border border-fuchsia-500/30">
                                     A1
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-black text-white uppercase italic tracking-widest leading-none">Audio Streams</span>
                                     <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Multi-Channel Sonic</span>
                                  </div>
                               </div>
                            </div>
                            <div className="flex items-center justify-between pl-2 mt-1">
                               <div className="flex items-center gap-1.5 opacity-60">
                                  <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_5px_rgba(192,38,211,0.8)]" />
                                  <span className="text-[8px] font-bold text-fuchsia-100/50 uppercase tracking-widest">48kHz Spatial</span>
                               </div>
                               <div className="bg-black/40 rounded-lg p-0.5 border border-white/5">
                                  {renderLaneControls('audio')}
                               </div>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Spatial Track Canvas */}
              <div
                ref={contentRef}
                className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative bg-white/[0.01]"
                onWheel={handleWheelZoom}
                onScroll={handleScrollSync}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="relative min-h-full p-4"
                  style={{ '--content-width-zoom': `${zoom * 100}%`, width: 'var(--content-width-zoom)', minWidth: '100%' } as any}
                  onMouseMove={handleSeekHover}
                  onClick={(e) => { if (e.target === e.currentTarget) seekTo(e.clientX) }}
                >
                   {/* Global Object Matrix Overlay */}
                   <div className="absolute inset-0 pointer-events-none opacity-[0.03] timeline-grid-dots" />

                   {/* DYNAMIC LANES RENDERING */}
                   <div className="space-y-2">
                       {/* AI DIRECTOR LANE CANVAS (NEW) */}
                         {/* AI Director Lane (New) */}
                     {/* RETENTION HEATMAP OVERLAY TRACK (ENHANCED) */}
                    <div className="relative h-6 w-full bg-black/40 rounded-xl border border-white/5 mb-6 group/heatmap overflow-hidden">
                       <div className="absolute inset-y-0 left-0 flex items-center px-4 z-10 pointer-events-none">
                          <Activity className="w-3 h-3 text-indigo-400 opacity-50" />
                          <span className="text-[7px] font-black text-indigo-400/50 uppercase tracking-[0.2em] ml-2">Retention Heatmap // AI Prediction</span>
                       </div>
                      {engagementScore?.retentionHeatmap.map((val, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${(i / engagementScore.retentionHeatmap.length) * 100}%`,
                            width: `${(1 / engagementScore.retentionHeatmap.length) * 100}%`,
                            height: '100%',
                            backgroundColor: val > 85 ? '#F43F5E' : val > 70 ? '#6366F1' : val > 50 ? '#4F46E5' : '#1E1B4B',
                          }}
                          className="transition-all opacity-40 hover:opacity-100"
                          title={`Retention: ${val}%`}
                        />
                      ))}
                    </div>

                    {/* V4: NEURAL WAVEFORM TRACK */}
                    <div className="relative h-14 w-full bg-white/[0.02] border border-white/5 rounded-2xl mb-8 overflow-hidden group/waveform shadow-inner">
                       <div className="absolute inset-y-0 left-6 flex items-center z-10 pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse mr-3 shadow-[0_0_10px_rgba(232,121,249,0.8)]" />
                          <span className="text-[8px] font-black text-fuchsia-400 uppercase tracking-[0.4em] italic opacity-60">{waveformHasAudio ? 'Audio Waveform' : (waveformKey ? 'Audio Waveform // No Audio' : 'Audio Waveform')}</span>
                       </div>

                       {/* Playhead Reflection on Waveform */}
                       <div className="absolute top-0 bottom-0 w-[2px] bg-white/10 z-[5] pointer-events-none backdrop-blur-sm" style={{ '--playhead-left-ghost': `${timeToX(currentTime)}%`, left: 'var(--playhead-left-ghost)' } as any} />

                       <svg className="absolute inset-0 w-full h-full preserve-3d text-fuchsia-400 opacity-60 group-hover/waveform:opacity-100 transition-opacity duration-700" preserveAspectRatio="none" viewBox="0 0 100 48">
                          <defs>
                             <linearGradient id="waveform-grad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.1" />
                                <stop offset="50%" stopColor="#c084fc" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
                             </linearGradient>
                             <filter id="wave-glow">
                                <feGaussianBlur stdDeviation="0.5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                             </filter>
                          </defs>
                          <path
                            d={waveformPath}
                            fill={waveformPeaks.length ? 'url(#waveform-grad)' : 'none'}
                            stroke={waveformPeaks.length ? 'none' : 'currentColor'}
                            strokeWidth={waveformPeaks.length ? 0 : 0.4}
                            strokeOpacity={0.4}
                            filter={waveformPeaks.length ? 'url(#wave-glow)' : undefined}
                            className="transition-all duration-700"
                          />
                       </svg>
                       <motion.div
                          animate={{ x: ['-20%', '120%'], opacity: [0, 0.2, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-y-0 w-80 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[30deg]"
                       />

                       {/* Background Glow */}
                       <div className="absolute inset-x-0 bottom-0 h-[1px] bg-white/5" />
                    </div>

                    {/* V4: SCENE TRANSITION PORTALS */}
                    {transcript?.scenes?.map((scene, i) => {
                       if (i === 0) return null
                       return (
                          <motion.div
                            key={`portal-${i}`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.5, rotate: 90 }}
                            style={{
                               position: 'absolute',
                               left: `${timeToX(scene.startTime)}%`,
                               top: '40px',
                               zIndex: 100
                            }}
                            className="w-4 h-4 rounded-full bg-fuchsia-600 border border-white/40 shadow-[0_0_15px_rgba(217,70,239,0.8)] cursor-pointer flex items-center justify-center group/portal"
                            title="AI Transition Suggestion"
                          >
                             <Zap className="w-2 h-2 text-white" />
                             <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/10 p-2 rounded-lg opacity-0 group-hover/portal:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                <p className="text-[8px] font-black uppercase text-fuchsia-400">Suggest: Glitch Dissolve</p>
                             </div>
                          </motion.div>
                       )
                    })}

                  {(!focusLane || focusLane === 'ai') && (
                         <div className="h-20 relative rounded-2xl bg-indigo-500/5 border border-indigo-500/10 transition-all duration-500 mb-2">
                            {aiDirectorSuggestions.map(suggestion => (
                              <motion.div
                                key={suggestion.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.1, zIndex: 50 }}
                                style={{
                                  position: 'absolute',
                                  left: `${timeToX(suggestion.time)}%`,
                                  top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-help whitespace-nowrap border ${
                                  suggestion.impact === 'high'
                                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/40'
                                    : 'bg-white/10 border-white/20 text-indigo-200'
                                }`}
                                title={`${suggestion.label}: ${suggestion.description}`}
                              >
                                <Zap className={`w-3 h-3 ${suggestion.impact === 'high' ? 'fill-white' : 'fill-indigo-400'}`} />
                                <span className="text-[10px] font-bold">{suggestion.label}</span>
                              </motion.div>
                            ))}
                         </div>
                       )}

                       {/* HYBRID SCRIPT VIEW TRACK (HORIZONTAL) */}
                       {(timelineMode === 'hybrid') && (
                         <div className="relative h-24 w-full bg-white/[0.02] rounded-2xl border border-white/5 mb-6 overflow-hidden custom-scrollbar-thin">
                            <div className="absolute inset-y-0 left-4 flex items-center z-10 pointer-events-none opacity-20">
                               <MessageSquare className="w-4 h-4 text-indigo-400" />
                               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-3">Neural Script Lane</span>
                            </div>
                            <div className="h-full flex items-center px-12 gap-1 relative">
                               {visibleWords.map((word, idx) => {
                                 const isActive = currentTime >= word.start && currentTime <= word.end
                                 return (
                                   <motion.div
                                     key={idx}
                                     onClick={() => onTimeUpdate(word.start)}
                                     style={{
                                       position: 'absolute',
                                       left: `${timeToX(word.start)}%`,
                                       minWidth: `${timeToX(word.end) - timeToX(word.start)}%`
                                     }}
                                     className={`cursor-pointer px-1 py-1 rounded-md text-[13px] font-black transition-all whitespace-nowrap ${
                                       isActive ? 'text-white bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-110 z-10' : 'text-slate-500 hover:text-white'
                                     }`}
                                   >
                                     {word.text}
                                   </motion.div>
                                 )
                               })}
                            </div>
                         </div>
                       )}

                       {/* SPEECH NODES LANE CANVAS */}
                       {(!focusLane || focusLane === 'captions') && (
                        <div
                          data-track-drop={4}
                          className={`h-24 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'captions' ? 'bg-emerald-500/[0.05] border-emerald-500/20' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => handleTrackDrop(e, 4)}
                        >
                            {/* Scene Headers Rendering (ENHANCED) */}
                            {transcript?.scenes?.map((scene) => (
                              <div
                                key={scene.id}
                                onClick={() => onTimeUpdate(scene.startTime)}
                                style={{
                                  position: 'absolute',
                                  left: `${timeToX(scene.startTime)}%`,
                                  width: `${timeToX(scene.endTime) - timeToX(scene.startTime)}%`,
                                  height: '100%',
                                }}
                                className="group/scene cursor-pointer z-10"
                              >
                                <div className={`absolute top-0 left-0 bottom-0 border-l-2 border-dashed transition-all ${currentScene?.id === scene.id ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 group-hover/scene:border-white/30 group-hover/scene:bg-white/5'}`} />
                                <div className="absolute top-2 left-3 flex items-center gap-2 transition-transform group-hover/scene:translate-x-1 pointer-events-none">
                                  <div className={`w-1.5 h-1.5 rounded-full ${currentScene?.id === scene.id ? 'bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'bg-slate-700'}`} />
                                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${currentScene?.id === scene.id ? 'text-white italic' : 'text-slate-500 group-hover/scene:text-slate-300'}`}>
                                    {scene.title}
                                  </span>
                                </div>
                              </div>
                            ))}
                           {visibleTextOverlays.map(o => (
                             <motion.div
                               key={o.id}
                               layoutId={o.id}
                               style={{ '--overlay-left': `${timeToX(o.startTime)}%`, '--overlay-width': `${timeToX(o.endTime) - timeToX(o.startTime)}%`, left: 'var(--overlay-left)', width: 'var(--overlay-width)' } as any}
                               whileHover={{ scaleY: 1.05 }}
                               whileTap={{ scale: 0.98 }}
                               className={`absolute top-4 bottom-4 rounded-xl border-2 flex flex-col justify-center px-4 cursor-pointer group/node transition-all duration-300 ${selectedIds.includes(o.id) ? 'bg-emerald-500/40 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] z-30 ring-2 ring-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 z-20 hover:border-emerald-500/50'}`}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(o.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleOverlayBodyMouseDown(e, o)}
                             >
                                {selectedIds.includes(o.id) && (
                                   <motion.div
                                      layoutId={`selection-glow-${o.id}`}
                                      className="absolute -inset-[2px] rounded-xl border-2 border-white/40 pointer-events-none animate-pulse"
                                   />
                                )}
                                <div className="flex items-center gap-2">
                                   <Type className="w-3 h-3 text-emerald-400" />
                                   <span className="text-[10px] font-black text-white italic truncate uppercase">{o.text}</span>
                                </div>
                                <div className="text-[8px] font-bold text-emerald-400/60 uppercase tracking-widest mt-1">
                                   {formatTime(o.endTime - o.startTime)}
                                </div>

                                {/* Precision Resize Handles (Bug 2: overlay-specific retiming) */}
                                <div onMouseDown={(e) => handleOverlayEdgeMouseDown(e, o, 'start')} className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 transition-opacity" />
                                <div onMouseDown={(e) => handleOverlayEdgeMouseDown(e, o, 'end')} className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 transition-opacity" />
                             </motion.div>
                           ))}
                        </div>
                      )}

                      {/* LANE: PRIME SEQUENCE NODES (A-ROLL) */}
                      {(!focusLane || focusLane === 'a-roll') && (
                        <div
                          data-track-drop={0}
                          className={`h-32 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'a-roll' ? 'bg-blue-500/[0.05] border-blue-500/20' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => handleTrackDrop(e, 0)}
                        >
                           {visibleSegments.filter(s => s.track < 2).map(s => (
                             <React.Fragment key={s.id}>
                               {/* J-Cut Audio Extension Wing */}
                               {s.audioLeadInSec && s.audioLeadInSec > 0 && (
                                 <div
                                   style={{
                                     position: 'absolute',
                                     left: `${timeToX(Math.max(0, s.startTime - s.audioLeadInSec))}%`,
                                     width: `${timeToX(s.startTime) - timeToX(Math.max(0, s.startTime - s.audioLeadInSec))}%`,
                                     top: '6px',
                                     bottom: '6px',
                                     zIndex: 10,
                                   }}
                                   className="bg-gradient-to-r from-rose-500/0 to-rose-500/30 border-y border-l border-rose-500/40 rounded-l-lg pointer-events-none flex items-center justify-end pr-1 overflow-hidden"
                                 >
                                   <div className="flex gap-0.5 items-center opacity-60">
                                     <div className="w-[1px] h-2 bg-rose-400 animate-pulse" />
                                     <div className="w-[1px] h-3 bg-rose-400" />
                                     <div className="w-[1px] h-1 bg-rose-400" />
                                   </div>
                                   <span className="text-[7px] font-black text-rose-300 uppercase tracking-widest ml-1 select-none whitespace-nowrap">J-Cut</span>
                                 </div>
                               )}

                               {/* L-Cut Audio Extension Wing */}
                               {s.audioTailOutSec && s.audioTailOutSec > 0 && (
                                 <div
                                   style={{
                                     position: 'absolute',
                                     left: `${timeToX(s.endTime)}%`,
                                     width: `${timeToX(Math.min(maxDur, s.endTime + s.audioTailOutSec)) - timeToX(s.endTime)}%`,
                                     top: '6px',
                                     bottom: '6px',
                                     zIndex: 10,
                                   }}
                                   className="bg-gradient-to-r from-pink-500/30 to-pink-500/0 border-y border-r border-pink-500/40 rounded-r-lg pointer-events-none flex items-center pl-1 overflow-hidden"
                                 >
                                   <span className="text-[7px] font-black text-pink-300 uppercase tracking-widest mr-1 select-none whitespace-nowrap">L-Cut</span>
                                   <div className="flex gap-0.5 items-center opacity-60">
                                     <div className="w-[1px] h-1 bg-pink-400" />
                                     <div className="w-[1px] h-3 bg-pink-400" />
                                     <div className="w-[1px] h-2 bg-pink-400 animate-pulse" />
                                   </div>
                                 </div>
                               )}

                               <motion.div
                                 layoutId={s.id}
                                 style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                                 className={`absolute top-1 bottom-1 rounded-lg flex flex-col justify-center px-3 cursor-pointer group/node transition-all overflow-hidden
                                   ${selectedIds.includes(s.id) ? 'z-30 ring-2 ring-blue-500 bg-blue-600' : 'z-20 bg-blue-900/80 hover:bg-blue-800'}
                                   ${s.groupId ? 'border-l-4 border-l-fuchsia-400/80 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.4)]' : ''}
                                   border border-blue-400/20
                                 `}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(s.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, s)}
                             >
                                {/* Filmstrip BG: real ffmpeg thumbnails when loaded, else the
                                    decorative stripe (no fabricated frames). */}
                                {(() => {
                                  const frames = filmstripForSegment(s)
                                  return frames
                                    ? <div className="absolute inset-0 opacity-40 pointer-events-none rounded-lg" style={filmstripStyle(frames)} />
                                    : <div className="absolute inset-0 opacity-10 pointer-events-none flex timeline-stripe-vertical" />
                                })()}

                                {/* Cut indicators */}
                                {s.startTime > 0 && <div className="absolute left-0 top-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-white/30 border-r-transparent pointer-events-none" title="Trimmed Start" />}
                                {s.endTime < maxDur && <div className="absolute right-0 bottom-0 w-0 h-0 border-b-[8px] border-l-[8px] border-b-white/30 border-l-transparent pointer-events-none" title="Trimmed End" />}

                                <div className="flex items-center justify-between relative z-10 w-full pr-2">
                                   <div className="flex items-center gap-3">
                                      <div className="p-1.5 bg-black/40 rounded-lg backdrop-blur-md border border-white/10 group-hover/node:bg-blue-500/20 transition-colors">
                                        <Video className="w-3.5 h-3.5 text-blue-300" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                         <span className="text-[11px] font-black text-white italic truncate uppercase drop-shadow-md">{s.name}</span>
                                         <span className="text-[9px] font-bold text-blue-200/70 uppercase tracking-widest">{formatTime(s.endTime - s.startTime)}</span>
                                      </div>
                                   </div>

                                   {/* Speed Ramp / FX Indicator */}
                                   <div className="flex items-center gap-1.5 bg-blue-950/50 backdrop-blur-sm border border-blue-400/20 px-2 py-1 rounded shadow-lg group-hover/node:bg-blue-900/60 transition-colors">
                                      <Activity className="w-2.5 h-2.5 text-blue-300" />
                                      <span className="text-[8px] font-black text-blue-200 uppercase tracking-widest">100% Warp</span>
                                   </div>
                                </div>

                                {s.transcriptText && (
                                  <div className="mt-2 text-[10px] font-black text-white/50 truncate italic bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md border border-white/10 relative z-10 w-fit max-w-[80%] shadow">
                                    &quot;{s.transcriptText}&quot;
                                  </div>
                                )}

                                {/* Resize Handles */}
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'start')} className="absolute left-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-r border-transparent hover:border-blue-400/50 transition-colors">
                                   <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'end')} className="absolute right-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-l border-transparent hover:border-blue-400/50 transition-colors">
                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                                {/* Keyframe Connector Line */}
                                {s.transformKeyframes && s.transformKeyframes.length > 1 && (() => {
                                  const sorted = [...s.transformKeyframes].sort((a,b) => a.time - b.time);
                                  const firstRel = Math.max(0, sorted[0].time - s.startTime);
                                  const lastRel = Math.min(s.endTime - s.startTime, sorted[sorted.length - 1].time - s.startTime);
                                  const segDur = s.endTime - s.startTime;
                                  if (segDur <= 0 || firstRel >= lastRel) return null;
                                  const startPct = (firstRel / segDur) * 100;
                                  const widthPct = ((lastRel - firstRel) / segDur) * 100;
                                  return (
                                      <div
                                          className="absolute bottom-[4px] h-px bg-white/40 z-20 pointer-events-none shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                                          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                      />
                                  )
                                })()}

                                {/* Keyframe Diamonds */}
                                {s.transformKeyframes && s.transformKeyframes.map((kf) => {
                                  // kf.time is absolute time in seconds. We need relative position % within the segment.
                                  const relTime = kf.time - s.startTime;
                                  const segDur = s.endTime - s.startTime;
                                  if (relTime < 0 || relTime > segDur || segDur <= 0) return null;

                                  const percentX = (relTime / segDur) * 100;

                                  return (
                                    <div
                                      key={`kf-${s.id}-${kf.id}`}
                                      className="absolute bottom-1 w-2.5 h-2.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-30 cursor-ew-resize transition-transform hover:scale-150 rotate-45"
                                      style={{ '--kf-marker-left': `calc(${percentX}% - 5px)`, left: 'var(--kf-marker-left)' } as any}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        // Simple dragging logic
                                        const startX = e.clientX;
                                        const startKfTime = kf.time;
                                        const onMove = (moveEvt: MouseEvent) => {
                                          const contentEl = contentRef.current;
                                          if (!contentEl) return;
                                          const deltaX = moveEvt.clientX - startX;
                                          // Bug 7: use inner zoomed content width for accurate delta at any zoom.
                                          const innerEl = contentEl.firstElementChild as HTMLElement | null;
                                          const cw = innerEl?.offsetWidth || contentEl.offsetWidth;
                                          const deltaTime = (deltaX / cw) * maxDur;
                                          const newTime = Math.max(s.startTime, Math.min(s.endTime, startKfTime + deltaTime));

                                          if (onSegmentsChange) {
                                              onSegmentsChange(prev => prev.map(seg => {
                                                  if (seg.id !== s.id || !seg.transformKeyframes) return seg;
                                                  return {
                                                      ...seg,
                                                      transformKeyframes: seg.transformKeyframes.map(k => k.id === kf.id ? { ...k, time: newTime } : k).sort((a,b) => a.time - b.time)
                                                  }
                                              }))
                                          }
                                        };
                                        const onUp = () => {
                                          window.removeEventListener('mousemove', onMove);
                                          window.removeEventListener('mouseup', onUp);
                                        };
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                      }}
                                    />
                                  )
                                })}
                             </motion.div>
                            </React.Fragment>
                           ))}
                        </div>
                      )}

                      {/* LANE: VISUAL ASSETS NODES (B-ROLL) */}
                      {(!focusLane || focusLane === 'b-roll') && (
                        <div
                          data-track-drop={2}
                          className={`h-28 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'b-roll' ? 'bg-amber-500/[0.05] border-amber-500/20' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => handleTrackDrop(e, 2)}
                        >
                           {visibleSegments.filter(s => s.track >= 2 && s.track < 5).map(s => (
                             <motion.div
                               key={s.id}
                               layoutId={s.id}
                               style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                               className={`absolute top-1 bottom-1 rounded-lg flex items-center px-3 gap-2 cursor-pointer group/node transition-all overflow-hidden
                                 ${selectedIds.includes(s.id) ? 'z-30 ring-2 ring-amber-500 bg-amber-600' : 'z-20 bg-amber-900/80 hover:bg-amber-800'}
                                 ${s.groupId ? 'border-l-4 border-l-fuchsia-400/80 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.4)]' : ''}
                                 border border-amber-400/20
                               `}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(s.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, s)}
                             >
                                {/* Filmstrip BG: real ffmpeg thumbnails when loaded, else the
                                    decorative stripe (no fabricated frames). */}
                                {(() => {
                                  const frames = filmstripForSegment(s)
                                  return frames
                                    ? <div className="absolute inset-0 opacity-40 pointer-events-none rounded-lg" style={filmstripStyle(frames)} />
                                    : <div className="absolute inset-0 opacity-10 pointer-events-none timeline-stripe-diagonal" />
                                })()}

                                <div className="p-1.5 bg-black/40 rounded-lg backdrop-blur-md border border-white/10 group-hover/node:bg-amber-500/20 transition-colors z-10 shrink-0">
                                  <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                                </div>
                                <div className="flex flex-col min-w-0 z-10">
                                   <span className="text-[10px] font-black text-white italic truncate uppercase drop-shadow-md">{s.name}</span>
                                   <span className="text-[9px] font-bold text-amber-200/70 uppercase tracking-widest">{formatTime(s.endTime - s.startTime)}</span>
                                </div>

                                {/* Resize Handles */}
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'start')} className="absolute left-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-r border-transparent hover:border-amber-400/50 transition-colors">
                                   <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'end')} className="absolute right-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-l border-transparent hover:border-amber-400/50 transition-colors">
                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                                {/* Keyframe Connector Line */}
                                {s.transformKeyframes && s.transformKeyframes.length > 1 && (() => {
                                  const sorted = [...s.transformKeyframes].sort((a,b) => a.time - b.time);
                                  const firstRel = Math.max(0, sorted[0].time - s.startTime);
                                  const lastRel = Math.min(s.endTime - s.startTime, sorted[sorted.length - 1].time - s.startTime);
                                  const segDur = s.endTime - s.startTime;
                                  if (segDur <= 0 || firstRel >= lastRel) return null;
                                  const startPct = (firstRel / segDur) * 100;
                                  const widthPct = ((lastRel - firstRel) / segDur) * 100;
                                  return (
                                      <div
                                          className="absolute bottom-[4px] h-px bg-white/40 z-20 pointer-events-none shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                                          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                      />
                                  )
                                })()}

                                {/* Keyframe Diamonds */}
                                {s.transformKeyframes && s.transformKeyframes.map((kf) => {
                                  const relTime = kf.time - s.startTime;
                                  const segDur = s.endTime - s.startTime;
                                  if (relTime < 0 || relTime > segDur || segDur <= 0) return null;
                                  const percentX = (relTime / segDur) * 100;

                                  return (
                                    <div
                                      key={`kf-b-${s.id}-${kf.id}`}
                                      className="absolute bottom-1 w-2 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-30 cursor-ew-resize transition-transform hover:scale-150 rotate-45"
                                      style={{ '--kf-marker-left-audio': `calc(${percentX}% - 4px)`, left: 'var(--kf-marker-left-audio)', height: '8px' } as any}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        const startX = e.clientX;
                                        const startKfTime = kf.time;
                                        const onMove = (moveEvt: MouseEvent) => {
                                          const contentEl = contentRef.current;
                                          if (!contentEl) return;
                                          const deltaX = moveEvt.clientX - startX;
                                          // Bug 7: use inner zoomed content width for accurate delta at any zoom.
                                          const innerEl = contentEl.firstElementChild as HTMLElement | null;
                                          const cw = innerEl?.offsetWidth || contentEl.offsetWidth;
                                          const deltaTime = (deltaX / cw) * maxDur;
                                          const newTime = Math.max(s.startTime, Math.min(s.endTime, startKfTime + deltaTime));

                                          if (onSegmentsChange) {
                                              onSegmentsChange(prev => prev.map(seg => {
                                                  if (seg.id !== s.id || !seg.transformKeyframes) return seg;
                                                  return {
                                                      ...seg,
                                                      transformKeyframes: seg.transformKeyframes.map(k => k.id === kf.id ? { ...k, time: newTime } : k).sort((a,b) => a.time - b.time)
                                                  }
                                              }))
                                          }
                                        };
                                        const onUp = () => {
                                          window.removeEventListener('mousemove', onMove);
                                          window.removeEventListener('mouseup', onUp);
                                        };
                                        window.addEventListener('mousemove', onMove);
                                        window.addEventListener('mouseup', onUp);
                                      }}
                                    />
                                  )
                                })}
                             </motion.div>
                           ))}
                        </div>
                      )}

                      {/* LANE: AUDIO ASSETS NODES */}
                      {(!focusLane || focusLane === 'audio') && (
                        <div
                          data-track-drop={6}
                          className={`h-24 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'audio' ? 'bg-fuchsia-500/[0.05] border-fuchsia-500/20' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => handleTrackDrop(e, 6)}
                        >
                           {visibleSegments.filter(s => s.track >= 6).map(s => (
                             <motion.div
                               key={s.id}
                               layoutId={s.id}
                               style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                               className={`absolute top-1 bottom-1 rounded-lg flex items-center px-3 gap-2 cursor-pointer group/node transition-all overflow-hidden
                                 ${selectedIds.includes(s.id) ? 'z-30 ring-2 ring-orange-500 bg-orange-600' : 'z-20 bg-orange-900/80 hover:bg-orange-800'}
                                 ${s.groupId ? 'border-l-4 border-l-fuchsia-400/80 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.4)]' : ''}
                                 border border-orange-400/20
                               `}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(s.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, s)}
                             >
                                 <div className="p-1.5 bg-black/40 rounded-lg backdrop-blur-md border border-white/10 group-hover/node:bg-orange-500/20 transition-colors z-10 shrink-0">
                                    <Radio className="w-3.5 h-3.5 text-orange-300" />
                                 </div>
                                 <div className="flex-1 h-full flex items-center justify-around gap-[1px] opacity-60 pointer-events-none overflow-hidden mix-blend-screen relative">
                                    {/* Artificial Audio Gain Line */}
                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/40 shadow-[0_0_5px_rgba(255,255,255,0.8)] z-20 pointer-events-none" />

                                    {[...Array(60)].map((_, i) => {
                                       const charCode = s.id?.charCodeAt(0) || 0
                                       const raw = Math.sin((charCode + i) * 0.4) * Math.cos(i * 0.1)
                                       const h = Math.max(5, 10 + Math.abs(raw) * 80)
                                       return (
                                          <div
                                            key={i}
                                            className="flex-1 bg-gradient-to-t from-orange-600 via-orange-400 to-orange-200 rounded-full opacity-80"
                                            style={{ '--bar-height': `${h}%`, height: 'var(--bar-height)', minWidth: '2px', maxWidth: '4px' } as any}
                                          />
                                       )
                                    })}
                                 </div>
                                <div className="flex flex-col min-w-0 z-10">
                                   <span className="text-[10px] font-black text-white italic truncate uppercase drop-shadow-md">{s.name}</span>
                                   <span className="text-[9px] font-bold text-orange-200/70 uppercase tracking-widest">{formatTime(s.endTime - s.startTime)}</span>
                                </div>

                                {/* Resize Handles */}
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'start')} className="absolute left-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-r border-transparent hover:border-orange-400/50 transition-colors">
                                   <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, s, 'end')} className="absolute right-0 top-0 bottom-0 w-4 hover:bg-white/10 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center border-l border-transparent hover:border-orange-400/50 transition-colors">
                                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                                </div>
                             </motion.div>
                           ))}
                        </div>
                      )}

                      {/* LANE: EFFECTS (NEURAL LAYERS) — retimable effect blocks */}
                      {(!focusLane || focusLane === 'fx') && (
                        <div
                          className={`h-20 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'fx' ? 'bg-violet-500/[0.05] border-violet-500/20' : ''}`}
                        >
                           {/* Lane label */}
                           <div className="absolute inset-y-0 left-4 flex items-center z-10 pointer-events-none opacity-30">
                              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest ml-3">Neural Layers // Effects</span>
                           </div>

                           {visibleEffects.map((eff) => {
                             const left = timeToX(eff.startTime)
                             const width = Math.max(0, timeToX(eff.endTime) - timeToX(eff.startTime))
                             const color = eff.color || EFFECT_TYPE_COLORS[eff.type] || '#8B5CF6'
                             const isSelected = selectedEffectId === eff.id
                             const disabled = eff.enabled === false
                             return (
                               <motion.div
                                 key={eff.id}
                                 layoutId={`effect-${eff.id}`}
                                 style={{ left: `${left}%`, width: `${width}%`, backgroundColor: `${color}33`, borderColor: `${color}80` }}
                                 whileTap={{ scale: 0.98 }}
                                 className={`absolute top-3 bottom-3 rounded-lg flex items-center px-3 gap-2 group/node transition-all overflow-hidden border ${eff.locked ? 'cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'z-30 ring-2 ring-white/70 shadow-[0_0_24px_rgba(139,92,246,0.5)]' : 'z-20 hover:brightness-125'} ${disabled ? 'opacity-40 saturate-50' : ''}`}
                                 onClick={(e) => { e.stopPropagation(); onEffectSelect?.(eff.id) }}
                                 onMouseDown={(e) => handleEffectBodyMouseDown(e, eff)}
                               >
                                  <div className="p-1 rounded-md bg-black/40 border border-white/10 backdrop-blur-md shrink-0">
                                     {eff.locked ? <Lock className="w-3 h-3 text-white/80" /> : <Sparkles className="w-3 h-3" style={{ color }} />}
                                  </div>
                                  <div className="flex flex-col min-w-0 z-10">
                                     <span className="text-[10px] font-black text-white italic truncate uppercase drop-shadow-md">{eff.name}</span>
                                     <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">{eff.type} · {formatTime(eff.endTime - eff.startTime)}</span>
                                  </div>

                                  {/* Edge-trim handles (skipped when locked) */}
                                  {!eff.locked && (
                                    <>
                                      <div data-resize-handle onMouseDown={(e) => handleEffectEdgeMouseDown(e, eff, 'start')} className="absolute left-0 top-0 bottom-0 w-3 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center transition-colors">
                                         <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                                      </div>
                                      <div data-resize-handle onMouseDown={(e) => handleEffectEdgeMouseDown(e, eff, 'end')} className="absolute right-0 top-0 bottom-0 w-3 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 z-20 flex items-center justify-center transition-colors">
                                         <div className="w-0.5 h-3 bg-white/50 rounded-full" />
                                      </div>
                                    </>
                                  )}
                               </motion.div>
                             )
                           })}
                        </div>
                      )}

                      {/* LANE: KEYFRAMES — dedicated row for the selected clip's transform
                          keyframes. Appears only when a keyframe-capable clip is selected.
                          Diamonds are positioned by absolute time via timeToX (full zoomed
                          content width, like every other lane). Drag = retime, dbl-click empty
                          = add, click = select, Delete = remove. Lock state is respected. */}
                      {(() => {
                        if (!selectedSegment) return null
                        const kfCapable = selectedSegment.type === 'video' || selectedSegment.type === 'image' || selectedSegment.type === 'broll' || selectedSegment.type === 'gif'
                        const hasKeyframes = !!(selectedSegment.transformKeyframes && selectedSegment.transformKeyframes.length)
                        if (!kfCapable && !hasKeyframes) return null
                        const seg = selectedSegment
                        const segLocked = isSegmentLocked(seg.id)
                        const segLeft = timeToX(seg.startTime)
                        const segWidth = Math.max(0, timeToX(seg.endTime) - timeToX(seg.startTime))
                        const kfs = seg.transformKeyframes || []
                        // Convert a pointer clientX to an absolute timeline time using the
                        // inner zoomed content width (matches the keyframe drag math).
                        const clientXToTime = (clientX: number): number | null => {
                          const contentEl = contentRef.current
                          if (!contentEl) return null
                          const innerEl = (contentEl.firstElementChild as HTMLElement | null) ?? contentEl
                          const rect = innerEl.getBoundingClientRect()
                          if (rect.width <= 0) return null
                          return ((clientX - rect.left) / rect.width) * maxDur
                        }
                        return (
                          <div className="h-12 relative rounded-2xl border border-white/[0.03] bg-cyan-500/[0.04] overflow-hidden">
                            {/* Lane label */}
                            <div className="absolute inset-y-0 left-4 flex items-center z-20 pointer-events-none opacity-40">
                              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest ml-3">Keyframes</span>
                            </div>
                            {/* Selected clip range track + dbl-click-to-add zone */}
                            <div
                              className={`absolute top-0 bottom-0 ${segLocked ? 'cursor-not-allowed' : 'cursor-copy'}`}
                              style={{ left: `${segLeft}%`, width: `${segWidth}%` }}
                              onDoubleClick={(e) => {
                                if (segLocked) return
                                e.stopPropagation()
                                const at = clientXToTime(e.clientX)
                                if (at != null) addSegmentKeyframe(seg.id, at)
                              }}
                            >
                              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-cyan-400/30" />
                            </div>
                            {/* Keyframe connector line */}
                            {kfs.length > 1 && (() => {
                              const sorted = [...kfs].sort((a, b) => a.time - b.time)
                              const firstX = timeToX(sorted[0].time)
                              const lastX = timeToX(sorted[sorted.length - 1].time)
                              if (lastX <= firstX) return null
                              return (
                                <div className="absolute top-1/2 -translate-y-1/2 h-px bg-cyan-300/50 z-10 pointer-events-none shadow-[0_0_5px_rgba(34,211,238,0.5)]"
                                  style={{ left: `${firstX}%`, width: `${lastX - firstX}%` }} />
                              )
                            })()}
                            {/* Keyframe diamonds */}
                            {kfs.map((kf) => {
                              if (kf.time < seg.startTime - 1e-6 || kf.time > seg.endTime + 1e-6) return null
                              const x = timeToX(kf.time)
                              const isSel = selectedKeyframeId === kf.id
                              return (
                                <div
                                  key={`kflane-${kf.id}`}
                                  className={`absolute top-1/2 w-3 h-3 rotate-45 z-30 transition-transform hover:scale-150 ${segLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'} ${isSel ? 'bg-white ring-2 ring-cyan-300 shadow-[0_0_12px_rgba(34,211,238,1)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]'}`}
                                  style={{ '--kflane-left': `calc(${x}% - 6px)`, left: 'var(--kflane-left)', transform: 'translateY(-50%) rotate(45deg)' } as any}
                                  title={`${displayTime(kf.time)}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedKeyframeId(kf.id) }}
                                  onMouseDown={(e) => {
                                    if (segLocked) return
                                    e.stopPropagation()
                                    setSelectedKeyframeId(kf.id)
                                    const startX = e.clientX
                                    const startKfTime = kf.time
                                    const onMove = (moveEvt: MouseEvent) => {
                                      const contentEl = contentRef.current
                                      if (!contentEl) return
                                      const innerEl = contentEl.firstElementChild as HTMLElement | null
                                      const cw = innerEl?.offsetWidth || contentEl.offsetWidth
                                      if (!cw) return
                                      const deltaTime = ((moveEvt.clientX - startX) / cw) * maxDur
                                      retimeSegmentKeyframe(seg.id, kf.id, startKfTime + deltaTime)
                                    }
                                    const onUp = () => {
                                      window.removeEventListener('mousemove', onMove)
                                      window.removeEventListener('mouseup', onUp)
                                    }
                                    window.addEventListener('mousemove', onMove)
                                    window.addEventListener('mouseup', onUp)
                                  }}
                                />
                              )
                            })}
                          </div>
                        )
                      })()}
                   </div>

                   {/* Master Playhead (Neural Thread) */}
                   <motion.div
                     className="absolute top-0 bottom-0 w-[1px] bg-fuchsia-500 z-50 pointer-events-none timeline-playhead-glow"
                     style={{ '--progress-left-vis': `${progress}%`, left: 'var(--progress-left-vis)' } as any}
                   >
                     {/* Playhead Diamond Head */}
                     <div className="absolute top-[-4px] left-[-7px] w-3.5 h-3.5 bg-fuchsia-500 rotate-45 border border-white/20 shadow-[0_0_20px_rgba(217,70,239,1)]" />
                     {/* Playhead Center Glow */}
                     <div className="absolute top-0 bottom-0 w-[1px] bg-white opacity-50" />
                     {/* Wide Body Gradient */}
                     <div className="absolute top-4 left-[-2px] w-[5px] h-full bg-gradient-to-b from-fuchsia-500/50 via-fuchsia-500/10 to-transparent blur-[2px]" />
                     {/* Playhead Timecode Floating Tag */}
                     <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 px-2 py-0.5 bg-fuchsia-950/80 backdrop-blur-md border border-fuchsia-500/30 rounded text-[10px] font-black text-fuchsia-100 uppercase shadow-2xl tracking-widest whitespace-nowrap">
                        {displayTime(currentTime)}
                     </div>
                   </motion.div>

                    {/* GHOSTING & SPATIAL TRANSFORM OVERLAY (MULTI-SUPPORT) */}
                    {draggingSegmentId && (
                      <div className="absolute top-0 bottom-0 pointer-events-none z-10">
                        {segments.filter(s => selectedIds.includes(s.id)).map(seg => (
                          <div
                            key={`ghost-${seg.id}`}
                            className="absolute top-0 bottom-0 border-l border-dashed border-white/20"
                            style={{
                              left: `${timeToX(seg.startTime)}%`,
                              width: `${timeToX(seg.endTime) - timeToX(seg.startTime)}%`
                            }}
                          >
                            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] border border-white/10" />
                            <div className="absolute -top-6 left-0 text-[10px] font-black text-white/20 uppercase tracking-tighter shadow-sm whitespace-nowrap">
                              Ghost_Origin: {formatTime(seg.startTime)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SPATIAL TRACKER (BREADCRUMB) VISUALIZATION */}
                    {(selectedSegment || selectedIds.length > 0) && (
                      <div className="absolute top-0 bottom-0 pointer-events-none z-10">
                        {(selectedSegment ? [selectedSegment] : segments.filter(s => selectedIds.includes(s.id))).map(seg => (
                           <div key={`breadcrumb-${seg.id}`} className="absolute top-0 bottom-0 overflow-hidden" style={{ '--bread-left': `${timeToX(seg.startTime)}%`, '--bread-width': `${timeToX(seg.endTime) - timeToX(seg.startTime)}%`, left: 'var(--bread-left)', width: 'var(--bread-width)' } as any}>
                              <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[1px]" />
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500/50" />
                              <div className="absolute top-0 left-0 right-0 h-px bg-white/20" />
                           </div>
                        ))}
                      </div>
                    )}

                    {/* DYNAMIC MAGNETIC SNAP GUIDES (LASERS) */}
                    {snapEnabled && draggingSegmentId && magneticEdges.map((edgeTime) => (
                      <div
                        key={`snap-${edgeTime}`}
                        className="absolute top-0 bottom-0 w-px bg-indigo-400/50 pointer-events-none z-40 transition-opacity duration-200"
                        style={{
                          left: `${(edgeTime / maxDur) * 100}%`,
                          boxShadow: '0 0 10px rgba(99,102,241,0.5)',
                        }}
                      />
                    ))}

                    {/* ACTIVE SNAP GUIDELINE — shows what the drag locked onto (Word / Beat / Edge…) */}
                    {snapEnabled && activeSnap && maxDur > 0 && (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none z-50"
                        style={{ left: `${(activeSnap.time / maxDur) * 100}%` }}
                      >
                        <div
                          className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2"
                          style={{ background: SNAP_KIND_COLOR[activeSnap.kind], boxShadow: `0 0 12px ${SNAP_KIND_COLOR[activeSnap.kind]}` }}
                        />
                        <div
                          className="absolute top-1 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider text-black whitespace-nowrap"
                          style={{ background: SNAP_KIND_COLOR[activeSnap.kind] }}
                        >
                          {SNAP_KIND_LABEL[activeSnap.kind]}
                        </div>
                      </div>
                    )}
                </div>
              </div>
           </div>
        </div>

        {/* Dynamic Global Meta-Panel */}
        <div className="shrink-0 h-20 px-10 border-t border-white/5 bg-black/40 backdrop-blur-3xl z-40 flex items-center justify-between">
           <div className="flex items-center gap-8">
              <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/5">
                 <button type="button" onClick={() => stepTime(-1)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Step Backward"><ChevronLeft className="w-5 h-5" /></button>
                 <button
                   type="button"
                   onClick={onPlayPause}
                   className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl hover:shadow-white/20"
                   title={isPlaying ? "Pause" : "Play"}
                 >
                   {isPlaying ? <span className="text-xl">⏸</span> : <span className="text-xl ml-1">▶</span>}
                 </button>
                 <button type="button" onClick={() => stepTime(1)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Step Forward"><ChevronRight className="w-5 h-5" /></button>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="flex items-center gap-4">
                 <button
                   type="button"
                   onClick={splitAtPlayhead}
                   disabled={!segmentAtPlayheadForSplit}
                   title="Split the selected segment at the current playhead position"
                   className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${segmentAtPlayheadForSplit ? 'bg-indigo-600/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)] border-indigo-500/30 hover:bg-indigo-600 hover:text-white' : 'bg-white/5 border-white/5 text-slate-600'}`}
                 >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Split Matrix</span>
                 </button>

                 <button
                    type="button"
                    disabled={selectedIds.length === 0}
                    className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedIds.length > 0 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5 text-slate-600'}`}
                    title="Ripple Edit Options"
                 >
                    <Link className="w-3.5 h-3.5" />
                    <span>Ripple</span>
                 </button>

                 {selectionHasGroup ? (
                   <button
                      type="button"
                      onClick={ungroupSelectedSegments}
                      disabled={selectedIds.length === 0}
                      className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedIds.length > 0 ? 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-white shadow-[0_0_15px_rgba(217,70,239,0.2)]' : 'bg-white/5 border-white/5 text-slate-600'}`}
                      title="Ungroup the selected segments"
                   >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Ungroup</span>
                   </button>
                 ) : (
                   <button
                      type="button"
                      onClick={groupSelectedSegments}
                      disabled={selectedIds.length < 2}
                      className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedIds.length >= 2 ? 'bg-fuchsia-500/20 border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-white shadow-[0_0_15px_rgba(217,70,239,0.2)]' : 'bg-white/5 border-white/5 text-slate-600'}`}
                      title="Group the selected segments so they move and delete together"
                   >
                      <Link className="w-3.5 h-3.5" />
                      <span>Group</span>
                   </button>
                 )}

                 <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.length === 0 && !selectedEffectId}
                    className={`p-2.5 rounded-xl border transition-all ${selectedIds.length > 0 || selectedEffectId ? 'bg-rose-500/20 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-white/5 border-white/5 text-slate-600'}`}
                    title="Ripple Delete Selected"
                 >
                    <Trash2 className="w-3.5 h-3.5" />
                 </button>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <div className="flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/5">
                 <div className="flex items-center gap-2">
                    <Magnet className={`w-4 h-4 ${snapEnabled ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}`} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:inline">Magnetic Edge</span>
                 </div>
                 <button
                   type="button"
                   title="Toggle Magnetic Snap"
                   onClick={() => setSnapEnabled(!snapEnabled)}
                   className={`w-12 h-6 rounded-full border transition-all relative ${snapEnabled ? 'bg-indigo-600 border-indigo-400' : 'bg-black/40 border-white/10'}`}
                 >
                    <motion.div animate={{ x: snapEnabled ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg" />
                 </button>
              </div>

              {/* Snap-to-Speech: magnet captions/clips to Whisper word boundaries. */}
              <div className={`flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/5 ${transcript?.words?.length ? '' : 'opacity-40'}`}>
                 <div className="flex items-center gap-2">
                    <MessageSquare className={`w-4 h-4 ${snapToSpeech && transcript?.words?.length ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:inline">Snap to Speech</span>
                 </div>
                 <button
                   type="button"
                   title={transcript?.words?.length ? 'Magnet clips & captions to spoken words' : 'Generate captions to enable speech snapping'}
                   disabled={!transcript?.words?.length}
                   onClick={() => setSnapToSpeech(!snapToSpeech)}
                   className={`w-12 h-6 rounded-full border transition-all relative disabled:cursor-not-allowed ${snapToSpeech ? 'bg-emerald-600 border-emerald-400' : 'bg-black/40 border-white/10'}`}
                 >
                    <motion.div animate={{ x: snapToSpeech ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg" />
                 </button>
              </div>

              {/* One-click: re-time every caption overlay to the spoken words. */}
              {!!transcript?.words?.length && textOverlays.length > 0 && onTextOverlaysChange && (
                <button
                  type="button"
                  onClick={handleRealignCaptions}
                  title="Re-align all captions to the spoken words"
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-2xl border border-emerald-400/40 transition-all"
                >
                   <Wand2 className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">
                     {captionRealignNote || 'Realign Captions'}
                   </span>
                </button>
              )}

              <div className="flex flex-col items-end">
                 <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] font-black text-white italic tracking-tighter uppercase whitespace-nowrap">Semantic Feed Active</span>
                 </div>
                 <span className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">Neural Processing Optimized</span>
              </div>
           </div>
        </div>
      </div>

      {/* Advanced Transition Animation Helper (Ghosting Effect) */}
      <AnimatePresence>
        {draggingSegmentId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[9999] bg-indigo-600/5 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* ELITE NLE CONTEXT MENU */}
      <AnimatePresence>
         {contextMenu && (
           <motion.div
             ref={contextMenuRef}
             initial={{ opacity: 0, scale: 0.95, y: -5 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.95 }}
             style={{ '--ctx-top': `${contextMenu.y}px`, '--ctx-left': `${contextMenu.x}px`, top: 'var(--ctx-top)', left: 'var(--ctx-left)' } as any}
             className="fixed z-[99999] bg-[#121214]/95 backdrop-blur-3xl border border-white/10 rounded-xl shadow-2xl py-1 w-56 font-medium text-[11px] text-slate-300"
           >
              {contextMenu.type === 'segment' && (
                <>
                   <button
                     type="button"
                     className="w-full text-left px-4 py-2 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between group"
                     onClick={() => {
                        splitAtPlayhead()
                        setContextMenu(null)
                     }}
                   >
                     <span>Split at Playhead</span>
                     <Scissors className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                   </button>
                   <button
                     type="button"
                     className="w-full text-left px-4 py-2 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between group"
                     onClick={() => {
                        duplicateSelectedSegment()
                        setContextMenu(null)
                     }}
                   >
                     <span>Duplicate Segment</span>
                     <Copy className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                   </button>
                   {selectionHasGroup ? (
                     <button
                       type="button"
                       className="w-full text-left px-4 py-2 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between group"
                       onClick={() => { ungroupSelectedSegments(); setContextMenu(null) }}
                     >
                       <span>Ungroup Segments</span>
                       <ArrowLeftRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                     </button>
                   ) : (
                     <button
                       type="button"
                       disabled={selectedIds.length < 2}
                       className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between group ${selectedIds.length >= 2 ? 'hover:bg-white/10 hover:text-white' : 'opacity-40 cursor-not-allowed'}`}
                       onClick={() => { if (selectedIds.length >= 2) { groupSelectedSegments(); setContextMenu(null) } }}
                     >
                       <span>Group Segments</span>
                       <Link className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                     </button>
                   )}
                   <div className="h-px bg-white/10 my-1 mx-2" />
                   <button
                     type="button"
                     className="w-full text-left px-4 py-2 hover:bg-rose-500/20 text-rose-400 transition-colors flex items-center justify-between group"
                     onClick={() => {
                        handleDeleteSelected()
                        setContextMenu(null)
                     }}
                   >
                     <span>Ripple Delete</span>
                     <Trash2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                   </button>
                   <div className="h-px bg-white/10 my-1 mx-2" />
                   <button
                     type="button"
                     className="w-full text-left px-4 py-2 hover:bg-indigo-500/20 text-indigo-300 transition-colors flex items-center justify-between group"
                     onClick={() => setContextMenu(null)}
                   >
                     <span className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-indigo-400" /> AI Enhance Selection</span>
                   </button>
                </>
              )}
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}

export default ResizableTimeline
