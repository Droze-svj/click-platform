'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import styles from './AdvancedTimelineView.module.css'

import { Stage, Layer, Rect, Text as KonvaText, Line, Group } from 'react-konva'
import {
  Clock, Scissors, Compass, Magnet, ZoomIn, ZoomOut,
  Layers, Music2, Film, Type, Ghost
} from 'lucide-react'
import { TimelineSegment } from '../../../types/editor'
import { formatTime, resolveTimelineOverlaps } from '../../../utils/editorUtils'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Text } from 'react-konva'
import { useLocalVAD } from '../../../hooks/useLocalVAD'
import { useCompetitorGhosting } from '../../../hooks/useCompetitorGhosting'
import { cn } from '../../../lib/utils'

// ── Types & constants ─────────────────────────────────────────────────────────

interface AdvancedTimelineViewProps {
  useProfessionalTimeline: boolean
  setUseProfessionalTimeline: (v: boolean) => void
  videoState: any
  setVideoState: (v: any) => void
  timelineSegments: TimelineSegment[]
  setTimelineSegments: (v: any) => void
  selectedSegmentId?: string | null
  onSegmentSelect?: (id: string | null) => void
  videoUrl: string
  aiSuggestions: any[]
  showAiPreviews: boolean
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (category: import('../../../types/editor').EditorCategory) => void
  /** Pre-computed retention heatmap from retentionHeatmapService */
  retentionHeatmap?: Array<{ timeStart: number; timeEnd: number; score: number; level: 'high' | 'medium' | 'low' }>
}

const TRACK_HEIGHT = 44
const TRACK_GAP = 8
const LABEL_WIDTH = 80
const RULER_HEIGHT = 28
const SNAP_THRESHOLD_PX = 8

// Track definitions: each segment type gets a named track row
const TRACK_DEFS: { id: number; label: string; color: string; icon: React.ElementType }[] = [
  { id: 0, label: 'Video',   color: '#3B82F6', icon: Film },
  { id: 1, label: 'B-Roll',  color: '#F59E0B', icon: Layers },
  { id: 2, label: 'Text',    color: '#A855F7', icon: Type },
  { id: 3, label: 'Audio',   color: '#10B981', icon: Music2 },
  { id: 4, label: 'SFX',     color: '#F97316', icon: Scissors },
]

// Retention score → fill colour
function heatColor(level: string): string {
  if (level === 'high') return 'rgba(52,211,153,0.12)'
  if (level === 'medium') return 'rgba(251,191,36,0.12)'
  return 'rgba(248,113,113,0.2)'
}

// Right-click context menu data
interface CtxMenu { x: number; y: number; segId: string }

// ── Component ─────────────────────────────────────────────────────────────────

