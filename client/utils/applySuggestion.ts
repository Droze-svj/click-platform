/**
 * applySuggestion.ts — pure dispatchers that turn an AIDirectorSuggestion
 * into a concrete change to the editor's timeline state.
 *
 * The seam this closes: the AI Assist panel hands the editor a list of
 * `AIDirectorSuggestion` records (cut/broll/hook/transition/audio/effect)
 * but historically there was no apply path — users saw "AI suggests cut
 * at 2.3s" and had to recreate it manually. These dispatchers convert
 * each suggestion into a precise patch over `{segments, textOverlays}`.
 *
 * Pure functions. No side effects. The hook layer (useTimelineActions)
 * is what wires the result back into editor state + history.
 */

import type {
  AIDirectorSuggestion,
  TimelineSegment,
  TextOverlay,
} from '../types/editor'
import { splitAtTime, rippleDelete, sortByTime } from './timelineOps'

export interface ApplySuggestionContext {
  segments: TimelineSegment[]
  textOverlays: TextOverlay[]
  duration: number
}

export interface ApplySuggestionResult {
  /** Next segments after applying — pass straight to setTimelineSegments. */
  segments: TimelineSegment[]
  /** Next overlays — pass straight to setTextOverlays. */
  textOverlays: TextOverlay[]
  /** Whether anything actually changed. UI uses this to skip toasts. */
  changed: boolean
  /** Human-readable summary, used for the history entry + toast. */
  description: string
}

/** Track index for B-roll overlays — V3 in the project's track convention. */
const TRACK_BROLL = 2
/** Track index for graphics/text — V5. */
const TRACK_GRAPHICS = 4

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Default duration when a suggestion doesn't specify one. */
function suggestionWindow(s: AIDirectorSuggestion): { start: number; end: number; duration: number } {
  const start = Math.max(0, s.time)
  const duration = s.duration && s.duration > 0 ? s.duration : 1.5
  return { start, end: start + duration, duration }
}

function applyCut(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  const { start, end } = suggestionWindow(s)
  // Split at both ends, then ripple-delete the middle clip(s) on every track
  // that contains a fully-enclosed segment in [start, end].
  const split1 = splitAtTime(ctx.segments, start)
  const split2 = splitAtTime(split1, end)
  const idsToRemove = split2
    .filter(seg => seg.startTime >= start - 1e-3 && seg.endTime <= end + 1e-3)
    .map(seg => seg.id)
  if (idsToRemove.length === 0) {
    return { segments: ctx.segments, textOverlays: ctx.textOverlays, changed: false, description: 'No clip to cut at this time' }
  }
  const next = sortByTime(rippleDelete(split2, idsToRemove))
  return {
    segments: next,
    textOverlays: ctx.textOverlays,
    changed: true,
    description: `Cut ${(end - start).toFixed(1)}s of dead air at ${start.toFixed(1)}s`,
  }
}

function applyBroll(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  const { start, end, duration } = suggestionWindow(s)
  // Insert a placeholder B-roll segment on V3. The actual asset URL is
  // resolved later by the B-roll picker (stockFootageService); the
  // placeholder reserves the time slot + carries the suggested keyword in
  // its name so the picker has context.
  const newSeg: TimelineSegment = {
    id: genId('broll'),
    startTime: start,
    endTime: end,
    duration,
    type: 'video' as any,
    name: s.description || s.label || 'B-Roll',
    color: '#10b981',
    track: TRACK_BROLL,
  }
  return {
    segments: sortByTime([...ctx.segments, newSeg]),
    textOverlays: ctx.textOverlays,
    changed: true,
    description: `Reserved ${duration.toFixed(1)}s B-roll slot at ${start.toFixed(1)}s`,
  }
}

function applyHook(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  // Hooks live in the first 3 seconds of the video. Add a high-impact
  // text overlay starting at 0:00 that uses the suggestion's copy.
  const text = s.description?.trim() || s.label?.trim() || 'Hook'
  const overlay: TextOverlay = {
    id: genId('hook'),
    text,
    x: 50,
    y: 18,
    fontSize: 56,
    color: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    startTime: 0,
    endTime: Math.min(3, ctx.duration > 0 ? ctx.duration : 3),
    style: 'shadow' as any,
    animationIn: 'slide-up' as any,
    animationOut: 'fade' as any,
    animationInDuration: 0.4,
    animationOutDuration: 0.3,
    layer: 10,
  }
  return {
    segments: ctx.segments,
    textOverlays: [...ctx.textOverlays, overlay],
    changed: true,
    description: `Added hook overlay: "${text.slice(0, 40)}${text.length > 40 ? '…' : ''}"`,
  }
}

