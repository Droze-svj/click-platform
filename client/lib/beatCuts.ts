// Client-side beat-cut planner — mirrors server/services/beatSyncCutService so
// the editor can re-segment the timeline on beats without a full upload/download
// (it reuses the lightweight /video/manual-editing/beats onset endpoint).

import type { TimelineSegment, SegmentTransitionType } from '../types/editor'

export interface BeatSegment { start: number; end: number; durationSec: number }
export interface BeatCutPlan { segments: BeatSegment[]; cutPoints: number[]; count: number; reason?: string }

/**
 * Turn beat timestamps into a segment plan whose cuts land on beats. Cut on every
 * Nth beat once a clip is past minClip; force a cut before maxClip. Contiguous,
 * non-overlapping segments tiling [0, duration].
 */
export function buildBeatCutPlan(
  beats: number[],
  options: { duration?: number; minClip?: number; maxClip?: number; everyNthBeat?: number } = {},
): BeatCutPlan {
  const duration = Number(options.duration) || 0
  const minClip = Math.max(0.2, Number(options.minClip) || 0.6)
  const maxClip = Math.max(minClip, Number(options.maxClip) || 4)
  const everyNth = Math.max(1, Math.floor(Number(options.everyNthBeat) || 2))

  const bts = (Array.isArray(beats) ? beats : [])
    .map(Number)
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b)
  if (!bts.length) return { segments: [], cutPoints: [], count: 0, reason: 'no_beats' }

  const cuts = [0]
  let lastCut = 0
  let beatCounter = 0
  for (const t of bts) {
    if (duration && t >= duration) break
    beatCounter += 1
    const sinceCut = t - lastCut
    if (sinceCut >= maxClip || (beatCounter % everyNth === 0 && sinceCut >= minClip)) {
      cuts.push(Math.round(t * 1000) / 1000)
      lastCut = t
      beatCounter = 0
    }
  }
  const end = duration || (bts[bts.length - 1] + minClip)
  if (cuts[cuts.length - 1] < end - 0.05) cuts.push(Math.round(end * 1000) / 1000)

  const segments: BeatSegment[] = []
  for (let i = 1; i < cuts.length; i++) {
    const s = cuts[i - 1]
    const e = cuts[i]
    if (e > s) segments.push({ start: s, end: e, durationSec: Math.round((e - s) * 1000) / 1000 })
  }
  return { segments, cutPoints: cuts.slice(1, -1), count: segments.length }
}

/**
 * Convert a beat-cut plan into timeline VIDEO segments of the same source —
 * contiguous (timeline time == source time), with an optional transition on each
 * cut (every segment but the last).
 */
export function planToSegments(
  plan: BeatCutPlan,
  opts: { sourceUrl?: string; transition?: SegmentTransitionType; transitionDuration?: number; idPrefix?: string } = {},
): TimelineSegment[] {
  const { sourceUrl, transition, transitionDuration = 0.4, idPrefix = 'beatcut' } = opts
  const segs = plan.segments || []
  const stamp = idPrefix
  return segs.map((s, i): TimelineSegment => ({
    id: `${stamp}-${i}-${Math.round(s.start * 1000)}`,
    startTime: s.start,
    endTime: s.end,
    duration: s.durationSec,
    type: 'video',
    name: `Beat ${i + 1}`,
    color: '#6366f1',
    track: 0,
    sourceStartTime: s.start,
    sourceEndTime: s.end,
    sourceUrl,
    ...(transition && transition !== 'none' && i < segs.length - 1
      ? { transitionOut: transition, transitionDuration }
      : {}),
  }))
}