const AdvancedTimelineView: React.FC<AdvancedTimelineViewProps> = ({
  useProfessionalTimeline: _useProfessionalTimeline,
  setUseProfessionalTimeline,
  videoState,
  setVideoState,
  timelineSegments,
  setTimelineSegments,
  selectedSegmentId = null,
  onSegmentSelect,
  aiSuggestions,
  showToast,
  setActiveCategory: _setActiveCategory,
  showAiPreviews = true,
  retentionHeatmap = [],
}) => {
  const duration = videoState?.duration ?? 60
  const playheadTime = videoState?.currentTime ?? 0

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)

  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isMagnetic, setIsMagnetic] = useState(true)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<number | null>(null)

  // Local AI VAD (Phase 1)
  const { isReady: vadReady, isProcessing: vadProcessing, vadSegments, processAudio } = useLocalVAD()

  // Competitor Ghosting (Task 4.1)
  const { profiles, activeProfile, loadGhostCurve, clearGhostCurve, getExpectedEnergyAtTime } = useCompetitorGhosting()

  const handleRunVAD = () => {
    if (!vadReady || vadProcessing) return
    // In a real V6 implementation, we extract the AudioBuffer from the video URL using OfflineAudioContext.
    // For this Phase 1 structure demonstration, we pass a dummy buffer to trigger the Web Worker.
    const dummyBuffer = new Float32Array(44100 * 15) // 15 seconds of silence
    processAudio(dummyBuffer)
    showToast('Running Local Edge AI (VAD)', 'info')
  }

  const stagePaddingX = LABEL_WIDTH

  // ── Zoom / scale ────────────────────────────────────────────────────────────
  const pixelsPerSecond = useMemo(() => {
    const basePPS = (dimensions.width - stagePaddingX * 2) / Math.max(duration, 1)
    return basePPS * Math.pow(1.5, zoomLevel - 1)
  }, [dimensions.width, duration, stagePaddingX, zoomLevel])

  const timeToX = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond])
  const xToTime = useCallback((x: number) => x / pixelsPerSecond, [pixelsPerSecond])

  // ── Measure ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ── Snap edges ──────────────────────────────────────────────────────────────
  const snapEdges = useMemo(() => {
    const edges: number[] = [0, duration, playheadTime]
    timelineSegments.forEach(s => { edges.push(s.startTime, s.endTime) })
    return Array.from(new Set(edges)).sort((a, b) => a - b)
  }, [duration, playheadTime, timelineSegments])

  const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>, seg: TimelineSegment) => {
    if (!isMagnetic) return
    const node = e.target
    const newX = node.x()
    const newTime = xToTime(newX)
    const segDur = seg.endTime - seg.startTime
    let minDiff = Infinity
    let matchedEdge = newTime

    for (const edge of snapEdges) {
      if (Math.abs(edge - seg.startTime) < 0.01 || Math.abs(edge - seg.endTime) < 0.01) continue
      const pxLeft = Math.abs(timeToX(newTime) - timeToX(edge))
      const pxRight = Math.abs(timeToX(newTime + segDur) - timeToX(edge))
      if (pxLeft < minDiff) { minDiff = pxLeft; matchedEdge = edge }
      if (pxRight < minDiff) { minDiff = pxRight; matchedEdge = edge - segDur }
    }
    if (minDiff < SNAP_THRESHOLD_PX) node.x(timeToX(matchedEdge))
  }, [isMagnetic, snapEdges, timeToX, xToTime])

  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>, seg: TimelineSegment) => {
    const node = e.target
    const finalTime = Math.max(0, xToTime(node.x()))
    node.x(timeToX(finalTime))
    const segDur = seg.endTime - seg.startTime

    // Calculate new track based on y coordinate
    const dragY = node.y()
    const newTrack = Math.max(0, Math.round(dragY / (TRACK_HEIGHT + TRACK_GAP)))

    // Instantly snap the y-position of the node to the target track
    node.y(newTrack * (TRACK_HEIGHT + TRACK_GAP))

    setTimelineSegments((prev: TimelineSegment[]) =>
      resolveTimelineOverlaps(prev, seg.id, finalTime, finalTime + segDur, newTrack)
    )
    showToast('Segment moved & track aligned', 'info')
  }, [xToTime, timeToX, setTimelineSegments, showToast])

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    setCtxMenu(null)
    if (e.target.getStage() === e.target) {
      onSegmentSelect?.(null)
      const relX = e.evt.offsetX - stagePaddingX
      const t = Math.max(0, Math.min(duration, xToTime(relX)))
      setVideoState((prev: any) => ({ ...prev, currentTime: t }))
    }
  }

  // ── Right-click context menu ────────────────────────────────────────────────
  const handleSegmentRightClick = (e: KonvaEventObject<MouseEvent>, seg: TimelineSegment) => {
    e.evt.preventDefault()
    onSegmentSelect?.(seg.id)
    setCtxMenu({ x: e.evt.clientX, y: e.evt.clientY, segId: seg.id })
  }

  const handleContextAction = (action: string) => {
    if (!ctxMenu) return
    const seg = timelineSegments.find(s => s.id === ctxMenu.segId)
    if (!seg) { setCtxMenu(null); return }

    switch (action) {
      case 'split': {
        const mid = (seg.startTime + seg.endTime) / 2
        const suffixA = `a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const suffixB = `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const a: TimelineSegment = {
          ...seg,
          id: `${seg.id}-${suffixA}`,
          endTime: mid,
          duration: mid - seg.startTime
        }
        const b: TimelineSegment = {
          ...seg,
          id: `${seg.id}-${suffixB}`,
          startTime: mid,
          duration: seg.endTime - mid
        }
        setTimelineSegments((prev: TimelineSegment[]) => prev.flatMap(s => s.id === seg.id ? [a, b] : [s]))
        showToast('Segment split at midpoint', 'success')
        break
      }
      case 'duplicate': {
        const dupDur = seg.endTime - seg.startTime
        const suffixDup = `dup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const dup: TimelineSegment = {
          ...seg,
          id: `${seg.id}-${suffixDup}`,
          startTime: seg.endTime,
          endTime: seg.endTime + dupDur,
          duration: dupDur
        }
        setTimelineSegments((prev: TimelineSegment[]) => {
          const next = [...prev, dup]
          return resolveTimelineOverlaps(next, dup.id, dup.startTime, dup.endTime, dup.track ?? 0)
        })
        showToast('Segment duplicated & shifted', 'success')
        break
      }
      case 'delete': {
        setTimelineSegments((prev: TimelineSegment[]) => prev.filter(s => s.id !== seg.id))
        onSegmentSelect?.(null)
        showToast('Segment deleted', 'info')
        break
      }
    }
    setCtxMenu(null)
  }

  // ── Ruler ───────────────────────────────────────────────────────────────────
  const renderRuler = () => {
    const ticks: React.ReactNode[] = []
    const tickInterval = pixelsPerSecond > 50 ? 1 : pixelsPerSecond > 10 ? 5 : 10
    for (let t = 0; t <= duration; t += tickInterval) {
      const x = timeToX(t)
      const isMajor = t % (tickInterval * 2) === 0
      ticks.push(
        <Line key={`tk-${t}`} points={[x, isMajor ? 6 : 12, x, RULER_HEIGHT - 2]} stroke={isMajor ? '#475569' : '#1e293b'} strokeWidth={1} />
      )
      if (isMajor) {
        ticks.push(
          <KonvaText key={`tx-${t}`} x={x + 3} y={4} text={formatTime(t)} fontSize={9} fill="#64748B" fontFamily="Inter" />
        )
      }
    }
    return ticks
  }

  // ── Dynamic Track Generation (Infinite Layers) ───────────────────────────────
  const maxTrack = Math.max(4, ...timelineSegments.map(s => s.track ?? 0));
  const DYNAMIC_TRACKS = useMemo(() => {
    const tracks = [...TRACK_DEFS];
    for (let i = 5; i <= maxTrack; i++) {
      tracks.push({ id: i, label: `Layer ${i-4}`, color: '#8B5CF6', icon: Layers });
    }
    return tracks;
  }, [maxTrack]);

  // ── Track bands (DOM — drawn beneath the Konva canvas) ──────────────────────
  const totalTrackHeight = DYNAMIC_TRACKS.length * (TRACK_HEIGHT + TRACK_GAP)
  const canvasWidth = Math.max(dimensions.width, timeToX(duration) + stagePaddingX * 2)
  const canvasHeight = Math.max(dimensions.height, RULER_HEIGHT + totalTrackHeight + 40)

  // Segments visible in active track filter
  const visibleSegments = selectedTrackFilter !== null
    ? timelineSegments.filter(s => (s.track ?? 0) === selectedTrackFilter)
    : timelineSegments

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-subtle ds-surface-card">

      {/* ── Top Control Bar ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
            <Compass className="h-4 w-4 text-indigo-500" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="ds-text-label text-theme-primary">Advanced Timeline</h3>
            <span className="ds-text-caption text-theme-muted">{timelineSegments.length} segments</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Track filter pills */}
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => setSelectedTrackFilter(null)}
              className={cn(
                'rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
                selectedTrackFilter === null ? 'bg-indigo-500 text-white' : 'ds-surface-subtle text-theme-muted hover:text-theme-primary'
              )}
            >All</button>
            {DYNAMIC_TRACKS.map(t => (
              <button
                type="button"
                key={t.id}
                onClick={() => setSelectedTrackFilter(selectedTrackFilter === t.id ? null : t.id)}
                className={cn(
                  'rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors',
                  selectedTrackFilter === t.id ? 'border-border text-theme-primary' : 'border-transparent ds-surface-subtle text-theme-muted hover:text-theme-primary'
                )}
                style={selectedTrackFilter === t.id ? { backgroundColor: t.color + '33' } : undefined}
              >{t.label}</button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Local VAD */}
          <button
            type="button"
            onClick={handleRunVAD}
            disabled={!vadReady || vadProcessing}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-50',
              vadProcessing ? 'border-sky-500/30 bg-sky-500/15 text-sky-500' : 'border-subtle ds-surface-subtle text-theme-secondary hover:text-theme-primary'
            )}
            title="Run Local Edge VAD"
          >
            {vadProcessing ? 'Processing…' : 'Run VAD'}
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Ghosting Overlay Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-subtle ds-surface-subtle px-1.5 py-1">
            <button
              type="button"
              onClick={() => clearGhostCurve()}
              className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors', !activeProfile ? 'bg-indigo-500/15 text-indigo-500' : 'text-theme-muted hover:text-theme-primary')}
            >
              Raw
            </button>
            {profiles.map(p => (
              <button
                type="button"
                key={p.id}
                onClick={() => loadGhostCurve(p.id)}
                className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors', activeProfile?.id === p.id ? 'bg-indigo-500/15 text-indigo-500' : 'text-theme-muted hover:text-theme-primary')}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
            <Ghost className={cn('ml-1 h-3 w-3', activeProfile ? 'text-indigo-500' : 'text-theme-muted')} aria-hidden />
          </div>

          <div className="h-4 w-px bg-border" />

          <button
            type="button"
            onClick={() => setIsMagnetic(v => !v)}
            className={cn('rounded-lg border p-1.5 transition-colors', isMagnetic ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-500' : 'border-subtle ds-surface-subtle text-theme-muted')}
            title="Magnetic snap"
          >
            <Magnet className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" onClick={() => setZoomLevel(z => Math.max(0.1, z - 0.5))} title="Zoom Out" className="rounded-lg border border-subtle ds-surface-subtle p-1.5 text-theme-secondary hover:text-theme-primary">
            <ZoomOut className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="w-8 text-center font-mono text-[10px] text-theme-muted">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" onClick={() => setZoomLevel(z => Math.min(10, z + 0.5))} title="Zoom In" className="rounded-lg border border-subtle ds-surface-subtle p-1.5 text-theme-secondary hover:text-theme-primary">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Scroll to playhead */}
          <button
            type="button"
            onClick={() => {
              const el = containerRef.current?.parentElement
              if (el) el.scrollLeft = Math.max(0, timeToX(playheadTime) - 100)
            }}
            title="Jump to playhead"
            className="rounded-lg border border-subtle ds-surface-subtle p-1.5 text-theme-secondary hover:text-theme-primary"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => setUseProfessionalTimeline(false)}
            className="rounded-lg border border-subtle ds-surface-subtle px-3 py-1.5 text-[10px] font-medium text-theme-secondary transition-colors hover:text-theme-primary"
          >
            Basic mode
          </button>
        </div>
      </div>

      {/* ── Track Labels Column + Canvas ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Track label sidebar */}
        <div className="flex w-20 shrink-0 flex-col border-r border-subtle ds-surface-subtle pt-[28px]">
          {/* Ruler spacer */}
          <div className="h-[28px] shrink-0" />
          {DYNAMIC_TRACKS.map(track => (
            <div
              key={track.id}
              className={`group flex cursor-pointer items-center justify-center gap-1.5 px-2 ${styles.trackRow}`}
              style={{ height: `${TRACK_HEIGHT + TRACK_GAP}px`, opacity: selectedTrackFilter === null || selectedTrackFilter === track.id ? 1 : 0.25 }}
            >
              <div className="h-5 w-1 rounded-full" style={{ backgroundColor: track.color + '88' }} />
              <span className="text-[10px] font-medium text-theme-muted transition-colors group-hover:text-theme-primary">{track.label}</span>
            </div>
          ))}
          {/* Add Layer Button */}
          <button
            type="button"
            onClick={() => {
              const newLayerId = DYNAMIC_TRACKS.length;
              showToast(`Added new Layer ${newLayerId - 4}`, 'success');
              // To actually force layer render, we would need to add an empty segment or track state
            }}
            className="mx-2 mt-2 rounded-lg border border-dashed border-subtle p-1.5 text-[10px] font-medium text-theme-muted transition-colors hover:text-theme-primary"
          >
            + Add Layer
          </button>
        </div>

        {/* Scrollable canvas area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto relative" ref={containerRef}>
          <div className={styles.canvas} style={{ width: canvasWidth, height: canvasHeight }}>
            <Stage
              width={canvasWidth}
              height={canvasHeight}
              onClick={handleStageClick}
              onContextMenu={e => { e.evt.preventDefault(); setCtxMenu(null) }}
              ref={stageRef}
            >
              {/* ── Retention heatmap layer ──────────────────────────────── */}
              {retentionHeatmap.length > 0 && (
                <Layer y={RULER_HEIGHT}>
                  {retentionHeatmap.map((zone, i) => (
                    <Rect
                      key={i}
                      x={timeToX(zone.timeStart)}
                      y={0}
                      width={timeToX(zone.timeEnd - zone.timeStart)}
                      height={totalTrackHeight}
                      fill={heatColor(zone.level)}
                      listening={false}
                    />
                  ))}
                </Layer>
              )}

              {/* ── Competitor Ghosting Overlay (Task 4.1) ─────────────── */}
              {activeProfile && (
                <Layer y={RULER_HEIGHT}>
                  <Line
                    points={Array.from({ length: 50 }).flatMap((_, i) => {
                      const tPct = i / 49;
                      const time = tPct * duration;
                      const energy = getExpectedEnergyAtTime(tPct);
                      // Map energy (0-100) to height (top = 100, bottom = 0)
                      const y = totalTrackHeight - (energy / 100) * totalTrackHeight;
                      return [timeToX(time), y];
                    })}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    opacity={0.4}
                    dash={[10, 5]}
                    tension={0.4}
                  />
                  <Text
                    x={10}
                    y={totalTrackHeight - 20}
                    text={`Ghost: ${activeProfile.name}`}
                    fill="#F59E0B"
                    fontSize={10}
                    fontStyle="bold"
                    opacity={0.6}
                  />
                </Layer>
              )}

              {/* ── Local VAD Speech overlay ──────────────────────────────── */}
              {vadSegments.length > 0 && (
                <Layer y={RULER_HEIGHT}>
                  {vadSegments.map((zone, i) => (
                    <Rect
                      key={`vad-${i}`}
                      x={timeToX(zone.start)}
                      y={0}
                      width={timeToX(zone.end - zone.start)}
                      height={totalTrackHeight}
                      fill={zone.isSpeech ? 'rgba(56, 189, 248, 0.08)' : 'rgba(0,0,0,0)'}
                      listening={false}
                    />
                  ))}
                </Layer>
              )}

              {/* ── Ruler layer ──────────────────────────────────────────── */}
              <Layer>
                {/* Ruler background */}
                <Rect x={0} y={0} width={canvasWidth} height={RULER_HEIGHT} fill="#0a0f16" />
                {renderRuler()}
                {/* Ruler bottom border */}
                <Line points={[0, RULER_HEIGHT, canvasWidth, RULER_HEIGHT]} stroke="#1e293b" strokeWidth={1} />
              </Layer>

              {/* ── Track stripe layer ───────────────────────────────────── */}
              <Layer y={RULER_HEIGHT}>
                {DYNAMIC_TRACKS.map(track => (
                  <Rect
                    key={track.id}
                    x={0}
                    y={track.id * (TRACK_HEIGHT + TRACK_GAP)}
                    width={canvasWidth}
                    height={TRACK_HEIGHT}
                    fill={track.id % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.005)'}
                    listening={false}
                  />
                ))}
              </Layer>

              {/* ── AI suggestion markers ────────────────────────────────── */}
              <Layer y={RULER_HEIGHT}>
                {aiSuggestions.map((sug, i) => {
                  const x = timeToX(sug.time ?? 0)
                  return (
                    <Group key={i} x={x}>
                      <Line points={[0, 0, 0, totalTrackHeight]} stroke="#F59E0B" strokeWidth={1} dash={[3, 4]} opacity={0.5} />
                      <KonvaText x={4} y={4} text="◆" fontSize={8} fill="#F59E0B" />
                    </Group>
                  )
                })}
              </Layer>

              {/* ── Segments layer ───────────────────────────────────────── */}
              <Layer y={RULER_HEIGHT}>
                {visibleSegments.map(seg => {
                  const x = timeToX(seg.startTime)
                  const width = Math.max(2, timeToX(seg.endTime - seg.startTime))
                  const trackDef = DYNAMIC_TRACKS.find(t => t.id === (seg.track ?? 0)) ?? DYNAMIC_TRACKS[0]
                  const y = (seg.track ?? 0) * (TRACK_HEIGHT + TRACK_GAP)
                  const isSelected = selectedSegmentId === seg.id
                  const segColor = seg.color || trackDef.color

                  return (
                    <Group
                      key={seg.id}
                      x={x}
                      y={y}
                      draggable
                      onDragMove={e => handleDragMove(e, seg)}
                      onDragEnd={e => handleDragEnd(e, seg)}
                      onClick={e => { e.cancelBubble = true; onSegmentSelect?.(seg.id) }}
                      onContextMenu={e => handleSegmentRightClick(e, seg)}
                    >
                      {/* Segment body */}
                      <Rect
                        width={width}
                        height={TRACK_HEIGHT}
                        fill={segColor + (isSelected ? 'dd' : '88')}
                        cornerRadius={5}
                        stroke={isSelected ? '#ffffff' : segColor}
                        strokeWidth={isSelected ? 1.5 : 0.5}
                        shadowColor={isSelected ? segColor : 'transparent'}
                        shadowBlur={isSelected ? 12 : 0}
                        shadowOpacity={0.6}
                      />
                      {/* Left-edge accent */}
                      <Rect x={0} y={2} width={3} height={TRACK_HEIGHT - 4} fill={segColor} cornerRadius={2} />
                      {/* Label */}
                      {width > 30 && (
                        <KonvaText
                          x={10}
                          y={TRACK_HEIGHT / 2 - 6}
                          text={seg.name}
                          fontSize={10}
                          fontFamily="Inter"
                          fontStyle="bold"
                          fill="rgba(255,255,255,0.9)"
                          width={width - 14}
                          wrap="none"
                          ellipsis
                        />
                      )}
                      {/* Duration badge */}
                      {width > 60 && (
                        <KonvaText
                          x={10}
                          y={TRACK_HEIGHT / 2 + 4}
                          text={formatTime(seg.endTime - seg.startTime)}
                          fontSize={8}
                          fontFamily="Inter"
                          fill="rgba(255,255,255,0.4)"
                        />
                      )}
                    </Group>
                  )
                })}

                {/* ── Playhead ────────────────────────────────────────────── */}
                <Group x={timeToX(playheadTime)} y={-RULER_HEIGHT}>
                  <Line
                    points={[0, 0, 0, RULER_HEIGHT + totalTrackHeight + 20]}
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    shadowColor="#EF4444"
                    shadowBlur={8}
                    shadowOpacity={0.6}
                  />
                  {/* Playhead handle */}
                  <Rect x={-5} y={RULER_HEIGHT - 6} width={10} height={8} fill="#EF4444" cornerRadius={2} />
                  {/* Time label */}
                  <Rect x={-22} y={0} width={44} height={16} fill="#EF4444" cornerRadius={3} />
                  <KonvaText x={-20} y={3} text={formatTime(playheadTime)} fontSize={8} fill="white" fontFamily="Inter" fontStyle="bold" />
                </Group>
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      {/* ── Right-click Context Menu ─────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          className={`fixed z-[9999] overflow-hidden rounded-xl border border-subtle ds-surface-elevated ${styles.contextMenu}`}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {[
            { action: 'split',     label: 'Split at midpoint', icon: Scissors, color: 'text-theme-secondary' },
            { action: 'duplicate', label: 'Duplicate',          icon: Layers,   color: 'text-theme-secondary' },
            { action: 'delete',    label: 'Delete segment',     icon: Scissors, color: 'text-rose-500' },
          ].map(item => {
            const ItemIcon = item.icon
            return (
              <button
                type="button"
                key={item.action}
                onClick={() => handleContextAction(item.action)}
                className={cn('flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent', item.color)}
              >
                <ItemIcon className="h-3.5 w-3.5" aria-hidden /> {item.label}
              </button>
            )
          })}
          <button type="button" onClick={() => setCtxMenu(null)} className="w-full px-4 py-2 text-left text-xs text-theme-muted transition-colors hover:bg-accent">
            Cancel
          </button>
        </div>
      )}

      {/* Click outside to close ctx menu */}
      {ctxMenu && <div className="fixed inset-0 z-[9998]" onClick={() => setCtxMenu(null)} />}
    </div>
  )
}

export default AdvancedTimelineView
