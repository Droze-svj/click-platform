
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Layers, Clock, ZoomIn, ZoomOut, Maximize2, Focus, ChevronLeft, ChevronRight, Sparkles, Trash2, Copy, Lock, Eye, EyeOff, Type, Image as ImageIcon } from 'lucide-react'
import { TimelineSegment, TimelineEffect, EFFECT_TYPE_COLORS, SegmentTransitionType, TextOverlay, ImageOverlay, ALL_TIMELINE_TRACKS } from '../../types/editor'
import { formatTime, formatTimeDetailed, formatTimePrecise, formatTimeFrames, parseTime, snapToGrid, snapToNearestEdge, SNAP_STEPS } from '../../utils/editorUtils'
import { getSegmentColor } from '../../utils/editorUtils'

interface ResizableTimelineProps {
  duration: number
  currentTime: number
  segments: TimelineSegment[]
  onTimeUpdate: (time: number) => void
  onSegmentsChange?: (fn: (prev: TimelineSegment[]) => TimelineSegment[]) => void
  selectedSegmentId?: string | null
  onSegmentSelect?: (id: string | null) => void
  onSegmentDeleted?: () => void
  effects?: TimelineEffect[]
  onEffectsChange?: (fn: (prev: TimelineEffect[]) => TimelineEffect[]) => void
  selectedEffectId?: string | null
  onEffectSelect?: (id: string | null) => void
  onEffectDeleted?: () => void
  /** Optional: show text overlays as blocks on an Overlays track */
  textOverlays?: TextOverlay[]
  /** Optional: show image overlays as blocks */
  imageOverlays?: ImageOverlay[]
  /** Optional: duplicate the segment containing the playhead (called with segment id) */
  onDuplicateSegmentAtPlayhead?: (segmentId: string) => void
  /** Optional: when timeline is focused, Space toggles play/pause */
  isPlaying?: boolean
  onPlayPause?: () => void
  /** Optional: compact = tighter toolbar; expanded = more padding */
  density?: 'compact' | 'comfortable' | 'expanded'
  /** Track visibility (eye on/off). Key = track index, value = visible. Missing = visible. */
  trackVisibility?: Record<number, boolean>
  onTrackVisibilityChange?: (trackIndex: number, visible: boolean) => void
}

const STORAGE_KEY_TIME_FORMAT = 'click-timeline-time-format'
const STORAGE_KEY_FPS = 'click-timeline-fps'
type TimeFormatPreference = 'short' | 'tenths' | 'frames'

