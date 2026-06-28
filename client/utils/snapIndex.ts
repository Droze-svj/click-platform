/**
 * snapIndex.ts — a precomputed, sorted snap-stop index for the editor timeline.
 *
 * Why this exists: the legacy `snapToNearestEdge` (editorUtils) re-allocated a
 * Set and re-sorted its ENTIRE edge list on every call — i.e. twice per
 * animation frame while a clip/caption is dragged. On a caption-dense timeline
 * (hundreds–thousands of Whisper word boundaries) that O(n·log n)-per-frame cost
 * is the dominant timeline bottleneck.
 *
 * A SnapIndex is built ONCE (sorted + de-duped) whenever the underlying stops
 * change, then queried per frame with a binary search — O(log n) per query with
 * zero per-call allocation. Each stop is tagged with a `kind`, so the magnet can
 * prefer real speech boundaries ("snap to speech") over a bare grid/edge, and so
 * the UI can label the active snap (word / silence / edge …).
 */

export type SnapKind = 'boundary' | 'edge' | 'marker' | 'beat' | 'silence' | 'word' | 'playhead'

/** Higher wins when two stops tie within the magnet threshold. */
const KIND_PRIORITY: Record<SnapKind, number> = {
  word: 6,
  silence: 5,
  marker: 4,
  edge: 3,
  beat: 2,
  playhead: 1,
  boundary: 0,
}

export interface SnapIndex {
  /** Stop times in seconds, ascending, de-duped. */
  readonly times: number[]
  /** Parallel to `times`; the highest-priority kind at each stop. */
  readonly kinds: SnapKind[]
  readonly length: number
}

export interface SnapResult {
  /** The snapped time, or the original input when nothing was within threshold. */
  time: number
  /** True when the input snapped to a stop. */
  snapped: boolean
  /** The stop time that was snapped to (only meaningful when `snapped`). */
  stop: number
  /** The kind of the snapped stop (only meaningful when `snapped`). */
  kind: SnapKind | null
  /** Absolute distance from input to the chosen stop (Infinity when not snapped). */
  distance: number
}

export interface BuildSnapIndexInput {
  /** Clip/effect/segment boundaries. */
  edges?: number[]
  /** Whisper word boundaries (word start & end times). */
  words?: number[]
  /** Silence-gap boundaries. */
  silences?: number[]
  /** Music beat times. */
  beats?: number[]
  /** Timeline marker times. */
  markers?: number[]
  /** Current playhead time. */
  playhead?: number
  /** Total timeline duration (adds 0 and duration as boundary stops). */
  duration?: number
}

const DEDUPE_EPS = 1e-4
/** Stops this close to an excluded value are treated as the excluded value. */
const EXCLUDE_EPS = 0.01

export const EMPTY_SNAP_INDEX: SnapIndex = { times: [], kinds: [], length: 0 }

/**
 * Build a sorted, de-duped snap index from the supplied stop sources. Call this
 * inside a memo keyed on the sources — NOT once per frame.
 */
export function buildSnapIndex(input: BuildSnapIndexInput): SnapIndex {
  const raw: { t: number; kind: SnapKind }[] = []
  const push = (arr: number[] | undefined, kind: SnapKind) => {
    if (!arr) return
    for (const t of arr) {
      if (typeof t === 'number' && isFinite(t) && t >= 0) raw.push({ t, kind })
    }
  }

  raw.push({ t: 0, kind: 'boundary' })
  if (input.duration != null && isFinite(input.duration) && input.duration > 0) {
    raw.push({ t: input.duration, kind: 'boundary' })
  }
  push(input.edges, 'edge')
  push(input.markers, 'marker')
  push(input.beats, 'beat')
  push(input.silences, 'silence')
  push(input.words, 'word')
  if (input.playhead != null && isFinite(input.playhead) && input.playhead >= 0) {
    raw.push({ t: input.playhead, kind: 'playhead' })
  }

  if (raw.length === 0) return EMPTY_SNAP_INDEX

  raw.sort((a, b) => a.t - b.t)

  const times: number[] = []
  const kinds: SnapKind[] = []
  for (const { t, kind } of raw) {
    const last = times.length - 1
    if (last >= 0 && t - times[last] <= DEDUPE_EPS) {
      // Collision: keep the higher-priority kind at this position.
      if (KIND_PRIORITY[kind] > KIND_PRIORITY[kinds[last]]) kinds[last] = kind
      continue
    }
    times.push(t)
    kinds.push(kind)
  }
  return { times, kinds, length: times.length }
}

