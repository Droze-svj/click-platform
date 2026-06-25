// Auto Viral Edit — the one-click catalyst. PURE planner that fuses everything
// Click's creative engine can do into a single edit:
//   1. beat-synced cuts (re-segment the source on the music's beats)
//   2. varied, high-energy transitions on every cut (no two-in-a-row repeats)
//   3. word-by-word (karaoke) captions with auto keyword-highlight + auto-emoji
//      + a viral caption preset
//
// It is intentionally side-effect-free: the editor handler fetches beats +
// captions (reusing the existing endpoints) and feeds them here; this returns
// the new segments + overlays + an honest summary of what it actually did. That
// keeps the catalyst unit-testable end-to-end without a browser or network.

import type { TimelineSegment, TextOverlay, SegmentTransitionType, CaptionPreset } from '../types/editor'
import { buildBeatCutPlan, planToSegments, type BeatCutPlan } from './beatCuts'
import { pickHighlightWords, pickCaptionEmoji, DEFAULT_HIGHLIGHT_COLOR } from './captions'

/**
 * The curated high-energy transition rotation. Each is a valid SegmentTransitionType
 * that the render engine resolves to a real xfade (zoom→pixelize, whip→slide,
 * flash→fadewhite, dip→fadeblack, crossfade→fade). We rotate so cuts never feel
 * mechanical — the hallmark of a hand-made viral edit.
 */
export const VIRAL_TRANSITION_CYCLE: SegmentTransitionType[] = [
  'zoom', 'whip-left', 'flash', 'whip-right', 'dip', 'crossfade',
]

export interface AutoViralEditInput {
  /** Beat onset timestamps (seconds) from the beats endpoint. */
  beats: number[]
  /** Total source duration (seconds). */
  duration: number
  /** Caption rows from the auto-caption endpoint ({text,startTime,endTime}). Optional. */
  captions?: Array<{ text?: string; startTime?: number; endTime?: number }>
  /** Word-level timings from the transcript, for karaoke sync. Optional. */
  words?: Array<{ word?: string; text?: string; start?: number; end?: number }>
  /** Source media URL for the re-cut video segments. */
  sourceUrl?: string
  /** Caption look (defaults to the punchy 'hook' preset). */
  captionPreset?: CaptionPreset
  /** Accent colour for highlighted keywords. */
  highlightColor?: string
  /** Transition length in seconds (default 0.35 — fast, punchy). */
  transitionDuration?: number
  /** Beat-cut tuning (passed through to buildBeatCutPlan). */
  minClip?: number
  maxClip?: number
  everyNthBeat?: number
}

export interface AutoViralEditResult {
  /** Re-cut, transition-laden video segments (replace the timeline's video clips). */
  segments: TimelineSegment[]
  /** Karaoke caption overlays (append to the timeline's text overlays). */
  overlays: TextOverlay[]
  /** What actually happened, for an honest toast. */
  summary: {
    clips: number
    transitions: number
    captions: number
    didCut: boolean
    didCaption: boolean
    /** Human-readable reasons a step was skipped (e.g. no beats / no transcript). */
    notes: string[]
  }
}

/**
 * Assign a varied transition to every segment but the last, walking
 * VIRAL_TRANSITION_CYCLE so no two adjacent cuts share a transition. Pure: returns
 * new segment objects, never mutates the input.
 */
export function applyViralTransitions(
  segments: TimelineSegment[],
  opts: { cycle?: SegmentTransitionType[]; transitionDuration?: number } = {},
): TimelineSegment[] {
  const cycle = (opts.cycle && opts.cycle.length ? opts.cycle : VIRAL_TRANSITION_CYCLE)
  const dur = Number(opts.transitionDuration) > 0 ? Number(opts.transitionDuration) : 0.35
  const segs = Array.isArray(segments) ? segments : []
  return segs.map((s, i) => {
    // The last clip has nothing to transition INTO — leave it clean.
    if (i >= segs.length - 1) {
      const { transitionOut, transitionDuration, ...rest } = s as any
      return { ...rest } as TimelineSegment
    }
    return { ...s, transitionOut: cycle[i % cycle.length], transitionDuration: dur }
  })
}

