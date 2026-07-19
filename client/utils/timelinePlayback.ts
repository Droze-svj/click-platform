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
      if (s.type && s.type !== 'video' && s.type !== 'broll' && s.type !== 'cut') return false
      return true
    })
    .slice()
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
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
  const primary = selectPrimarySegments(segments)
  if (primary.length === 0) {
    return { segment: null, sourceTime: timelineSec, speed: 1, sourceUrl: null, freeze: false, reversed: false }
  }
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
  }
  // Past the last segment — clamp to its end.
  const last = primary[primary.length - 1]
  return {
    segment: last,
    sourceTime: last.sourceEndTime ?? last.endTime,
    speed: resolveSegmentSpeed(last),
    sourceUrl: resolveSegmentSourceUrl(last),
    freeze: false,
    reversed: false,
  }
}
