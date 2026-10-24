// Timeline → source playback mapping for the WYSIWYG preview.
//
// The manual editor's preview must play what the server will actually export.
// The server (videoRenderService.js `stitchSegments`) sequences the primary
// video/broll segments in `startTime` order and, for each, cuts the source
// window [sourceStartTime .. sourceEndTime] and plays it at `playbackSpeed`
// (a ramp is approximated as the average of start/end). So one OUTPUT-timeline
// second of a 2× segment consumes two SOURCE seconds.
//
// This module is the single source of truth the preview uses to answer, at any
// output-timeline time `t`: which segment is on screen, what source time to
// show, at what playback rate, and from which source file. Keeping it pure +
// unit-tested guards preview/export parity (the render pre-pass math lives in
// server/services/videoRenderService.js and must stay in sync with this).

import { TimelineSegment } from '../types/editor'

export interface SourceMapping {
  segment: TimelineSegment | null
  /** Time (seconds) to seek within the active source. */
  sourceTime: number
  /** Effective playback rate to apply to the <video> for the active segment. */
  speed: number
  /** Source file to show, if the segment carries its own clip (multi-clip). */
  sourceUrl: string | null
  /** Freeze-frame: hold the source frame while the timeline keeps moving. */
  freeze: boolean
  /** Reverse playback — export-only (browsers can't play media in reverse). */
  reversed: boolean
}

// Browsers clamp HTMLMediaElement.playbackRate; keep well inside the safe range.
const MIN_RATE = 0.0625
const MAX_RATE = 16
// The server clamps segment speed to this range (normSegSpeed), so mirror it.
const MIN_SPEED = 0.25
const MAX_SPEED = 4

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Effective per-segment speed, matching the renderer's `normSegSpeed` + ramp
 * averaging. Returns 1 for anything unusable so the preview never stalls.
 */
export function resolveSegmentSpeed(seg: TimelineSegment | null | undefined): number {
  if (!seg) return 1
  const start = Number(seg.playbackSpeedStart)
  const end = Number(seg.playbackSpeedEnd)
  // Ramp: the export approximates a speed ramp as the average of its endpoints.
  if (isFinite(start) && isFinite(end) && start > 0 && end > 0 && start !== end) {
    return clamp((start + end) / 2, MIN_SPEED, MAX_SPEED)
  }
  const s = Number(seg.playbackSpeed)
  if (isFinite(s) && s > 0) return clamp(s, MIN_SPEED, MAX_SPEED)
  return 1
}

/** Clamp a raw playback rate to the browser-safe range. */
export function clampPlaybackRate(rate: number): number {
  if (!isFinite(rate) || rate <= 0) return 1
  return clamp(rate, MIN_RATE, MAX_RATE)
}

/**
 * The primary video segments that make up the on-screen sequence, in play order.
 * Mirrors the preview's historical selection (main tracks 0/1, types
 * video/broll/cut) so no clip that used to play is dropped, sorted by output
 * `startTime` like the renderer's `selectPrimarySegments`.
 */
export function selectPrimarySegments(segments: TimelineSegment[] | null | undefined): TimelineSegment[] {
  if (!segments || segments.length === 0) return []
  return segments
    .filter((s) => {
      const track = typeof s.track === 'number' ? s.track : 0
      if (track !== 0 && track !== 1) return false
      // B-roll is a COVER OVERLAY (rendered by RealTimeVideoPreview's activeBroll
      // layer), NOT a main-sequence source-switch. Including 'broll' here made a
      // B-roll segment BOTH swap the main <video> source AND draw the overlay on
      // top — a redundant decode plus a black flash at the broll-out cut (the
      // main <video> reloads back to base under the disappearing overlay). Only
      // real main-track clips (video/cut) drive the source-switch.
      if (s.type && s.type !== 'video' && s.type !== 'cut') return false
      return true
    })
    .slice()
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
}

