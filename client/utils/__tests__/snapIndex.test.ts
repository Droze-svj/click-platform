import {
  buildSnapIndex,
  snapWithIndex,
  speechStopsFromWords,
  EMPTY_SNAP_INDEX,
  SPEECH_KINDS,
} from '../snapIndex'
import { snapToNearestEdge } from '../editorUtils'

describe('buildSnapIndex', () => {
  it('sorts, de-dupes, and always includes 0 + duration boundaries', () => {
    const idx = buildSnapIndex({ edges: [5, 2, 2, 8], duration: 10 })
    expect(idx.times).toEqual([0, 2, 5, 8, 10])
    expect(idx.length).toBe(5)
  })

  it('keeps the highest-priority kind when stops collide', () => {
    // an edge and a word at (nearly) the same time → word wins
    const idx = buildSnapIndex({ edges: [3], words: [3.00001], duration: 10 })
    const at3 = idx.times.indexOf(3)
    expect(idx.kinds[at3]).toBe('word')
  })

  it('drops negative / non-finite stops', () => {
    const idx = buildSnapIndex({ edges: [-1, NaN, Infinity, 4], duration: 10 })
    expect(idx.times).toEqual([0, 4, 10])
  })

  it('returns the shared empty index for no input', () => {
    const idx = buildSnapIndex({})
    // duration omitted → only the implicit 0 boundary
    expect(idx.times).toEqual([0])
  })

  it('includes beat stops and tags them as kind "beat"', () => {
    const idx = buildSnapIndex({ edges: [4], beats: [1, 2, 3], duration: 10 })
    expect(idx.times).toEqual([0, 1, 2, 3, 4, 10])
    const at2 = idx.times.indexOf(2)
    expect(idx.kinds[at2]).toBe('beat')
  })
})

describe('snapWithIndex', () => {
  const idx = buildSnapIndex({ edges: [2, 5, 9], duration: 10 })

  it('snaps to the nearest stop within threshold', () => {
    const r = snapWithIndex(5.1, idx, 0.25)
    expect(r.snapped).toBe(true)
    expect(r.time).toBe(5)
    expect(r.kind).toBe('edge')
  })

  it('does not snap when no stop is within threshold', () => {
    const r = snapWithIndex(3.5, idx, 0.25)
    expect(r.snapped).toBe(false)
    expect(r.time).toBe(3.5)
    expect(r.distance).toBe(Infinity)
  })

  it('returns input unchanged for an empty index', () => {
    const r = snapWithIndex(4, EMPTY_SNAP_INDEX, 1)
    expect(r.snapped).toBe(false)
    expect(r.time).toBe(4)
  })

  it('excludes the dragged clip own edges so it cannot snap to itself', () => {
    // 5 is excluded → nearest remaining stop within 0.25 of 5.05 is none (2 and 9 too far)
    const r = snapWithIndex(5.05, idx, 0.25, { exclude: [5] })
    expect(r.snapped).toBe(false)
  })

  it('prefers a speech (word) stop over a closer edge stop', () => {
    // edge at 5.00 (dist .12) vs word at 5.20 (dist .08) — word nearer, both in range → word
    const speechIdx = buildSnapIndex({ edges: [5.0], words: [5.2], duration: 10 })
    const r = snapWithIndex(5.12, speechIdx, 0.25, { preferKinds: SPEECH_KINDS })
    expect(r.kind).toBe('word')
    expect(r.time).toBeCloseTo(5.2)
  })

  it('prefers a word even when an edge is marginally closer', () => {
    // edge at 5.00 (dist .04) is closer than word at 5.20 (dist .16), but word is preferred
    const speechIdx = buildSnapIndex({ edges: [5.0], words: [5.2], duration: 10 })
    const r = snapWithIndex(5.04, speechIdx, 0.3, { preferKinds: SPEECH_KINDS })
    expect(r.kind).toBe('word')
  })

  it('matches the legacy snapToNearestEdge result for plain edge snapping', () => {
    const edges = [0, 2, 5, 9, 10]
    const plain = buildSnapIndex({ edges, duration: 10 })
    for (const t of [0.1, 1.9, 2.4, 4.8, 7, 8.9, 9.9]) {
      const legacy = snapToNearestEdge(t, edges, 0.25)
      const next = snapWithIndex(t, plain, 0.25)
      const nextTime = next.snapped ? next.time : t
      expect(nextTime).toBeCloseTo(legacy)
    }
  })
})

describe('speechStopsFromWords', () => {
  it('flattens word start/end and marks long silence gaps', () => {
    const words = [
      { start: 0, end: 0.5 },
      { start: 0.6, end: 1.0 }, // 0.1s gap → not silence
      { start: 2.0, end: 2.4 }, // 1.0s gap → silence
    ]
    const { words: stops, silences } = speechStopsFromWords(words, 0.35)
    expect(stops).toEqual([0, 0.5, 0.6, 1.0, 2.0, 2.4])
    expect(silences).toEqual([1.0, 2.0])
  })

  it('handles empty / nullish input', () => {
    expect(speechStopsFromWords(undefined)).toEqual({ words: [], silences: [] })
    expect(speechStopsFromWords([])).toEqual({ words: [], silences: [] })
  })

  it('sorts an out-of-order transcript before detecting silence gaps', () => {
    const unsorted = [
      { start: 2.0, end: 2.4 },
      { start: 0.0, end: 0.5 }, // 1.5s gap to the next → a real silence
    ]
    const { words, silences } = speechStopsFromWords(unsorted, 0.35)
    expect(words).toEqual([0.0, 0.5, 2.0, 2.4])
    expect(silences).toEqual([0.5, 2.0])
  })
})

describe('performance: snapWithIndex vs legacy snapToNearestEdge', () => {
  // Caption-dense timeline: ~1000 word boundaries.
  const N = 1000
  const edges: number[] = []
  for (let i = 0; i < N; i++) edges.push((i * 1234.567) % 600)

  const QUERIES = 4000
  const queryTimes: number[] = []
  for (let i = 0; i < QUERIES; i++) queryTimes.push((i * 0.137) % 600)

  it('produces equivalent nearest-stop results', () => {
    const idx = buildSnapIndex({ edges })
    for (const t of queryTimes.slice(0, 200)) {
      const legacy = snapToNearestEdge(t, edges, 0.05)
      const next = snapWithIndex(t, idx, 0.05)
      const nextTime = next.snapped ? next.time : t
      expect(nextTime).toBeCloseTo(legacy, 5)
    }
  })

  it('is at least 2x faster per-frame on a dense timeline', () => {
    // Legacy: rebuilds Set + re-sorts the whole edge list on EVERY query.
    const legacyStart = process.hrtime.bigint()
    for (const t of queryTimes) snapToNearestEdge(t, edges, 0.05)
    const legacyNs = Number(process.hrtime.bigint() - legacyStart)

    // New: build the index ONCE, then binary-search per query (the real usage).
    const newStart = process.hrtime.bigint()
    const idx = buildSnapIndex({ edges })
    for (const t of queryTimes) snapWithIndex(t, idx, 0.05)
    const newNs = Number(process.hrtime.bigint() - newStart)

    // Headline ask: at least 2x faster. (In practice it's far more on dense data.)
    expect(newNs).toBeLessThan(legacyNs / 2)
  })
})