export interface SnapQueryOptions {
  /** Stop times to ignore (e.g. the dragged clip's own edges so it can't snap to itself). */
  exclude?: number[]
  /** When any in-threshold stop matches these kinds, prefer the nearest such stop. */
  preferKinds?: SnapKind[]
}

/** Lower-bound binary search: index of the first element >= value. */
function lowerBound(times: number[], value: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

function isExcluded(t: number, exclude?: number[]): boolean {
  if (!exclude) return false
  for (const e of exclude) {
    if (Math.abs(t - e) <= EXCLUDE_EPS) return true
  }
  return false
}

/**
 * Snap `time` to the nearest stop in `index` within `thresholdSeconds`.
 *
 * O(log n): a binary search to the insertion point, then a short outward scan
 * bounded by the threshold (only stops within the magnet window are touched).
 * Returns the original time (snapped=false) when no stop is in range. When
 * `preferKinds` is given and any in-window stop matches, the nearest matching
 * stop wins even if a different kind sits marginally closer — this is what makes
 * captions feel "locked to speech".
 */
export function snapWithIndex(
  time: number,
  index: SnapIndex,
  thresholdSeconds: number,
  options?: SnapQueryOptions,
): SnapResult {
  const { times, kinds, length } = index
  if (length === 0 || !(thresholdSeconds > 0)) {
    return { time, snapped: false, stop: 0, kind: null, distance: Infinity }
  }
  const exclude = options?.exclude
  const preferKinds = options?.preferKinds

  let bestIdx = -1
  let bestDist = Infinity
  let bestPrefIdx = -1
  let bestPrefDist = Infinity

  const consider = (i: number) => {
    const t = times[i]
    if (isExcluded(t, exclude)) return
    const d = Math.abs(time - t)
    if (d > thresholdSeconds) return
    if (d < bestDist) { bestDist = d; bestIdx = i }
    if (preferKinds && preferKinds.indexOf(kinds[i]) !== -1 && d < bestPrefDist) {
      bestPrefDist = d; bestPrefIdx = i
    }
  }

  const start = lowerBound(times, time)
  for (let i = start; i < length && times[i] - time <= thresholdSeconds; i++) consider(i)
  for (let i = start - 1; i >= 0 && time - times[i] <= thresholdSeconds; i--) consider(i)

  const chosen = bestPrefIdx >= 0 ? bestPrefIdx : bestIdx
  if (chosen < 0) return { time, snapped: false, stop: 0, kind: null, distance: Infinity }
  return {
    time: times[chosen],
    snapped: true,
    stop: times[chosen],
    kind: kinds[chosen],
    distance: Math.abs(time - times[chosen]),
  }
}

/** Kinds that represent real spoken-audio boundaries — the default magnet preference. */
export const SPEECH_KINDS: SnapKind[] = ['word', 'silence']

/**
 * Derive word and silence snap stops from Whisper word timings.
 * `words` flattens every word's start & end; `silences` marks the edges of any
 * inter-word gap longer than `minSilenceGap` (a natural pause to cut/clip on).
 */
export function speechStopsFromWords(
  words: { start: number; end: number }[] | undefined | null,
  minSilenceGap = 0.35,
): { words: number[]; silences: number[] } {
  if (!words || words.length === 0) return { words: [], silences: [] }
  // Sort by start so silence-gap detection is correct even on an unsorted transcript.
  const sorted = words
    .filter((w) => isFinite(w.start) && isFinite(w.end))
    .slice()
    .sort((a, b) => a.start - b.start)
  const wordStops: number[] = []
  const silences: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i]
    wordStops.push(w.start, w.end)
    if (i > 0) {
      const gap = w.start - sorted[i - 1].end
      if (gap > minSilenceGap) { silences.push(sorted[i - 1].end, w.start) }
    }
  }
  return { words: wordStops, silences }
}
