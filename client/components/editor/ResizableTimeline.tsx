'use client'

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  MessageSquare
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
import { formatTime, formatTimeDetailed, formatTimePrecise, formatTimeFrames, parseTime, snapToGrid, snapToNearestEdge, SNAP_STEPS } from '../../utils/editorUtils'
import { getSegmentColor } from '../../utils/editorUtils'

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
  imageOverlays?: ImageOverlay[]
  onDuplicateSegmentAtPlayhead?: (segmentId: string) => void
  isPlaying?: boolean
  onPlayPause?: () => void
  density?: 'compact' | 'comfortable' | 'expanded'
  trackVisibility?: Record<number, boolean>
  onTrackVisibilityChange?: (trackIndex: number, visible: boolean) => void
  markers?: TimelineMarker[]
  onMarkersChange?: (fn: (prev: TimelineMarker[]) => TimelineMarker[]) => void
  onAssetDrop?: (asset: any, trackIndex: number, time: number) => void
  transcript?: Transcript | null
  aiDirectorSuggestions?: AIDirectorSuggestion[]
  engagementScore?: EngagementScore | null
}

const STORAGE_KEY_TIME_FORMAT = 'click-timeline-time-format'
const STORAGE_KEY_FPS = 'click-timeline-fps'
const STORAGE_KEY_ZOOM = 'click-timeline-zoom'
const STORAGE_KEY_SNAP = 'click-timeline-snap'
type TimeFormatPreference = 'short' | 'tenths' | 'frames'

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

