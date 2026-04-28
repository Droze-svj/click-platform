/**
 * timelineOps.ts — pure functions for non-destructive timeline operations.
 *
 * These never mutate; they take the current segments + an action and return
 * the next segments array. The editor wires them up to keyboard shortcuts
 * (S, X) and toolbar actions.
 */

import type { TimelineSegment } from '../types/editor'

/** Split every segment that intersects `time` into two clips at that point. */
export function splitAtTime(
  segments: TimelineSegment[],
  time: number,
  ids?: string[],
): TimelineSegment[] {
  const out: TimelineSegment[] = []
  for (const seg of segments) {
    const inSelection = !ids || ids.length === 0 || ids.includes(seg.id)
    const intersects = inSelection && seg.startTime < time - 1e-3 && seg.endTime > time + 1e-3
    if (!intersects) { out.push(seg); continue }
    const a: TimelineSegment = { ...seg, endTime: time, duration: time - seg.startTime }
    const b: TimelineSegment = {
      ...seg,
      id: `${seg.id}-split-${Date.now().toString(36)}`,
      startTime: time,
      duration: seg.endTime - time,
    }
    out.push(a, b)
  }
  return out
}

/**
 * Ripple delete: remove the given segments and slide everything after them
 * left by the deleted span(s) so there's no gap. Operates per track so
 * deletions on the audio track don't shift video clips.
 */
export function rippleDelete(
  segments: TimelineSegment[],
  ids: string[],
): TimelineSegment[] {
  if (ids.length === 0) return segments
  const idSet = new Set(ids)
  // Group deletions by track to compute per-track shift offsets.
  const deletionsByTrack = new Map<number, { start: number; end: number }[]>()
  for (const seg of segments) {
    if (!idSet.has(seg.id)) continue
    const t = (seg as any).track ?? 0
    const arr = deletionsByTrack.get(t) || []
    arr.push({ start: seg.startTime, end: seg.endTime })
    deletionsByTrack.set(t, arr)
  }

  const shiftFor = (track: number, time: number): number => {
    const dels = deletionsByTrack.get(track) || []
    let shift = 0
    for (const d of dels) {
      if (time >= d.end) shift += d.end - d.start
    }
    return shift
  }

  const result: TimelineSegment[] = []
  for (const seg of segments) {
    if (idSet.has(seg.id)) continue
    const t = (seg as any).track ?? 0
    const s = shiftFor(t, seg.startTime)
    if (s === 0) { result.push(seg); continue }
    result.push({
      ...seg,
      startTime: Math.max(0, seg.startTime - s),
      endTime: Math.max(0, seg.endTime - s),
    })
  }
  return result
}

/** Build the snap-stops array used by the magnetic snap helper. */
export function buildSnapStops(opts: {
  segments: TimelineSegment[]
  markers?: { time: number }[]
  playhead?: number
  duration?: number
}): number[] {
  const stops = new Set<number>()
  stops.add(0)
  if (opts.duration && opts.duration > 0) stops.add(opts.duration)
  if (opts.playhead != null) stops.add(opts.playhead)
  for (const seg of opts.segments) { stops.add(seg.startTime); stops.add(seg.endTime) }
  for (const m of opts.markers || []) stops.add(m.time)
  return Array.from(stops).sort((a, b) => a - b)
}

/** Pure JS comparator: stable sort segments by start time then track. */
export function sortByTime(segments: TimelineSegment[]): TimelineSegment[] {
  return segments.slice().sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime
    return ((a as any).track ?? 0) - ((b as any).track ?? 0)
  })
}