function isPrimarySegment(s: TimelineSegment): boolean {
  const track = typeof s.track === 'number' ? s.track : 0
  return (track === 0 || track === 1) && (!s.type || s.type === 'video' || s.type === 'cut')
}

/**
 * Where a clip's footage starts in its source when it has no explicit window:
 * main-track clips are cut from the base video at their own timeline position;
 * B-roll / audio / overlays play their own file from 0. (Same defaults the
 * preview layers use.)
 */
export function defaultSourceStart(seg: TimelineSegment): number {
  return isPrimarySegment(seg) ? (seg.startTime ?? 0) : 0
}

/** The clip's source start: its explicit window, else the default above. */
export function sourceStartOf(seg: TimelineSegment): number {
  const v = Number(seg.sourceStartTime)
  return Number.isFinite(v) ? v : defaultSourceStart(seg)
}

/**
 * Give every video/audio clip an explicit source window. Without one, a main
 * clip's footage was inferred from wherever it sat on the timeline — so moving,
 * rippling or duplicating it changed what it showed, and the export (which only
 * honoured explicit windows) rendered different footage again. Pinning records
 * today's meaning once; returns the same array when nothing needed pinning.
 */
export function pinSourceWindows(segments: TimelineSegment[]): TimelineSegment[] {
  let changed = false
  const next = segments.map((s) => {
    if (!s || Number.isFinite(Number(s.sourceStartTime))) return s
    if (s.type && !['video', 'cut', 'audio', 'broll'].includes(s.type)) return s
    changed = true
    return { ...s, sourceStartTime: defaultSourceStart(s) }
  })
  return changed ? next : segments
}

/** Source time shown at timeline time `t` inside `seg` (a freeze holds its frame). */
export function sourceTimeAt(seg: TimelineSegment, t: number): number {
  const start = sourceStartOf(seg)
  if (seg.freezeFrame) return start
  return start + (t - seg.startTime) * resolveSegmentSpeed(seg)
}

/** The source file a segment should show, or null to keep the base video. */
export function resolveSegmentSourceUrl(seg: TimelineSegment | null | undefined): string | null {
  if (!seg) return null
  const anySeg = seg as any
  return anySeg.sourceUrl || anySeg.url || anySeg.src || null
}

/**
 * Map an OUTPUT-timeline time to the source frame the preview should render.
 *
 * `sourceTime = sourceStart + (t - segStart) * effSpeed` — the same relation the
 * renderer bakes in (a 2× segment advances its source twice as fast as the
 * output clock). For speed === 1 this reduces to the previous behaviour, so
 * existing single-speed edits are unchanged.
 */
export function mapTimelineToSource(
  timelineSec: number,
  segments: TimelineSegment[] | null | undefined
): SourceMapping {
  const base: SourceMapping = { segment: null, sourceTime: timelineSec, speed: 1, sourceUrl: null, freeze: false, reversed: false }
  const primary = selectPrimarySegments(segments)
  if (primary.length === 0) return base

  // Before the first segment (a lead-in gap after a trim that starts > 0): show
  // the BASE source at t — do not jump into any clip.
  if (timelineSec < primary[0].startTime) return base

  // Track the most recent segment that has started, so an interior gap or a time
  // past the end holds THAT segment's end frame — not the final clip's source
  // (the old fallthrough returned `last` for every unmatched t, which could swap
  // to the ending B-roll during the intro).
  let prev = primary[0]
  for (const seg of primary) {
    if (timelineSec >= seg.startTime && timelineSec < seg.endTime) {
      const speed = resolveSegmentSpeed(seg)
      const sourceStart = seg.sourceStartTime ?? seg.startTime
      const offsetIntoSeg = timelineSec - seg.startTime
      const sourceTime = seg.freezeFrame ? sourceStart : sourceStart + offsetIntoSeg * speed
      return {
        segment: seg,
        sourceTime,
        speed,
        sourceUrl: resolveSegmentSourceUrl(seg),
        freeze: !!seg.freezeFrame,
        reversed: !!seg.reversed,
      }
    }
    if (seg.startTime <= timelineSec) prev = seg
  }
  // Interior gap or past the end — hold the most recent segment's end frame.
  return {
    segment: prev,
    sourceTime: prev.sourceEndTime ?? prev.endTime,
    speed: resolveSegmentSpeed(prev),
    sourceUrl: resolveSegmentSourceUrl(prev),
    freeze: false,
    reversed: false,
  }
}