const ResizableTimeline: React.FC<ResizableTimelineProps> = ({ duration, currentTime, segments, onTimeUpdate, onSegmentsChange, selectedSegmentId: selectedSegmentIdProp, selectedSegmentIds: selectedSegmentIdsProp, onSegmentSelect, onSegmentDeleted, effects = [], onEffectsChange, selectedEffectId, onEffectSelect, onEffectDeleted, textOverlays = [], imageOverlays = [], onDuplicateSegmentAtPlayhead, isPlaying, onPlayPause, density = 'comfortable', trackVisibility = {}, onTrackVisibilityChange, markers: controlledMarkers, onMarkersChange, onAssetDrop, transcript, aiDirectorSuggestions = [], engagementScore = null }) => {
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
  const [snapStepIndex, setSnapStepIndex] = useState(2)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [zoom, setZoom] = useState(() => {
    if (typeof window === 'undefined') return 1
    const v = localStorage.getItem(STORAGE_KEY_ZOOM)
    const n = parseFloat(v || '1')
    return Number.isFinite(n) && n >= 0.5 && n <= 4 ? n : 1
  })

  // V4: Neural Waveform Generator
  const waveformPoints = useMemo(() => {
    const points = []
    const segmentsCount = 100
    // Use a deterministic wave pattern (sine/cosine mix) instead of Math.random to prevent hydration mismatch
    for (let i = 0; i < segmentsCount; i++) {
      const val = 15 + Math.abs(Math.sin(i * 0.8) * 20 + Math.cos(i * 0.3) * 10)
      points.push(val)
    }
    return points
  }, [])
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
    localStorage.setItem(STORAGE_KEY_ZOOM, String(zoom))
  }, [timeFormat, framesPerSecond, snapEnabled, zoom])

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
      const cw = contentEl.offsetWidth
      const sw = scrollEl.clientWidth
      if (cw <= 0) return
      const buffer = 0.05
      const startFrac = Math.max(0, scrollEl.scrollLeft / cw - buffer)
      const endFrac = Math.min(1, (scrollEl.scrollLeft + sw) / cw + buffer)
      setVisibleTimeRange({ start: startFrac * maxDur, end: endFrac * maxDur })
    }
    update()
    scrollEl.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(scrollEl)
    ro.observe(contentEl)
    return () => { scrollEl.removeEventListener('scroll', update); ro.disconnect() }
  }, [maxDur])

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

  const segmentAtPlayhead = useMemo(() =>
    segments.find((s) => currentTime >= s.startTime && currentTime < s.endTime),
    [segments, currentTime])

  const seekTo = useCallback((clientX: number) => {
    const contentEl = contentRef.current
    if (!contentEl) return
    const innerEl = contentEl.firstElementChild as HTMLElement
    if (!innerEl) return

    const rect = innerEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let t = x * maxDur

    if (snapEnabled) {
      const tEdge = snapToNearestEdge(t, magneticEdges, snapStep * 1.2)
      if (tEdge !== t) {
        t = tEdge
        triggerSnapPulse()
      } else {
        const tGrid = snapToGrid(t, snapStep)
        if (tGrid !== t) triggerSnapPulse()
        t = tGrid
      }
    }
    userSeekRef.current = true
    onTimeUpdate(Math.max(0, Math.min(maxDur, t)))
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onTimeUpdate, triggerSnapPulse])

  useEffect(() => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl || zoom <= 1) return
    const contentWidth = contentEl.offsetWidth
    if (contentWidth <= 0) return
    const playheadPosition = (currentTime / maxDur) * contentWidth
    const scrollWidth = scrollEl.scrollWidth
    const clientWidth = scrollEl.clientWidth
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
      const tEdge = snapToNearestEdge(t, magneticEdges, snapStep * 1.2)
      t = tEdge !== t ? tEdge : snapToGrid(t, snapStep)
    }
    userSeekRef.current = true
    onTimeUpdate(Math.max(0, Math.min(maxDur, t)))
    setTimestampInput(formatTimeDetailed(t))
  }

  useEffect(() => {
    if (!isScrubbing) return
    const onMove = (e: MouseEvent) => seekTo(e.clientX)
    const onUp = () => setIsScrubbing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
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
    onSegmentsChange((prev) => prev.filter((seg) => seg.id !== id))
    if (selectedSegmentId === id) onSegmentSelect?.(null)
    onSegmentDeleted?.()
  }, [onSegmentsChange, onSegmentSelect, onSegmentDeleted, selectedSegmentId])

  const handleDeleteSelected = useCallback(() => {
    if (selectedEffectId && onEffectsChange) {
      onEffectsChange((prev) => prev.filter((eff) => eff.id !== selectedEffectId))
      onEffectSelect?.(null)
      onEffectDeleted?.()
      return
    }
    if (selectedIds.length > 0 && onSegmentsChange) {
      const toRemove = segments.filter((s) => selectedIds.includes(s.id))
      if (toRemove.length === 0) return
      const rangeStart = Math.min(...toRemove.map((s) => s.startTime))
      const rangeEnd = Math.max(...toRemove.map((s) => s.endTime))
      const gap = rangeEnd - rangeStart
      onSegmentsChange((prev) => {
        let next = prev.filter((seg) => !selectedIds.includes(seg.id))
        if (rippleOnDelete && gap > 0) {
          next = next.map((seg) => {
            if (seg.startTime >= rangeEnd) {
              const newStart = seg.startTime - gap
              const newEnd = seg.endTime - gap
              return { ...seg, startTime: newStart, endTime: newEnd, duration: newEnd - newStart }
            }
            if (seg.endTime > rangeStart && seg.startTime < rangeEnd) {
              const newEnd = Math.max(seg.startTime, seg.endTime - gap)
              return { ...seg, endTime: newEnd, duration: newEnd - seg.startTime }
            }
            return seg
          })
        }
        return next
      })
      onSegmentSelect?.(null)
      onSegmentDeleted?.()
    }
  }, [selectedIds, selectedEffectId, segments, rippleOnDelete, onSegmentsChange, onEffectsChange, onEffectSelect, onSegmentSelect, onEffectDeleted, onSegmentDeleted])

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
    if (!onSegmentsChange) return
    let v = value
    if (snapEnabled) {
      const edgeSnap = snapToNearestEdge(v, magneticEdges, snapStep * 1.5)
      v = edgeSnap !== v ? edgeSnap : snapToGrid(v, snapStep)
    }
    v = Math.max(0, Math.min(maxDur, v))

    onSegmentsChange((prev) => {
      const segIndex = prev.findIndex(s => s.id === id)
      if (segIndex === -1) return prev
      const seg = prev[segIndex]

      let next = [...prev]
      let diff = 0

      if (edge === 'start') {
        const start = Math.min(v, seg.endTime - 0.25)
        diff = start - seg.startTime
        next[segIndex] = { ...seg, startTime: start, duration: seg.endTime - start }
      } else {
        const end = Math.max(v, seg.startTime + 0.25)
        diff = end - seg.endTime
        next[segIndex] = { ...seg, endTime: Math.min(end, maxDur), duration: Math.min(end, maxDur) - seg.startTime }
      }

      // Ripple affect later segments on the same track
      if (rippleOnDelete && diff !== 0) {
         next = next.map(s => {
           if (s.id !== id && s.track === seg.track && s.startTime >= (edge === 'start' ? seg.startTime : seg.endTime)) {
             return { ...s, startTime: Math.max(0, s.startTime + diff), endTime: Math.max(s.duration, s.endTime + diff) }
           }
           return s
         })
      }

      return next
    })
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onSegmentsChange, rippleOnDelete])

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
    if (!onSegmentsChange) return
    const segDur = originalEnd - originalStart
    let newStart = originalStart + deltaTime

    if (snapEnabled) {
      // Create a filtered list of edges that excludes the current segment's own edges to prevent snapping to itself
      const otherEdges = magneticEdges.filter(e => Math.abs(e - originalStart) > 0.01 && Math.abs(e - originalEnd) > 0.01)
      const edgeSnapStart = snapToNearestEdge(newStart, otherEdges, snapStep * 1.5)
      const edgeSnapEnd = snapToNearestEdge(newStart + segDur, otherEdges, snapStep * 1.5)

      // Determine which edge (start or end) is closer to a magnetic edge
      if (Math.abs(edgeSnapStart - newStart) <= Math.abs(edgeSnapEnd - (newStart + segDur))) {
        newStart = edgeSnapStart !== newStart ? edgeSnapStart : snapToGrid(newStart, snapStep)
      } else {
        newStart = edgeSnapEnd !== (newStart + segDur) ? (edgeSnapEnd - segDur) : snapToGrid(newStart, snapStep)
      }
    }

    newStart = Math.max(0, Math.min(maxDur - segDur, newStart))
    const newEnd = newStart + segDur

    onSegmentsChange((prev) => {
      let next = [...prev]
      const oldSeg = next.find(s => s.id === id)
      if (!oldSeg) return prev

      const diff = newStart - originalStart

      next = next.map((seg) => {
        if (seg.id !== id) return seg
        const updatedTrack = newTrack !== undefined ? newTrack : seg.track
        return { ...seg, startTime: newStart, endTime: Math.min(newEnd, maxDur), duration: Math.min(newEnd, maxDur) - newStart, track: updatedTrack }
      })

      // Ripple all subsequent clips if ripple enabled
      if (rippleOnDelete && diff !== 0) {
        next = next.map(seg => {
          if (seg.id !== id && seg.track === oldSeg.track && seg.startTime >= originalStart) {
            return { ...seg, startTime: Math.max(0, seg.startTime + diff), endTime: Math.max(seg.duration, seg.endTime + diff) }
          }
           return seg
        })
      }

      return next
    })
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onSegmentsChange, rippleOnDelete])

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
      onSegmentsChange((prev) => [...prev, copy])
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
      onSegmentsChange((prev) => [...prev, ...copies])
      onSegmentSelect?.(copies[0].id, false)
    }
  }, [selectedIds, segments, duplicateSegment, onSegmentsChange, maxDur, onSegmentSelect])

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
  }, [stepTime, selectedIds, selectedEffectId, handleDeleteSelected, onSegmentSelect, onEffectSelect, onTimeUpdate, onPlayPause, maxDur, currentTime, splitAtPlayhead, duplicateSelectedSegment, nudgeSelectedSegment, addMarkerAtPlayhead])

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
      const w = contentEl?.offsetWidth
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
      setDraggingSegmentId(null)
      dragSegmentStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingSegmentId, maxDur, moveSegmentTo])

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
    setDraggingSegmentId(seg.id)
    dragSegmentStartRef.current = { x: e.clientX, y: e.clientY, startTime: seg.startTime, endTime: seg.endTime, track: seg.track }
  }, [selectedIds, onSegmentSelect])

  const handleSegmentEdgeMouseDown = useCallback((e: React.MouseEvent, seg: TimelineSegment, edge: 'start' | 'end') => {
    e.stopPropagation()
    setDraggingEdgeId(seg.id)
    dragEdgeStartRef.current = { id: seg.id, edge, startX: e.clientX, startTime: seg.startTime, endTime: seg.endTime }
  }, [])

  useEffect(() => {
    if (!draggingEdgeId || !dragEdgeStartRef.current) return
    const { id, edge, startX, startTime, endTime } = dragEdgeStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      const w = contentEl?.offsetWidth
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

  const handleTrackDrop = useCallback((e: React.DragEvent, trackIndex: number) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'library-asset' && data.asset) {
        const contentEl = contentRef.current
        if (!contentEl) return
        const rect = contentEl.getBoundingClientRect()
        const dropX = e.clientX - rect.left
        const rawTime = (dropX / contentEl.offsetWidth) * maxDur
        // Snap drop time to grid or playhead
        let t = rawTime
        if (snapEnabled) {
          const tEdge = snapToNearestEdge(t, magneticEdges, snapStep * 1.5)
          t = tEdge !== t ? tEdge : snapToGrid(t, snapStep)
        }
        t = Math.max(0, Math.min(maxDur, t))
        onAssetDrop?.(data.asset, trackIndex, t)
      }
    } catch {
      // Ignore invalid drag data
    }
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onAssetDrop])

  const isCompact = density === 'compact'

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
                onClick={() => setTimelineMode('visual')}
                className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${timelineMode === 'visual' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
              >
                Visual
              </button>
              <button
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
                 <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-2.5 rounded-xl text-slate-500 hover:text-white transition-all" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                 <div className="w-12 text-center text-[10px] font-black text-slate-400 tabular-nums">{Math.round(zoom * 100)}%</div>
                 <button onClick={() => setZoom(Math.min(10, zoom + 0.25))} className="p-2.5 rounded-xl text-slate-500 hover:text-white transition-all" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
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
                   style={{ left: `${timeToX(currentTime)}%` }}
                 />
              </div>
           </div>

           {/* Timeline Header (High Precision Ruler) */}
           <div className="shrink-0 h-10 border-b border-white/5 relative bg-white/[0.01] z-30">
              <div
                ref={scrollRef}
                className="h-full overflow-x-auto overflow-y-hidden select-none scrollbar-hide"
                onMouseMove={handleRulerHover}
                onMouseLeave={() => setRulerHoverTime(null)}
                onClick={(e) => seekTo(e.clientX)}
              >
                <div className="h-full relative" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
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

                   {/* Markers */}
                   {markers.map(m => (
                     <div
                       key={m.id}
                       className="absolute top-0 h-full w-[2px] bg-amber-500/50 cursor-pointer group/marker z-20"
                       style={{ left: `${timeToX(m.time)}%` }}
                     >
                        <div className="absolute top-0 -left-[4px] w-2.5 h-2.5 bg-amber-500 rotate-45 border border-black/50 shadow-lg group-hover/marker:scale-150 transition-transform" />
                        <span className="absolute top-4 left-3 px-2 py-0.5 bg-amber-500 text-black text-[8px] font-black uppercase rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">{m.name || 'Marker'}</span>
                     </div>
                   ))}

                   {/* Playhead */}
                   {rulerHoverTime !== null && (
                     <div className="absolute top-0 bottom-0 w-px bg-white/20 z-10 pointer-events-none" style={{ left: `${timeToX(rulerHoverTime)}%` }}>
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-mono text-white/80 backdrop-blur-md border border-white/10 shadow-lg">{displayTime(rulerHoverTime)}</div>
                     </div>
                   )}
                   
                   {/* Stakeholder Comments Layer */}
                   {mockComments.map(c => (
                      <div
                         key={c.id}
                         className="absolute top-1/2 -translate-y-1/2 z-30 group/comment cursor-pointer"
                         style={{ left: `${timeToX(c.time)}%` }}
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
                                  <button onClick={() => setMockComments(prev => prev.filter(mc => mc.id !== c.id))} className="flex-1 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-slate-300 transition-colors">Resolve</button>
                                  <button onClick={() => setActiveCommentId(null)} className="flex-1 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase text-slate-300 transition-colors">Close</button>
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
                               <div className="flex items-center gap-1 opacity-40 group-hover/track:opacity-100 transition-opacity">
                                  <button className="p-1 hover:bg-white/10 hover:text-white rounded text-slate-400" title="Mute Track"><EyeOff className="w-3 h-3" /></button>
                                  <button className="p-1 hover:bg-white/10 hover:text-white rounded text-slate-400" title="Lock Track"><Lock className="w-3 h-3" /></button>
                               </div>
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
                               <div className="flex items-center gap-1 opacity-40 group-hover/track:opacity-100 transition-opacity bg-black/40 rounded-lg p-0.5 border border-white/5">
                                  <button className="px-1.5 py-0.5 hover:bg-white/10 hover:text-white rounded text-slate-400 text-[8px] font-black uppercase tracking-wider" title="Solo Track">Solo</button>
                                   <div className="w-px h-3 bg-white/20" />
                                  <button className="px-1.5 py-0.5 hover:bg-white/10 hover:text-white rounded text-slate-400 text-[8px] font-black uppercase tracking-wider" title="Mute Track">M</button>
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
                               <div className="flex items-center gap-1 opacity-40 group-hover/track:opacity-100 transition-opacity">
                                  <button className="px-1.5 py-0.5 hover:bg-white/10 hover:text-white rounded text-slate-400 text-[8px] font-black uppercase tracking-wider">Source</button>
                               </div>
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
                               <div className="flex items-center gap-1 opacity-40 group-hover/track:opacity-100 transition-opacity bg-black/40 rounded-lg p-0.5 border border-white/5">
                                  <button className="px-1.5 py-0.5 hover:bg-white/10 hover:text-white rounded text-slate-400 text-[8px] font-black uppercase tracking-wider" title="Solo Track">Solo</button>
                                  <div className="w-px h-3 bg-white/20" />
                                  <button className="px-1.5 py-0.5 hover:bg-white/10 hover:text-white rounded text-slate-400 text-[8px] font-black uppercase tracking-wider" title="Mute Track">M</button>
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
                  style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                  onMouseMove={handleSeekHover}
                  onClick={(e) => { if (e.target === e.currentTarget) seekTo(e.clientX) }}
                >
                   {/* Global Object Matrix Overlay */}
                   <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

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
                          <span className="text-[8px] font-black text-fuchsia-400 uppercase tracking-[0.4em] italic opacity-60">Neural Audio Analysis // Quantum Waveform</span>
                       </div>

                       {/* Playhead Reflection on Waveform */}
                       <div className="absolute top-0 bottom-0 w-[2px] bg-white/10 z-[5] pointer-events-none backdrop-blur-sm" style={{ left: `${timeToX(currentTime)}%` }} />

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
                            d={`M 0 24 ${waveformPoints.map((p, i) => `L ${i * (100 / (waveformPoints.length - 1))} ${24 - p/1.8} L ${i * (100 / (waveformPoints.length - 1))} ${24 + p/1.8}`).join(' ')} L 100 24`}
                            fill="url(#waveform-grad)"
                            filter="url(#wave-glow)"
                            className="transition-all duration-1000"
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
                           {textOverlays.map(o => (
                             <motion.div
                               key={o.id}
                               layoutId={o.id}
                               style={{ left: `${timeToX(o.startTime)}%`, width: `${timeToX(o.endTime) - timeToX(o.startTime)}%` }}
                               whileHover={{ scaleY: 1.05 }}
                               whileTap={{ scale: 0.98 }}
                               className={`absolute top-4 bottom-4 rounded-xl border-2 flex flex-col justify-center px-4 cursor-pointer group/node transition-all duration-300 ${selectedIds.includes(o.id) ? 'bg-emerald-500/40 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] z-30 ring-2 ring-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 z-20 hover:border-emerald-500/50'}`}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(o.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, o as any)}
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

                                {/* Precision Resize Handles */}
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, o as any, 'start')} className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 transition-opacity" />
                                <div onMouseDown={(e) => handleSegmentEdgeMouseDown(e, o as any, 'end')} className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize opacity-0 group-hover/node:opacity-100 transition-opacity" />
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
                           {segments.filter(s => s.track < 2).map(s => (
                             <motion.div
                               key={s.id}
                               layoutId={s.id}
                               style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                               className={`absolute top-2 bottom-2 rounded-xl flex flex-col justify-center px-4 cursor-pointer group/node transition-shadow overflow-hidden
                                 ${selectedIds.includes(s.id) ? 'shadow-[0_0_40px_rgba(59,130,246,0.3)] z-30 scale-[1.02] ring-2 ring-blue-500 ring-offset-2 ring-offset-black' : 'hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] z-20'}
                                 bg-gradient-to-b from-blue-600/30 to-blue-900/40 border border-blue-400/30 hover:border-blue-400/60
                               `}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(s.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, s)}
                             >
                                {/* Simulated Filmstrip BG */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none flex" style={{ backgroundSize: '24px 100%', backgroundImage: 'linear-gradient(90deg, transparent 22px, rgba(255,255,255,0.2) 22px, rgba(255,255,255,0.2) 24px)' }} />

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
                                      style={{ left: `calc(${percentX}% - 5px)` }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        // Simple dragging logic
                                        const startX = e.clientX;
                                        const startKfTime = kf.time;
                                        const onMove = (moveEvt: MouseEvent) => {
                                          const contentEl = contentRef.current;
                                          if (!contentEl) return;
                                          const deltaX = moveEvt.clientX - startX;
                                          const deltaTime = (deltaX / contentEl.offsetWidth) * maxDur;
                                          let newTime = Math.max(s.startTime, Math.min(s.endTime, startKfTime + deltaTime));

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

                      {/* LANE: VISUAL ASSETS NODES (B-ROLL) */}
                      {(!focusLane || focusLane === 'b-roll') && (
                        <div
                          data-track-drop={2}
                          className={`h-28 relative rounded-2xl border border-white/[0.03] transition-all duration-500 overflow-hidden ${focusLane === 'b-roll' ? 'bg-amber-500/[0.05] border-amber-500/20' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => handleTrackDrop(e, 2)}
                        >
                           {segments.filter(s => s.track >= 2 && s.track < 5).map(s => (
                             <motion.div
                               key={s.id}
                               layoutId={s.id}
                               style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                               className={`absolute top-2 bottom-2 rounded-xl flex items-center px-4 gap-3 cursor-pointer group/node transition-shadow overflow-hidden
                                 ${selectedIds.includes(s.id) ? 'shadow-[0_0_40px_rgba(245,158,11,0.3)] z-30 scale-[1.02] ring-2 ring-amber-500 ring-offset-2 ring-offset-black' : 'hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] z-20'}
                                 bg-gradient-to-b from-amber-600/30 to-amber-900/40 border border-amber-400/30 hover:border-amber-400/60
                               `}
                               onClick={(e) => { e.stopPropagation(); onSegmentSelect?.(s.id, e.shiftKey || e.metaKey) }}
                               onMouseDown={(e) => handleSegmentBodyMouseDown(e, s)}
                             >
                                {/* Simulated BG */}
                                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.2) 25%, rgba(255,255,255,0.2) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.2) 75%, rgba(255,255,255,0.2) 100%)', backgroundSize: '20px 20px' }} />

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
                                      style={{ left: `calc(${percentX}% - 4px)`, height: '8px' }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        const startX = e.clientX;
                                        const startKfTime = kf.time;
                                        const onMove = (moveEvt: MouseEvent) => {
                                          const contentEl = contentRef.current;
                                          if (!contentEl) return;
                                          const deltaX = moveEvt.clientX - startX;
                                          const deltaTime = (deltaX / contentEl.offsetWidth) * maxDur;
                                          let newTime = Math.max(s.startTime, Math.min(s.endTime, startKfTime + deltaTime));

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
                           {segments.filter(s => s.track >= 6).map(s => (
                             <motion.div
                               key={s.id}
                               layoutId={s.id}
                               style={{ left: `${timeToX(s.startTime)}%`, width: `${timeToX(s.endTime) - timeToX(s.startTime)}%` }}
                               className={`absolute top-2 bottom-2 rounded-xl flex items-center px-4 gap-3 cursor-pointer group/node transition-shadow overflow-hidden
                                 ${selectedIds.includes(s.id) ? 'shadow-[0_0_40px_rgba(249,115,22,0.3)] z-30 scale-[1.02] ring-2 ring-orange-500 ring-offset-2 ring-offset-black' : 'hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] z-20'}
                                 bg-gradient-to-b from-orange-600/30 to-orange-900/40 border border-orange-400/30 hover:border-orange-400/60
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
                                            style={{ height: `${h}%`, minWidth: '2px', maxWidth: '4px' }}
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
                   </div>

                   {/* Master Playhead (Neural Thread) */}
                   <motion.div
                     className="absolute top-0 bottom-0 w-[1px] bg-fuchsia-500 z-50 pointer-events-none"
                     style={{ left: `${progress}%`, boxShadow: '0 0 15px rgba(217,70,239,0.8)' }}
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
                           <div key={`breadcrumb-${seg.id}`} className="absolute top-0 bottom-0 overflow-hidden" style={{ left: `${timeToX(seg.startTime)}%`, width: `${timeToX(seg.endTime) - timeToX(seg.startTime)}%` }}>
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
                </div>
              </div>
           </div>
        </div>

        {/* Dynamic Global Meta-Panel */}
        <div className="shrink-0 h-20 px-10 border-t border-white/5 bg-black/40 backdrop-blur-3xl z-40 flex items-center justify-between">
           <div className="flex items-center gap-8">
              <div className="flex items-center bg-white/5 p-1 rounded-2xl border border-white/5">
                 <button onClick={() => stepTime(-1)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Step Backward"><ChevronLeft className="w-5 h-5" /></button>
                 <button
                   onClick={onPlayPause}
                   className="w-14 h-14 bg-white text-black rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl hover:shadow-white/20"
                   title={isPlaying ? "Pause" : "Play"}
                 >
                   {isPlaying ? <span className="text-xl">⏸</span> : <span className="text-xl ml-1">▶</span>}
                 </button>
                 <button onClick={() => stepTime(1)} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Step Forward"><ChevronRight className="w-5 h-5" /></button>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div className="flex items-center gap-4">
                 <button
                   onClick={splitAtPlayhead}
                   disabled={!segmentAtPlayheadForSplit}
                   title="Split the selected segment at the current playhead position"
                   className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${segmentAtPlayheadForSplit ? 'bg-indigo-600/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)] border-indigo-500/30 hover:bg-indigo-600 hover:text-white' : 'bg-white/5 border-white/5 text-slate-600'}`}
                 >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Split Matrix</span>
                 </button>

                 <button
                    disabled={selectedIds.length === 0}
                    className={`px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${selectedIds.length > 0 ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5 text-slate-600'}`}
                    title="Ripple Edit Options"
                 >
                    <Link className="w-3.5 h-3.5" />
                    <span>Ripple</span>
                 </button>

                 <button
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
                   title="Toggle Magnetic Snap"
                   onClick={() => setSnapEnabled(!snapEnabled)}
                   className={`w-12 h-6 rounded-full border transition-all relative ${snapEnabled ? 'bg-indigo-600 border-indigo-400' : 'bg-black/40 border-white/10'}`}
                 >
                    <motion.div animate={{ x: snapEnabled ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg" />
                 </button>
              </div>

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
             style={{ top: contextMenu.y, left: contextMenu.x }}
             className="fixed z-[99999] bg-[#121214]/95 backdrop-blur-3xl border border-white/10 rounded-xl shadow-2xl py-1 w-56 font-medium text-[11px] text-slate-300"
           >
              {contextMenu.type === 'segment' && (
                <>
                   <button
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
                     className="w-full text-left px-4 py-2 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-between group"
                     onClick={() => {
                        duplicateSelectedSegment()
                        setContextMenu(null)
                     }}
                   >
                     <span>Duplicate Segment</span>
                     <Copy className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                   </button>
                   <div className="h-px bg-white/10 my-1 mx-2" />
                   <button
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
