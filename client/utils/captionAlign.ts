/**
 * captionAlign.ts — re-time an ENTIRE caption track to Whisper speech in one pass.
 *
 * Competitive wedge: VEED's "Snap to Speech" and CapCut's per-word editing only
 * fix one line at a time. The single most common auto-caption complaint is that
 * the whole track drifts out of sync. `realignCaptionsToSpeech` re-anchors every
 * caption to the actual spoken words at once — the kind of one-click fix none of
 * the competitors ship.
 *
 * Pure + idempotent: re-running on an already-aligned track returns the same
 * times (within rounding), so it is safe to wire to a button and undo/redo.
 */

export interface AlignableCaption {
  /** Caption start time in seconds. */
  start: number
  /** Caption end time in seconds. */
  end: number
  /** Caption text (used for the reading-speed floor; optional). */
  text?: string
}

export interface SpeechWord {
  start: number
  end: number
}

export interface RealignOptions {
  /** Hard floor on a caption's on-screen duration (seconds). Default 0.3. */
  minDuration?: number
  /** Reading speed (chars/sec). Short captions are extended so they stay long
   *  enough to read, never overlapping the next one. Default 18. 0 disables. */
  readingCps?: number
  /** Never move a boundary further than this many seconds (guards against a bad
   *  transcript yanking a caption across the timeline). Default 1.2. 0 = unlimited. */
  maxSnapDistance?: number
  /** Keep captions monotonic & non-overlapping. Default true. */
  preventOverlap?: boolean
}

export interface RealignResult<T> {
  /** New caption array (same shape + extra fields preserved); inputs are not mutated. */
  segments: T[]
  /** How many captions actually moved. */
  changed: number
}

const EPS = 1e-3
const DEFAULTS: Required<RealignOptions> = {
  minDuration: 0.3,
  readingCps: 18,
  maxSnapDistance: 1.2,
  preventOverlap: true,
}

/** Round to milliseconds so repeated runs are stable (idempotent). */
const ms = (t: number) => Math.round(t * 1000) / 1000

// CJK (Han / Kana / Hangul) characters each carry ~a word of meaning and read
// slower per glyph, so they need more on-screen time than Latin characters.
const CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF66-\uFF9D]/g
const CJK_CPS = 9

/**
 * Minimum seconds a caption needs to be readable, script-aware: CJK glyphs are
 * counted at a slower chars-per-second than Latin so non-English subtitles aren't
 * timed as if they were a–z. `baseCps` (default 18) applies to non-CJK characters.
 */
function readingSeconds(text: string, baseCps: number): number {
  if (!text || baseCps <= 0) return 0
  const t = text.trim()
  // Count by codepoint (incl. internal spaces, per CPS convention); CJK glyphs
  // are billed at the slower CJK rate, everything else at baseCps.
  const total = Array.from(t).length
  const cjk = (t.match(CJK_RE) || []).length
  const other = Math.max(0, total - cjk)
  return cjk / CJK_CPS + other / baseCps
}

/** Nearest value in a sorted ascending array (linear-bounded binary search). */
function nearest(sorted: number[], value: number): number {
  if (sorted.length === 0) return value
  let lo = 0
  let hi = sorted.length - 1
  if (value <= sorted[0]) return sorted[0]
  if (value >= sorted[hi]) return sorted[hi]
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] === value) return sorted[mid]
    if (sorted[mid] < value) lo = mid + 1
    else hi = mid - 1
  }
  // lo is the first element > value; hi is the last < value.
  const a = sorted[hi]
  const b = sorted[lo]
  return Math.abs(value - a) <= Math.abs(value - b) ? a : b
}

/**
 * Re-anchor each caption to the spoken words it covers:
 *  - find the words overlapping the caption → snap start to the first word's
 *    start and end to the last word's end (true speech alignment);
 *  - if a caption overlaps no words (e.g. a gap), snap each edge to the nearest
 *    word boundary instead;
 *  - enforce min duration, a reading-speed floor, a max snap distance, and
 *    (optionally) non-overlap with the previous caption.
 */
export function realignCaptionsToSpeech<T extends AlignableCaption>(
  segments: T[],
  words: SpeechWord[],
  opts?: RealignOptions,
): RealignResult<T> {
  const o = { ...DEFAULTS, ...(opts || {}) }
  if (!segments || segments.length === 0) return { segments: segments ?? [], changed: 0 }
  if (!words || words.length === 0) return { segments, changed: 0 }

  const sortedWords = [...words]
    .filter((w) => isFinite(w.start) && isFinite(w.end) && w.end >= w.start)
    .sort((a, b) => a.start - b.start)
  if (sortedWords.length === 0) return { segments, changed: 0 }

  // All word boundaries (starts & ends), sorted, for the no-overlap fallback.
  const boundaries = Array.from(
    new Set(sortedWords.flatMap((w) => [w.start, w.end])),
  ).sort((a, b) => a - b)

  // Process in chronological order so the non-overlap clamp uses the prior result.
  const order = segments.map((_, i) => i).sort((a, b) => segments[a].start - segments[b].start)

  const next = segments.slice()
  let changed = 0
  let prevEnd = -Infinity

  for (const i of order) {
    const seg = segments[i]
    const covering = sortedWords.filter((w) => w.end > seg.start + EPS && w.start < seg.end - EPS)

    let newStart: number
    let newEnd: number
    if (covering.length > 0) {
      newStart = covering[0].start
      newEnd = covering[covering.length - 1].end
    } else {
      newStart = nearest(boundaries, seg.start)
      newEnd = nearest(boundaries, seg.end)
    }

    // Respect the max snap distance per edge (keep the original edge if the
    // proposed move is implausibly large).
    if (o.maxSnapDistance > 0) {
      if (Math.abs(newStart - seg.start) > o.maxSnapDistance) newStart = seg.start
      if (Math.abs(newEnd - seg.end) > o.maxSnapDistance) newEnd = seg.end
    }

    // Reading-speed + minimum-duration floor (script-aware for CJK vs Latin).
    const needed = Math.max(
      o.minDuration,
      o.readingCps > 0 && seg.text ? readingSeconds(seg.text, o.readingCps) : 0,
    )
    if (newEnd - newStart < needed) newEnd = newStart + needed

    // Non-overlap with the previous (chronological) caption.
    if (o.preventOverlap && newStart < prevEnd) {
      newStart = prevEnd
      if (newEnd - newStart < o.minDuration) newEnd = newStart + o.minDuration
    }

    newStart = ms(Math.max(0, newStart))
    newEnd = ms(Math.max(newStart + o.minDuration, newEnd))
    prevEnd = newEnd

    if (Math.abs(newStart - seg.start) > EPS || Math.abs(newEnd - seg.end) > EPS) changed++
    next[i] = { ...seg, start: newStart, end: newEnd }
  }

  return { segments: next, changed }
}

/**
 * Adapter for the editor's TextOverlay shape, which uses `startTime`/`endTime`
 * instead of `start`/`end`. Returns overlays with re-timed bounds and the count.
 */
export function realignOverlaysToSpeech<
  T extends { startTime: number; endTime: number; text?: string },
>(overlays: T[], words: SpeechWord[], opts?: RealignOptions): { overlays: T[]; changed: number } {
  const proxied = overlays.map((o) => ({ start: o.startTime, end: o.endTime, text: o.text }))
  const { segments, changed } = realignCaptionsToSpeech(proxied, words, opts)
  const out = overlays.map((o, i) => ({ ...o, startTime: segments[i].start, endTime: segments[i].end }))
  return { overlays: out, changed }
}