function sourceEndOf(seg: TimelineSegment): number {
  const v = Number(seg.sourceEndTime)
  if (Number.isFinite(v)) return v
  return sourceStartOf(seg) + (seg.endTime - seg.startTime) * resolveSegmentSpeed(seg)
}

/**
 * Split a clip at timeline time `time` into [left, right] with correct source
 * windows (a reversed clip shows the END of its window first; a freeze holds
 * one frame in both halves). Splitting used to copy the clip without a window,
 * so the right half replayed footage from the wrong place on export.
 */
export function splitSegmentWindow(seg: TimelineSegment, time: number, rightId: string): [TimelineSegment, TimelineSegment] {
  const left: TimelineSegment = { ...seg, endTime: time, duration: time - seg.startTime }
  const right: TimelineSegment = { ...seg, id: rightId, startTime: time, duration: seg.endTime - time }
  const srcStart = sourceStartOf(seg)
  if (seg.freezeFrame) {
    left.sourceStartTime = srcStart
    right.sourceStartTime = srcStart
    return [left, right]
  }
  const speed = resolveSegmentSpeed(seg)
  const srcEnd = sourceEndOf(seg)
  if (seg.reversed) {
    const cut = srcEnd - (time - seg.startTime) * speed
    Object.assign(left, { sourceStartTime: cut, sourceEndTime: srcEnd })
    Object.assign(right, { sourceStartTime: srcStart, sourceEndTime: cut })
  } else {
    const cut = srcStart + (time - seg.startTime) * speed
    Object.assign(left, { sourceStartTime: srcStart, sourceEndTime: cut })
    Object.assign(right, { sourceStartTime: cut })
    if (Number.isFinite(Number(seg.sourceEndTime))) right.sourceEndTime = seg.sourceEndTime
  }
  return [left, right]
}

/**
 * Move a clip's start edge to `newStart`, trimming (or revealing) footage so
 * the rest of the clip stays put. Won't reveal footage before source 0.
 */
export function trimSegmentStart(seg: TimelineSegment, newStart: number): TimelineSegment {
  if (seg.freezeFrame) return { ...seg, startTime: newStart, duration: seg.endTime - newStart }
  const speed = resolveSegmentSpeed(seg)
  if (seg.reversed) {
    const srcEnd = sourceEndOf(seg) - (newStart - seg.startTime) * speed
    return { ...seg, startTime: newStart, duration: seg.endTime - newStart, sourceStartTime: sourceStartOf(seg), sourceEndTime: srcEnd }
  }
  const srcStart = sourceStartOf(seg)
  // Clamp so extending the start can't reach before the beginning of the source.
  const start = Math.max(newStart, seg.startTime - srcStart / speed)
  return {
    ...seg,
    startTime: start,
    duration: seg.endTime - start,
    sourceStartTime: Math.max(0, srcStart + (start - seg.startTime) * speed),
  }
}

/** Move a clip's end edge to `newEnd`, keeping an explicit source end in step. */
export function trimSegmentEnd(seg: TimelineSegment, newEnd: number): TimelineSegment {
  const next: TimelineSegment = { ...seg, endTime: newEnd, duration: newEnd - seg.startTime }
  if (seg.freezeFrame) return next
  const delta = (newEnd - seg.endTime) * resolveSegmentSpeed(seg)
  if (seg.reversed) {
    next.sourceStartTime = Math.max(0, sourceStartOf(seg) - delta)
  } else if (Number.isFinite(Number(seg.sourceEndTime))) {
    next.sourceEndTime = Number(seg.sourceEndTime) + delta
  }
  return next
}