const ResizableTimeline: React.FC<ResizableTimelineProps> = ({ duration, currentTime, segments, onTimeUpdate, onSegmentsChange, selectedSegmentId, onSegmentSelect, onSegmentDeleted, effects = [], onEffectsChange, selectedEffectId, onEffectSelect, onEffectDeleted, textOverlays = [], imageOverlays = [], onDuplicateSegmentAtPlayhead, isPlaying, onPlayPause, density = 'comfortable', trackVisibility = {}, onTrackVisibilityChange }) => {
  const [timestampInput, setTimestampInput] = useState('')
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
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapStepIndex, setSnapStepIndex] = useState(2)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [rulerHoverTime, setRulerHoverTime] = useState<number | null>(null)
  const [draggingSegmentId, setDraggingSegmentId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY_TIME_FORMAT, timeFormat)
    localStorage.setItem(STORAGE_KEY_FPS, String(framesPerSecond))
  }, [timeFormat, framesPerSecond])

  const displayTime = useCallback((time: number) => {
    if (timeFormat === 'short') return formatTime(time)
    if (timeFormat === 'tenths') return formatTimePrecise(time, 1)
    return formatTimeFrames(time, framesPerSecond)
  }, [timeFormat, framesPerSecond])
  const dragSegmentStartRef = useRef<{ x: number; startTime: number; endTime: number } | null>(null)
  const seekRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const userSeekRef = useRef(false)
  const maxDur = Math.max(duration || 1, 0.1)
  const progress = (currentTime / maxDur) * 100
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
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    let x: number
    if (scrollEl && contentEl && contentEl.offsetWidth > 0) {
      const scrollRect = scrollEl.getBoundingClientRect()
      const positionInContent = scrollEl.scrollLeft + (clientX - scrollRect.left)
      x = Math.max(0, Math.min(1, positionInContent / contentEl.offsetWidth))
    } else {
      const el = seekRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }
    let t = x * maxDur
    if (snapEnabled) {
      const tEdge = snapToNearestEdge(t, magneticEdges, snapStep * 1.2)
      t = tEdge !== t ? tEdge : snapToGrid(t, snapStep)
    }
    userSeekRef.current = true
    onTimeUpdate(Math.max(0, Math.min(maxDur, t)))
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onTimeUpdate])

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

  const stepTime = useCallback((dir: -1 | 1) => {
    const next = Math.max(0, Math.min(maxDur, currentTime + dir * stepAmount))
    userSeekRef.current = true
    onTimeUpdate(snapEnabled ? snapToGrid(next, snapStep) : next)
  }, [currentTime, maxDur, stepAmount, snapStep, snapEnabled, onTimeUpdate])

  const handleDeleteSelected = useCallback(() => {
    // Delete selected effect first if any
    if (selectedEffectId && onEffectsChange) {
      onEffectsChange((prev) => prev.filter((eff) => eff.id !== selectedEffectId))
      onEffectSelect?.(null)
      onEffectDeleted?.()
      return
    }
    // Then delete selected segment
    if (!selectedSegmentId || !onSegmentsChange) return
    onSegmentsChange((prev) => prev.filter((seg) => seg.id !== selectedSegmentId))
    onSegmentSelect?.(null)
    onSegmentDeleted?.()
  }, [selectedSegmentId, selectedEffectId, onSegmentsChange, onEffectsChange, onSegmentSelect, onEffectSelect, onSegmentDeleted, onEffectDeleted])

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

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ') { e.preventDefault(); onPlayPause?.(); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepTime(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepTime(1) }
      else if (e.key === 'Home') { e.preventDefault(); userSeekRef.current = true; onTimeUpdate(0) }
      else if (e.key === 'End') { e.preventDefault(); userSeekRef.current = true; onTimeUpdate(maxDur) }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedSegmentId || selectedEffectId)) { e.preventDefault(); handleDeleteSelected() }
      else if (e.key === 'Escape') { onSegmentSelect?.(null); onEffectSelect?.(null); setDraggingSegmentId(null) }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [stepTime, selectedSegmentId, selectedEffectId, handleDeleteSelected, onSegmentSelect, onEffectSelect, onTimeUpdate, onPlayPause, maxDur])

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (scrollEl && contentEl && contentEl.offsetWidth > 0) {
      const scrollRect = scrollEl.getBoundingClientRect()
      const positionInContent = scrollEl.scrollLeft + (e.clientX - scrollRect.left)
      const x = Math.max(0, Math.min(1, positionInContent / contentEl.offsetWidth))
      setHoverTime(x * maxDur)
    } else {
      const el = seekRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverTime(x * maxDur)
    }
  }

  const handleRulerHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const contentEl = contentRef.current
    const scrollEl = scrollRef.current
    if (contentEl && scrollEl && contentEl.offsetWidth > 0) {
      const scrollRect = scrollEl.getBoundingClientRect()
      const positionInContent = scrollEl.scrollLeft + (e.clientX - scrollRect.left)
      const x = Math.max(0, Math.min(1, positionInContent / contentEl.offsetWidth))
      setRulerHoverTime(x * maxDur)
    }
  }

  const zoomToSelection = useCallback(() => {
    if (selectedSegmentId) {
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
  }, [selectedSegmentId, selectedEffectId, segments, effects, maxDur, onTimeUpdate])

  const snapStepLabel = snapStep < 1 ? (snapStep === 1 / 30 ? '1/30' : snapStep === 1 / 24 ? '1/24' : `${snapStep}s`) : `${snapStep}s`

  const updateSegmentEdge = useCallback((id: string, edge: 'start' | 'end', value: number) => {
    if (!onSegmentsChange) return
    const v = Math.max(0, Math.min(maxDur, snapEnabled ? snapToGrid(value, snapStep) : value))
    onSegmentsChange((prev) => prev.map((seg) => {
      if (seg.id !== id) return seg
      if (edge === 'start') {
        const start = Math.min(v, seg.endTime - 0.5)
        return { ...seg, startTime: start, duration: seg.endTime - start }
      }
      const end = Math.max(v, seg.startTime + 0.5)
      return { ...seg, endTime: Math.min(end, maxDur), duration: Math.min(end, maxDur) - seg.startTime }
    }))
  }, [maxDur, snapEnabled, snapStep, onSegmentsChange])

  const moveSegmentTo = useCallback((id: string, originalStart: number, originalEnd: number, deltaTime: number) => {
    if (!onSegmentsChange) return
    const segDur = originalEnd - originalStart
    let newStart = originalStart + deltaTime
    if (snapEnabled) newStart = snapToNearestEdge(newStart, magneticEdges, snapStep * 1.2) !== newStart ? snapToNearestEdge(newStart, magneticEdges, snapStep * 1.2) : snapToGrid(newStart, snapStep)
    newStart = Math.max(0, Math.min(maxDur - segDur, newStart))
    const newEnd = newStart + segDur
    onSegmentsChange((prev) => prev.map((seg) => {
      if (seg.id !== id) return seg
      return { ...seg, startTime: newStart, endTime: Math.min(newEnd, maxDur), duration: Math.min(newEnd, maxDur) - newStart }
    }))
  }, [maxDur, snapEnabled, snapStep, magneticEdges, onSegmentsChange])

  useEffect(() => {
    if (!draggingSegmentId || !dragSegmentStartRef.current) return
    const { x: startX, startTime: origStart, endTime: origEnd } = dragSegmentStartRef.current
    const onMove = (e: MouseEvent) => {
      const contentEl = contentRef.current
      const w = contentEl?.offsetWidth
      if (!w) return
      const deltaTime = ((e.clientX - startX) / w) * maxDur
      moveSegmentTo(draggingSegmentId, origStart, origEnd, deltaTime)
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
    setDraggingSegmentId(seg.id)
    dragSegmentStartRef.current = { x: e.clientX, startTime: seg.startTime, endTime: seg.endTime }
  }, [])

  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.25 : 0.25
    setZoom((z) => Math.max(0.5, Math.min(4, z + delta)))
  }, [])

  const isCompact = density === 'compact'
  return (
    <div ref={containerRef} tabIndex={0} className={`h-full bg-[#1a1d24] dark:bg-[#12151a] rounded-2xl border border-slate-700/60 flex flex-col overflow-hidden outline-none focus:ring-2 focus:ring-amber-500/40 shadow-xl shadow-black/20 ${isCompact ? 'rounded-xl' : ''}`} role="region" aria-label="Video timeline">
      {/* Toolbar — density-aware */}
      <div className={`border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 ${isCompact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className={`text-amber-400 shrink-0 ${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} aria-hidden />
            <span className={`font-bold text-slate-200 tracking-wide ${isCompact ? 'text-[10px]' : 'text-xs'}`}>Timeline</span>
          </div>
          {!isCompact && <span className="text-[10px] text-slate-500 hidden sm:inline">← → step · Space play · Ctrl+wheel zoom · Drag to move</span>}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
            <input
              type="text"
              value={timestampInput}
              onChange={(e) => setTimestampInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGoToTimestamp())}
              placeholder="0:00 or 1:30.5"
              className="w-24 px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              title="Jump to time (e.g. 1:30, 1:30.5, 90)"
              aria-label="Go to timestamp"
            />
            <button type="button" onClick={handleGoToTimestamp} className="px-2.5 py-1.5 text-xs font-semibold bg-amber-500 text-slate-900 rounded-md hover:bg-amber-400 transition-colors" aria-label="Go to time">Go</button>
            <button type="button" onClick={() => setTimestampInput(formatTimeDetailed(currentTime))} className="px-2 py-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors" title="Use current position">Now</button>
          </div>
          <div className="flex items-center gap-1.5 border-l border-slate-700 pl-2">
            <span className="text-[10px] font-medium text-slate-500">Snap</span>
            <button type="button" onClick={() => setSnapEnabled((v) => !v)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${snapEnabled ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`} title={snapEnabled ? `Snap to grid & edges (${snapStepLabel})` : 'Snap off'}>
              {snapStepLabel}
            </button>
            <select value={snapStepIndex} onChange={(e) => setSnapStepIndex(Number(e.target.value))} className="px-1.5 py-1 rounded-md border border-slate-600 bg-slate-800 text-[10px] font-mono text-slate-200" title="Snap grid" aria-label="Snap step">
              {SNAP_STEPS.map((s, i) => (
                <option key={i} value={i}>{s < 1 ? (s === 1 / 30 ? '1/30 s' : s === 1 / 24 ? '1/24 s' : `${s}s`) : `${s}s`}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-0.5 border-l border-slate-700 pl-2">
            <button type="button" onClick={() => stepTime(-1)} className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200" title={`Step back ${stepAmount}s (←)`} aria-label="Step back">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => stepTime(1)} className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200" title={`Step forward ${stepAmount}s (→)`} aria-label="Step forward">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {(segmentAtPlayhead && onDuplicateSegmentAtPlayhead) && (
            <button
              type="button"
              onClick={() => onDuplicateSegmentAtPlayhead(segmentAtPlayhead.id)}
              className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Duplicate segment at playhead"
              aria-label="Duplicate segment at playhead"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            <button type="button" onClick={() => setZoom(1)} className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200" title="Fit to view (100%)" aria-label="Fit">
              <Maximize2 className="w-4 h-4" />
            </button>
            {(selectedSegmentId || selectedEffectId) && (
              <button type="button" onClick={zoomToSelection} className="p-1.5 rounded-md hover:bg-amber-500/20 text-amber-400 transition-colors" title="Zoom to selection" aria-label="Zoom to selection">
                <Focus className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))} className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200" title="Zoom out" aria-label="Zoom out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-400 min-w-[2.5rem] text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} className="p-1.5 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200" title="Zoom in" aria-label="Zoom in">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-2">
            <span className="text-[10px] font-medium text-slate-500">Time</span>
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as TimeFormatPreference)}
              className="px-2 py-1 rounded-md border border-slate-600 bg-slate-800 text-[10px] font-medium text-slate-200 focus:ring-2 focus:ring-amber-500/50"
              title="Timestamp display format"
              aria-label="Timestamp format"
            >
              <option value="short">Short (0:00)</option>
              <option value="tenths">Tenths (0:00.0)</option>
              <option value="frames">Frames</option>
            </select>
            {timeFormat === 'frames' && (
              <select
                value={framesPerSecond}
                onChange={(e) => setFramesPerSecond(e.target.value === '24' ? 24 : 30)}
                className="px-1.5 py-1 rounded-md border border-slate-600 bg-slate-800 text-[10px] font-mono text-slate-200"
                title="Frames per second"
                aria-label="FPS"
              >
                <option value={24}>24fps</option>
                <option value={30}>30fps</option>
              </select>
            )}
          </div>
          <div className="text-xs font-mono font-bold text-amber-400 tabular-nums" aria-live="polite">
            {displayTime(currentTime)} <span className="text-slate-500 font-normal">/</span> {displayTime(duration)}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0 custom-scrollbar bg-[#15181f]" onWheel={handleWheelZoom} style={{ touchAction: 'pan-y' }}>
        <div ref={contentRef} className="relative min-w-full p-4 pb-4 space-y-3" style={{ width: zoom > 1 ? `${zoom * 100}%` : '100%' }}>
          {/* Playhead — film-style thin line + triangular head */}
          <div
            className={`absolute top-4 bottom-4 w-px z-30 pointer-events-none transition-transform duration-150 ${isScrubbing ? 'scale-x-150 opacity-100' : ''}`}
            style={{ left: `${progress}%`, background: 'linear-gradient(to bottom, transparent 0%, #f59e0b 8%, #f59e0b 92%, transparent 100%)', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
            aria-hidden
          />
          <div
            className={`absolute top-0 left-0 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-amber-500 text-slate-900 text-[9px] font-mono font-bold shadow-lg pointer-events-none z-30 whitespace-nowrap transition-all duration-150 ${isScrubbing ? 'scale-110 ring-2 ring-amber-400' : ''}`}
            style={{ left: `${progress}%` }}
            aria-hidden
          >
            {formatTimePrecise(currentTime, 1)}
          </div>

          {/* Time ruler — film-style ticks */}
          {maxDur > 0 && (
            <div
              className="relative h-9 cursor-pointer select-none border-b border-slate-700/50"
              onClick={(e) => { seekTo(e.clientX) }}
              onMouseMove={handleRulerHover}
              onMouseLeave={() => setRulerHoverTime(null)}
              role="slider"
              aria-label="Timeline position"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={maxDur}
            >
              {(() => {
                const majorStep = maxDur > 120 ? 30 : maxDur > 60 ? 15 : 10
                const minorStep = Math.max(1, Math.min(majorStep / 2, maxDur / 80))
                const steps: { t: number; major: boolean }[] = []
                for (let t = 0; t <= maxDur + 0.01; t += minorStep) steps.push({ t, major: Math.abs((t % majorStep)) < 0.01 })
                return (
                  <>
                    {steps.map(({ t, major }, i) => {
                      const left = (t / maxDur) * 100
                      return (
                        <div key={`tick-${i}`} className="absolute bottom-0 -translate-x-1/2" style={{ left: `${left}%` }}>
                          <div className={`${major ? 'h-3 w-px bg-amber-500/60' : 'h-1.5 w-px bg-slate-600'}`} />
                          {major && (
                            <span className="absolute left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-500 whitespace-nowrap mt-0.5">
                              {displayTime(t)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {rulerHoverTime != null && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 border border-slate-600 text-amber-100 text-[10px] font-mono rounded shadow-xl pointer-events-none z-40 whitespace-nowrap">
                        {formatTimePrecise(rulerHoverTime, 1)}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* Seek track — pill with gradient fill */}
          <div
            ref={seekRef}
            className={`h-6 w-full bg-slate-800 rounded-full relative cursor-pointer group select-none transition-shadow border border-slate-600/50 ${isScrubbing ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-[#15181f]' : ''}`}
            onClick={(e) => seekTo(e.clientX)}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsScrubbing(true)
              seekTo(e.clientX)
            }}
            onMouseMove={handleSeekHover}
            onMouseLeave={() => setHoverTime(null)}
          >
            <div className="absolute h-full bg-gradient-to-r from-amber-500/30 to-amber-400/40 group-hover:from-amber-500/40 group-hover:to-amber-400/50 transition-colors rounded-full" style={{ width: `${progress}%` }} />
            <div className="absolute inset-0 rounded-full" style={{ cursor: isScrubbing ? 'grabbing' : undefined }} />
            <div
              role="slider"
              aria-label="Playhead position"
              aria-valuenow={currentTime}
              aria-valuemin={0}
              aria-valuemax={maxDur}
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-amber-500 border-2 border-slate-900 shadow-lg cursor-grab active:cursor-grabbing z-10 hover:scale-110 transition-transform"
              style={{ left: `${progress}%` }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setIsScrubbing(true)
                seekTo(e.clientX)
              }}
            />
            {hoverTime != null && (
              <div
                className="absolute -top-6 px-2 py-1 bg-slate-800 border border-slate-600 text-amber-100 text-[10px] font-mono rounded shadow-xl pointer-events-none z-30 whitespace-nowrap -translate-x-1/2"
                style={{ left: `${Math.min(95, Math.max(5, (hoverTime / maxDur) * 100))}%` }}
              >
                {displayTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Multi-track segments — Video V1–V6 (A-Roll, B-Roll, Graphics) then Audio A1–A4 (Music, Dialogue, SFX) */}
          {ALL_TIMELINE_TRACKS.map((track) => {
            const trackSegments = segments.filter((s) => {
              const t = Math.max(0, Math.min(9, s.track ?? 0))
              return t === track.index
            })
            const trackLabel = `${track.id} ${track.name}`
            const isAudio = track.kind === 'audio'
            const isVisible = trackVisibility[track.index] !== false
            return (
              <div
                key={track.id + track.index}
                className={`h-14 rounded-xl flex items-center px-2 overflow-x-auto border ${isAudio ? 'bg-slate-800/40 border-slate-600/50' : 'bg-slate-800/50 border-slate-700/60'} ${!isVisible ? 'opacity-60' : ''}`}
              >
                {onTrackVisibilityChange && (
                  <button
                    type="button"
                    onClick={() => onTrackVisibilityChange(track.index, !isVisible)}
                    className="shrink-0 p-1 rounded hover:bg-slate-600/50 transition-colors mr-1"
                    title={isVisible ? 'Hide track (clips not shown in preview)' : 'Show track'}
                    aria-label={isVisible ? 'Hide track' : 'Show track'}
                  >
                    {isVisible ? <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500 hover:text-amber-400" />}
                  </button>
                )}
                <span className="text-[8px] font-bold uppercase tracking-wider w-14 shrink-0 text-left" title={trackLabel}>
                  <span className={isAudio ? 'text-sky-400/90' : 'text-amber-500/80'}>{track.id}</span>
                  <span className="text-slate-400 ml-0.5">{track.name}</span>
                </span>
                <div className="flex-1 min-w-0 h-10 relative" style={{ minWidth: 200 }}>
                  {trackSegments.map((s) => {
                    const left = (s.startTime / maxDur) * 100
                    const width = ((s.endTime - s.startTime) / maxDur) * 100
                    const canResize = !!onSegmentsChange
                    const isDragging = draggingSegmentId === s.id
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
                          e.stopPropagation()
                          userSeekRef.current = true
                          onTimeUpdate(s.startTime)
                          onSegmentSelect?.(s.id)
                        }}
                        onDoubleClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
                          e.stopPropagation()
                          onSegmentSelect?.(s.id)
                          zoomToSelection()
                        }}
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
                          handleSegmentBodyMouseDown(e, s)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { userSeekRef.current = true; onTimeUpdate(s.startTime); onSegmentSelect?.(s.id) }
                          if (e.key === 'Escape') onSegmentSelect?.(null)
                        }}
                        className={`absolute h-8 rounded-lg border border-white/20 shadow-md flex items-center justify-center overflow-hidden transition-all group/seg ${isDragging ? 'cursor-grabbing ring-2 ring-amber-400 scale-[1.02] z-20' : 'cursor-grab'} ${selectedSegmentId === s.id && !isDragging ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#15181f] scale-[1.02] hover:ring-amber-400/80' : 'hover:ring-2 hover:ring-amber-500/50 hover:scale-[1.02]'}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 4)}%`,
                          minWidth: 24,
                          backgroundColor: getSegmentColor(s.type),
                          color: 'white'
                        }}
                        title={`${s.name} · ${trackLabel} · ${formatTime(s.startTime)}–${formatTime(s.endTime)} — click jump · double-click zoom · drag to move${canResize ? ' · drag edges to resize' : ''}`}
                      >
                        {canResize && (
                          <div
                            data-resize-handle
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/seg:opacity-100 hover:bg-white/30 rounded-l transition-opacity z-10"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              const startX = e.clientX
                              const startT = s.startTime
                              const onMove = (ev: MouseEvent) => {
                                const w = contentRef.current?.offsetWidth || seekRef.current?.getBoundingClientRect()?.width
                                if (!w) return
                                const dx = (ev.clientX - startX) / w * maxDur
                                updateSegmentEdge(s.id, 'start', startT + dx)
                              }
                              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                              window.addEventListener('mousemove', onMove)
                              window.addEventListener('mouseup', onUp)
                            }}
                          />
                        )}
                        <span className="text-[9px] font-bold truncate px-1">{s.name}</span>
                        <span className="absolute top-0.5 right-1 text-[7px] font-mono opacity-90 drop-shadow" title={`Duration ${displayTime(s.endTime - s.startTime)}`}>
                          {displayTime(s.endTime - s.startTime)}
                        </span>
                        {selectedSegmentId === s.id && (s.transitionOut && s.transitionOut !== 'none') && (
                          <span className="absolute bottom-0 left-0 right-0 text-[7px] opacity-90 bg-black/30 truncate px-1" title={`Transition: ${s.transitionOut} ${s.transitionDuration ?? 0.5}s`}>
                            →{s.transitionOut}
                          </span>
                        )}
                        {canResize && (
                          <div
                            data-resize-handle
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/seg:opacity-100 hover:bg-white/30 rounded-r transition-opacity z-10"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              const startX = e.clientX
                              const startT = s.endTime
                              const onMove = (ev: MouseEvent) => {
                                const w = contentRef.current?.offsetWidth || seekRef.current?.getBoundingClientRect()?.width
                                if (!w) return
                                const dx = (ev.clientX - startX) / w * maxDur
                                updateSegmentEdge(s.id, 'end', startT + dx)
                              }
                              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                              window.addEventListener('mousemove', onMove)
                              window.addEventListener('mouseup', onUp)
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Segment track, transition & speed (when a segment is selected) */}
          {selectedSegmentId && onSegmentsChange && segments.some((s) => s.id === selectedSegmentId) && (
            <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400">Track:</span>
              <select
                value={segments.find((s) => s.id === selectedSegmentId)?.track ?? 0}
                onChange={(e) => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, track: Number(e.target.value) } : s))}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px] font-medium min-w-[7rem]"
                title="Move segment to another track"
              >
                {ALL_TIMELINE_TRACKS.map((t) => (
                  <option key={t.index} value={t.index}>{t.id} {t.name}</option>
                ))}
              </select>
              <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 ml-1">Transition out:</span>
              <select
                value={segments.find((s) => s.id === selectedSegmentId)?.transitionOut ?? 'none'}
                onChange={(e) => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, transitionOut: e.target.value as SegmentTransitionType } : s))}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px] font-medium"
              >
                {(['none', 'crossfade', 'dip', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'zoom'] as SegmentTransitionType[]).map((t) => (
                  <option key={t} value={t}>{t === 'none' ? 'None' : t.replace(/-/g, ' ')}</option>
                ))}
              </select>
              <span className="text-[9px] font-bold text-slate-400">Duration (s):</span>
              {[0.25, 0.5, 1].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, transitionDuration: d } : s))}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${segments.find((s) => s.id === selectedSegmentId)?.transitionDuration === d ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  {d}
                </button>
              ))}
              <span className="text-[9px] font-bold text-slate-400 ml-1">Speed:</span>
              {[0.5, 1, 1.5, 2].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, playbackSpeed: sp, playbackSpeedStart: undefined, playbackSpeedEnd: undefined } : s))}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${(segments.find((s) => s.id === selectedSegmentId)?.playbackSpeed ?? 1) === sp ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  {sp}x
                </button>
              ))}
              <span className="text-[9px] font-bold text-slate-400 ml-1">Speed ramp:</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-slate-500">Start</span>
                {[0.5, 1, 1.5, 2].map((sp) => (
                  <button
                    key={`start-${sp}`}
                    type="button"
                    onClick={() => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, playbackSpeedStart: sp } : s))}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(segments.find((s) => s.id === selectedSegmentId)?.playbackSpeedStart ?? 1) === sp ? 'bg-amber-600 text-slate-900' : 'bg-slate-700 text-slate-500'}`}
                  >
                    {sp}x
                  </button>
                ))}
                <span className="text-[9px] text-slate-500 mx-0.5">→</span>
                <span className="text-[9px] text-slate-500">End</span>
                {[0.5, 1, 1.5, 2].map((sp) => (
                  <button
                    key={`end-${sp}`}
                    type="button"
                    onClick={() => onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, playbackSpeedEnd: sp } : s))}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(segments.find((s) => s.id === selectedSegmentId)?.playbackSpeedEnd ?? 1) === sp ? 'bg-amber-600 text-slate-900' : 'bg-slate-700 text-slate-500'}`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transform & Crop (when image or B-roll segment selected) — scale, position, rotate, crop */}
          {selectedSegmentId && onSegmentsChange && (() => {
            const seg = segments.find((s) => s.id === selectedSegmentId)
            if (!seg || (seg.type !== 'image' && seg.type !== 'video')) return null
            const t = seg.transform ?? {}
            const c = seg.crop ?? {}
            const updateTransform = (patch: Partial<NonNullable<TimelineSegment['transform']>>) =>
              onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, transform: { ...(s.transform ?? {}), ...patch } } : s))
            const updateCrop = (patch: Partial<NonNullable<TimelineSegment['crop']>>) =>
              onSegmentsChange((prev) => prev.map((s) => s.id === selectedSegmentId ? { ...s, crop: { ...(s.crop ?? {}), ...patch } } : s))
            return (
              <div className="flex flex-wrap items-center gap-3 py-2 px-2 bg-slate-700/30 dark:bg-slate-800/50 rounded-lg border border-slate-600/50">
                <span className="text-[9px] font-bold text-amber-400 uppercase">Transform</span>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-10">Scale</span>
                  <input type="range" min={10} max={200} value={Math.round((t.scale ?? 1) * 100)} onChange={(e) => updateTransform({ scale: Number(e.target.value) / 100 })} className="w-20 accent-amber-500" />
                  <span className="text-[9px] font-mono w-8">{Math.round((t.scale ?? 1) * 100)}%</span>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-10">X</span>
                  <input type="range" min={-50} max={50} value={t.positionX ?? 0} onChange={(e) => updateTransform({ positionX: Number(e.target.value) })} className="w-20 accent-amber-500" />
                  <span className="text-[9px] font-mono w-6">{t.positionX ?? 0}%</span>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-10">Y</span>
                  <input type="range" min={-50} max={50} value={t.positionY ?? 0} onChange={(e) => updateTransform({ positionY: Number(e.target.value) })} className="w-20 accent-amber-500" />
                  <span className="text-[9px] font-mono w-6">{t.positionY ?? 0}%</span>
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-10">Rotate</span>
                  <input type="range" min={-180} max={180} value={t.rotation ?? 0} onChange={(e) => updateTransform({ rotation: Number(e.target.value) })} className="w-20 accent-amber-500" />
                  <span className="text-[9px] font-mono w-8">{t.rotation ?? 0}°</span>
                </label>
                <span className="text-[9px] font-bold text-amber-400 uppercase ml-2">Crop</span>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-6">T</span>
                  <input type="range" min={0} max={50} value={c.top ?? 0} onChange={(e) => updateCrop({ top: Number(e.target.value) })} className="w-16 accent-amber-500" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-6">R</span>
                  <input type="range" min={0} max={50} value={c.right ?? 0} onChange={(e) => updateCrop({ right: Number(e.target.value) })} className="w-16 accent-amber-500" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-6">B</span>
                  <input type="range" min={0} max={50} value={c.bottom ?? 0} onChange={(e) => updateCrop({ bottom: Number(e.target.value) })} className="w-16 accent-amber-500" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 w-6">L</span>
                  <input type="range" min={0} max={50} value={c.left ?? 0} onChange={(e) => updateCrop({ left: Number(e.target.value) })} className="w-16 accent-amber-500" />
                </label>
                <button type="button" onClick={() => { updateTransform({ scale: 1, positionX: 0, positionY: 0, rotation: 0 }); updateCrop({ top: 0, right: 0, bottom: 0, left: 0 }) }} className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-600 text-slate-300 hover:bg-slate-500">Reset</button>
              </div>
            )
          })()}

          {/* Effects track - with delete, resize, enable/disable, fade indicators */}
          {effects.length > 0 && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-dashed border-purple-200 dark:border-purple-800 rounded-xl px-2 py-2 overflow-x-auto">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3 h-3 text-purple-500" />
                <span className="text-[8px] font-black uppercase text-purple-500">Effects ({effects.length})</span>
                <span className="text-[8px] text-purple-400">· Drag edges to resize · Fade indicators shown</span>
              </div>

              {/* Multi-layer effects visualization */}
              <div className="relative" style={{ minHeight: Math.max(48, Math.min(120, effects.length * 14 + 20)), minWidth: 200 }}>
                {[...effects].sort((a, b) => (b.layer || 0) - (a.layer || 0)).map((eff, idx) => {
                  const left = (eff.startTime / maxDur) * 100
                  const width = ((eff.endTime - eff.startTime) / maxDur) * 100
                  const canResize = !!onEffectsChange && !eff.locked
                  const isSelected = selectedEffectId === eff.id
                  const typeColor = EFFECT_TYPE_COLORS[eff.type] || '#8B5CF6'
                  const fadeInWidth = eff.fadeIn ? ((eff.fadeIn / (eff.endTime - eff.startTime)) * 100) : 0
                  const fadeOutWidth = eff.fadeOut ? ((eff.fadeOut / (eff.endTime - eff.startTime)) * 100) : 0
                  const layerOffset = idx * 2 // Slight vertical offset per layer for stacking visual

                  return (
                    <div
                      key={eff.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        userSeekRef.current = true
                        onTimeUpdate(eff.startTime)
                        onEffectSelect?.(eff.id)
                        onSegmentSelect?.(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { userSeekRef.current = true; onTimeUpdate(eff.startTime); onEffectSelect?.(eff.id) }
                        if (e.key === 'Escape') onEffectSelect?.(null)
                      }}
                      className={`absolute rounded-lg border-2 shadow-md flex items-center justify-between overflow-hidden cursor-pointer transition-all group/eff ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-purple-900 dark:ring-offset-gray-950 scale-[1.02] z-20' : 'hover:ring-2 hover:ring-white/50 hover:scale-[1.01]'} ${!eff.enabled ? 'opacity-40' : ''} ${eff.locked ? 'border-amber-400' : ''}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 5)}%`,
                        minWidth: 50,
                        height: 32,
                        top: layerOffset,
                        backgroundColor: typeColor,
                        borderColor: eff.locked ? '#F59E0B' : (isSelected ? '#fff' : 'rgba(255,255,255,0.3)'),
                        color: 'white',
                        zIndex: isSelected ? 20 : 10 - idx,
                      }}
                      title={`${eff.name} (${eff.type}) ${displayTime(eff.startTime)}–${displayTime(eff.endTime)} · L${eff.layer || 0} · ${eff.intensity}%${eff.fadeIn ? ` · Fade in ${eff.fadeIn}s` : ''}${eff.fadeOut ? ` · Fade out ${eff.fadeOut}s` : ''}${eff.locked ? ' · LOCKED' : ''}${canResize ? ' · Drag to resize' : ''}`}
                    >
                      {/* Fade in indicator */}
                      {fadeInWidth > 0 && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none"
                          style={{ width: `${Math.min(fadeInWidth, 50)}%` }}
                        />
                      )}

                      {/* Fade out indicator */}
                      {fadeOutWidth > 0 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-black/50 to-transparent pointer-events-none"
                          style={{ width: `${Math.min(fadeOutWidth, 50)}%` }}
                        />
                      )}

                      {/* Left resize handle */}
                      {canResize && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/eff:opacity-100 hover:bg-white/40 rounded-l transition-opacity z-20"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startT = eff.startTime
                            const onMove = (ev: MouseEvent) => {
                              const w = contentRef.current?.offsetWidth || seekRef.current?.getBoundingClientRect()?.width
                              if (!w) return
                              const dx = (ev.clientX - startX) / w * maxDur
                              updateEffectEdge(eff.id, 'start', startT + dx)
                            }
                            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                            window.addEventListener('mousemove', onMove)
                            window.addEventListener('mouseup', onUp)
                          }}
                        />
                      )}

                      {/* Effect content */}
                      <div className="flex-1 flex items-center gap-1 px-2 min-w-0 relative z-10">
                        {eff.locked && <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />}
                        <span className="text-[8px] font-mono text-white/60 shrink-0">L{eff.layer || 0}</span>
                        <span className="text-[9px] font-bold truncate">{eff.name}</span>
                        <span className="text-[7px] opacity-60 hidden lg:inline shrink-0">{eff.intensity}%</span>
                        <span className="absolute bottom-0.5 left-1 text-[7px] font-mono opacity-90 drop-shadow" title={`Duration ${displayTime(eff.endTime - eff.startTime)}`}>
                          {displayTime(eff.endTime - eff.startTime)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className={`flex items-center gap-0.5 pr-1 transition-opacity relative z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/eff:opacity-100'}`}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleEffect(eff.id) }}
                          className="p-0.5 rounded hover:bg-white/30 transition-colors"
                          title={eff.enabled ? 'Disable' : 'Enable'}
                        >
                          {eff.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDuplicateEffect(eff.id) }}
                          className="p-0.5 rounded hover:bg-white/30 transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {!eff.locked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEffectsChange?.((prev) => prev.filter((ef) => ef.id !== eff.id))
                              onEffectSelect?.(null)
                              onEffectDeleted?.()
                            }}
                            className="p-0.5 rounded hover:bg-red-500/50 transition-colors"
                            title="Delete (Del)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Right resize handle */}
                      {canResize && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/eff:opacity-100 hover:bg-white/40 rounded-r transition-opacity z-20"
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const startX = e.clientX
                            const startT = eff.endTime
                            const onMove = (ev: MouseEvent) => {
                              const w = contentRef.current?.offsetWidth || seekRef.current?.getBoundingClientRect()?.width
                              if (!w) return
                              const dx = (ev.clientX - startX) / w * maxDur
                              updateEffectEdge(eff.id, 'end', startT + dx)
                            }
                            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                            window.addEventListener('mousemove', onMove)
                            window.addEventListener('mouseup', onUp)
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Overlays track – text & image blocks */}
          {(textOverlays.length > 0 || imageOverlays.length > 0) && (
            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/50 rounded-xl px-2 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Type className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400">Overlays</span>
                <span className="text-[8px] text-amber-500/80">Text & images on video</span>
              </div>
              <div className="relative h-10" style={{ minWidth: 200 }}>
                {textOverlays.map((o) => {
                  const left = (o.startTime / maxDur) * 100
                  const width = ((o.endTime - o.startTime) / maxDur) * 100
                  return (
                    <div
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { userSeekRef.current = true; onTimeUpdate(o.startTime) }}
                      className="absolute h-7 rounded-md border border-amber-400/50 bg-amber-500/90 hover:bg-amber-500 text-white shadow-sm flex items-center px-2 min-w-[40px] cursor-pointer"
                      style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      title={`${o.text} · ${displayTime(o.startTime)} – ${displayTime(o.endTime)}`}
                    >
                      <span className="text-[8px] font-medium truncate">{o.text.slice(0, 12)}{o.text.length > 12 ? '…' : ''}</span>
                    </div>
                  )
                })}
                {imageOverlays.map((img) => {
                  const left = (img.startTime / maxDur) * 100
                  const width = ((img.endTime - img.startTime) / maxDur) * 100
                  return (
                    <div
                      key={img.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => { userSeekRef.current = true; onTimeUpdate(img.startTime) }}
                      className="absolute h-7 rounded-md border border-teal-400/50 bg-teal-500/90 hover:bg-teal-500 text-white shadow-sm flex items-center justify-center px-2 min-w-[36px] cursor-pointer"
                      style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      title={`Image · ${displayTime(img.startTime)} – ${displayTime(img.endTime)}`}
                    >
                      <ImageIcon className="w-3 h-3" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default ResizableTimeline