function applyTransition(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  const { start, duration } = suggestionWindow(s)
  // Find the segment whose endTime is closest to start (within 0.5s).
  let bestIdx = -1
  let bestDelta = 0.5
  ctx.segments.forEach((seg, i) => {
    const delta = Math.abs(seg.endTime - start)
    if (delta < bestDelta) { bestDelta = delta; bestIdx = i }
  })
  if (bestIdx < 0) {
    return { segments: ctx.segments, textOverlays: ctx.textOverlays, changed: false, description: 'No segment boundary near suggestion time' }
  }
  const next = ctx.segments.map((seg, i) => i === bestIdx
    ? { ...seg, transitionOut: 'crossfade' as any, transitionDuration: Math.min(duration, 0.6) }
    : seg)
  return {
    segments: next,
    textOverlays: ctx.textOverlays,
    changed: true,
    description: `Added crossfade at ${start.toFixed(1)}s`,
  }
}

function applyAudio(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  const { start } = suggestionWindow(s)
  // Enable auto-ducking on the audio segment containing this time, OR if
  // none, on the closest one.
  const idx = ctx.segments.findIndex(seg =>
    (seg.type as string) === 'audio'
    && start >= seg.startTime - 1e-3 && start <= seg.endTime + 1e-3,
  )
  if (idx < 0) {
    return { segments: ctx.segments, textOverlays: ctx.textOverlays, changed: false, description: 'No audio track at this time' }
  }
  const next = ctx.segments.map((seg, i) => i === idx ? { ...seg, audioDucking: true } : seg)
  return {
    segments: next,
    textOverlays: ctx.textOverlays,
    changed: true,
    description: `Enabled audio ducking at ${start.toFixed(1)}s`,
  }
}

function applyEffect(
  s: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  const { start } = suggestionWindow(s)
  // Apply a subtle punch-in transform (scale 1.08) on the segment under
  // this time. This is the most common "effect" suggestion the AI surfaces
  // for retention boosts.
  const idx = ctx.segments.findIndex(seg =>
    start >= seg.startTime - 1e-3 && start <= seg.endTime + 1e-3
    && (seg.type as string) !== 'audio',
  )
  if (idx < 0) {
    return { segments: ctx.segments, textOverlays: ctx.textOverlays, changed: false, description: 'No video segment at this time' }
  }
  const seg = ctx.segments[idx]
  const next = ctx.segments.map((s2, i) => i === idx
    ? {
      ...s2,
      transform: { ...(s2.transform || {}), scale: ((s2.transform?.scale ?? 1) * 1.08) },
    }
    : s2)
  return {
    segments: next,
    textOverlays: ctx.textOverlays,
    changed: true,
    description: `Applied punch-in to "${seg.name}" at ${start.toFixed(1)}s`,
  }
}

/** Per-type dispatcher — single entry point for the editor + hook layer. */
export function applySuggestion(
  suggestion: AIDirectorSuggestion,
  ctx: ApplySuggestionContext,
): ApplySuggestionResult {
  switch (suggestion.type) {
  case 'cut': return applyCut(suggestion, ctx)
  case 'broll': return applyBroll(suggestion, ctx)
  case 'hook': return applyHook(suggestion, ctx)
  case 'transition': return applyTransition(suggestion, ctx)
  case 'audio': return applyAudio(suggestion, ctx)
  case 'effect': return applyEffect(suggestion, ctx)
  default: return { segments: ctx.segments, textOverlays: ctx.textOverlays, changed: false, description: 'Unknown suggestion type' }
  }
}

/**
 * Apply a list of suggestions in sequence, threading state through.
 * Returns a single combined patch — the editor records ONE history
 * entry for the whole batch (so undo reverts the entire "Apply All").
 */
export function applyAllSuggestions(
  suggestions: AIDirectorSuggestion[],
  ctx: ApplySuggestionContext,
): ApplySuggestionResult & { applied: string[]; skipped: string[] } {
  let acc = { ...ctx }
  const applied: string[] = []
  const skipped: string[] = []
  for (const s of suggestions) {
    const r = applySuggestion(s, acc)
    if (r.changed) { applied.push(s.id) ; acc = { ...acc, segments: r.segments, textOverlays: r.textOverlays } }
    else skipped.push(s.id)
  }
  return {
    segments: acc.segments,
    textOverlays: acc.textOverlays,
    changed: applied.length > 0,
    description: applied.length > 0
      ? `Applied ${applied.length} suggestion${applied.length === 1 ? '' : 's'}${skipped.length ? ` (${skipped.length} skipped)` : ''}`
      : 'Nothing applied',
    applied,
    skipped,
  }
}