/**
 * Build karaoke caption overlays from caption rows + word timings. Each overlay:
 * word-by-word mode, auto keyword-highlight, auto-emoji, viral preset. Words are
 * matched to each caption's window (with a small slop). Pure.
 */
export function buildViralCaptions(
  captions: Array<{ text?: string; startTime?: number; endTime?: number }>,
  words: Array<{ word?: string; text?: string; start?: number; end?: number }>,
  opts: { captionPreset?: CaptionPreset; highlightColor?: string; idPrefix?: string } = {},
): TextOverlay[] {
  const preset: CaptionPreset = opts.captionPreset || 'hook'
  const accent = opts.highlightColor || DEFAULT_HIGHLIGHT_COLOR
  const prefix = opts.idPrefix || 'viral-cap'
  const caps = Array.isArray(captions) ? captions : []
  const allWords = Array.isArray(words) ? words : []

  const wordsFor = (s: number, e: number) => allWords
    .filter((w) => w && Number(w.start) >= s - 0.05 && Number(w.end) <= e + 0.05)
    .map((w) => ({ word: w.text || w.word || '', start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end))

  const out: TextOverlay[] = []
  caps.forEach((c, i) => {
    const text = String(c.text || '').trim()
    const start = Number(c.startTime)
    const end = Number(c.endTime)
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return
    const w = wordsFor(start, end)
    out.push({
      id: `${prefix}-${i}-${Math.round(start * 1000)}`,
      text,
      startTime: start,
      endTime: end,
      x: 50,
      y: 82,
      fontSize: 40,
      color: '#FFFFFF',
      fontFamily: 'Inter',
      style: 'bold-kinetic',
      animationIn: 'fade',
      animationOut: 'fade',
      captionPreset: preset,
      // Karaoke only when we actually have word timings; otherwise a clean block.
      captionMode: w.length ? 'word' : 'block',
      words: w,
      safeZone: true,
      highlightWords: pickHighlightWords(text, 2),
      highlightColor: accent,
      emoji: pickCaptionEmoji(text),
    })
  })
  return out
}

/**
 * The full one-click plan. Combines a beat-cut, varied transitions, and karaoke
 * captions. Every stage degrades honestly: no beats → no re-cut (notes say so);
 * no transcript → no captions (notes say so). Never throws on empty input.
 */
export function planAutoViralEdit(input: AutoViralEditInput): AutoViralEditResult {
  const notes: string[] = []
  const duration = Number(input.duration) || 0

  // 1) Beat-cut → segments.
  let segments: TimelineSegment[] = []
  let plan: BeatCutPlan = { segments: [], cutPoints: [], count: 0 }
  const beats = Array.isArray(input.beats) ? input.beats : []
  if (beats.length && duration > 0) {
    plan = buildBeatCutPlan(beats, {
      duration,
      minClip: input.minClip ?? 0.6,
      maxClip: input.maxClip ?? 4,
      everyNthBeat: input.everyNthBeat ?? 2,
    })
  }
  const didCut = plan.count >= 2
  if (didCut) {
    const raw = planToSegments(plan, { sourceUrl: input.sourceUrl, idPrefix: 'viralcut' })
    // 2) Varied transitions on every cut.
    segments = applyViralTransitions(raw, { transitionDuration: input.transitionDuration })
  } else if (beats.length) {
    notes.push('Not enough beats for a clean re-cut — kept your timeline, added captions only.')
  } else {
    notes.push('No music beats detected — kept your timeline, added captions only.')
  }
  const transitions = segments.filter((s) => s.transitionOut && s.transitionOut !== 'none').length

  // 3) Karaoke captions.
  const captions = Array.isArray(input.captions) ? input.captions : []
  const overlays = buildViralCaptions(captions, input.words || [], {
    captionPreset: input.captionPreset,
    highlightColor: input.highlightColor,
  })
  const didCaption = overlays.length > 0
  if (!didCaption) {
    notes.push(captions.length
      ? 'Captions had no usable timing — skipped to avoid bad sync.'
      : 'No transcript available — add a transcript to auto-caption.')
  }

  return {
    segments,
    overlays,
    summary: {
      clips: segments.length,
      transitions,
      captions: overlays.length,
      didCut,
      didCaption,
      notes,
    },
  }
}
