import { realignCaptionsToSpeech, realignOverlaysToSpeech } from '../captionAlign'

const words = [
  { start: 0.0, end: 0.4 }, // "Hey"
  { start: 0.45, end: 0.9 }, // "there"
  { start: 1.0, end: 1.5 }, // "folks"
  { start: 2.0, end: 2.4 }, // "welcome"
  { start: 2.45, end: 2.9 }, // "back"
]

describe('realignCaptionsToSpeech', () => {
  it('snaps a drifted caption to the words it covers', () => {
    const captions = [{ id: 1, start: 0.12, end: 0.78, text: 'Hey there' }]
    const { segments, changed } = realignCaptionsToSpeech(captions, words, { readingCps: 0 })
    expect(changed).toBe(1)
    expect(segments[0].start).toBeCloseTo(0.0) // first covered word start
    expect(segments[0].end).toBeCloseTo(0.9) // last covered word end
  })

  it('is idempotent — a second pass does not move an aligned caption', () => {
    const captions = [{ id: 1, start: 0.12, end: 0.78, text: 'Hey there' }]
    const first = realignCaptionsToSpeech(captions, words, { readingCps: 0 })
    const second = realignCaptionsToSpeech(first.segments, words, { readingCps: 0 })
    expect(second.changed).toBe(0)
    expect(second.segments[0].start).toBeCloseTo(first.segments[0].start)
    expect(second.segments[0].end).toBeCloseTo(first.segments[0].end)
  })

  it('enforces the reading-speed floor for short speech spans', () => {
    // 1 very short word but long text → caption must be extended for readability.
    const oneWord = [{ start: 1.0, end: 1.1 }]
    const captions = [{ id: 1, start: 1.0, end: 1.1, text: 'A fairly long sentence to read' }]
    const { segments } = realignCaptionsToSpeech(captions, oneWord, { readingCps: 18, maxSnapDistance: 0 })
    const dur = segments[0].end - segments[0].start
    expect(dur).toBeGreaterThanOrEqual(30 / 18 - 0.01) // 30 chars / 18 cps
  })

  it('prevents overlap between consecutive captions', () => {
    const captions = [
      { id: 1, start: 0.0, end: 1.4, text: 'Hey there folks' },
      { id: 2, start: 1.2, end: 2.9, text: 'welcome back' }, // overlaps caption 1 input
    ]
    const { segments } = realignCaptionsToSpeech(captions, words, { readingCps: 0 })
    expect(segments[1].start).toBeGreaterThanOrEqual(segments[0].end - 1e-6)
  })

  it('respects maxSnapDistance — does not yank a caption far across the timeline', () => {
    // caption sits in a gap far from any word; with a tight max distance it stays put
    const captions = [{ id: 1, start: 10.0, end: 10.5, text: 'orphan' }]
    const { segments, changed } = realignCaptionsToSpeech(captions, words, {
      readingCps: 0,
      maxSnapDistance: 0.5,
      preventOverlap: false,
    })
    expect(segments[0].start).toBeCloseTo(10.0)
    expect(changed).toBe(0)
  })

  it('returns input unchanged when there are no words', () => {
    const captions = [{ id: 1, start: 0.1, end: 0.8, text: 'x' }]
    expect(realignCaptionsToSpeech(captions, []).changed).toBe(0)
  })

  it('gives CJK captions more on-screen time than Latin of equal char count', () => {
    // Same length (18 chars), same tiny speech span — the reading floor should
    // extend the Chinese caption ~2x longer than the English one (denser script).
    const word = [{ start: 1.0, end: 1.1 }]
    const cjk = '字'.repeat(18)
    const latin = 'a'.repeat(18)
    const cjkDur = (() => {
      const { segments } = realignCaptionsToSpeech([{ start: 1.0, end: 1.1, text: cjk }], word, { maxSnapDistance: 0 })
      return segments[0].end - segments[0].start
    })()
    const latinDur = (() => {
      const { segments } = realignCaptionsToSpeech([{ start: 1.0, end: 1.1, text: latin }], word, { maxSnapDistance: 0 })
      return segments[0].end - segments[0].start
    })()
    expect(cjkDur).toBeCloseTo(18 / 9, 1) // ~2.0s
    expect(latinDur).toBeCloseTo(18 / 18, 1) // ~1.0s
    expect(cjkDur).toBeGreaterThan(latinDur + 0.5)
  })

  it('handles a Chinese transcript end-to-end (snaps + readable, idempotent)', () => {
    const zhWords = [
      { start: 0.0, end: 0.5 },
      { start: 0.5, end: 1.0 },
      { start: 1.0, end: 1.6 },
    ]
    const caps = [{ id: 1, start: 0.1, end: 0.6, text: '投资理财收益' }]
    const first = realignCaptionsToSpeech(caps, zhWords)
    expect(first.segments[0].start).toBeCloseTo(0.0)
    const second = realignCaptionsToSpeech(first.segments, zhWords)
    expect(second.changed).toBe(0) // idempotent for non-Latin too
  })

  it('handles out-of-order captions by re-timing chronologically', () => {
    const captions = [
      { id: 2, start: 2.1, end: 2.8, text: 'welcome back' },
      { id: 1, start: 0.1, end: 0.8, text: 'Hey there' },
    ]
    const { segments } = realignCaptionsToSpeech(captions, words, { readingCps: 0 })
    // original index 1 (the early caption) snaps to the first words
    expect(segments[1].start).toBeCloseTo(0.0)
  })
})

describe('realignOverlaysToSpeech', () => {
  it('maps startTime/endTime and preserves other overlay fields', () => {
    const overlays = [{ id: 'a', startTime: 0.12, endTime: 0.78, text: 'Hey there', color: '#fff' }]
    const { overlays: out, changed } = realignOverlaysToSpeech(overlays, words, { readingCps: 0 })
    expect(changed).toBe(1)
    expect(out[0].startTime).toBeCloseTo(0.0)
    expect(out[0].endTime).toBeCloseTo(0.9)
    expect(out[0].color).toBe('#fff') // untouched
    expect(out[0].id).toBe('a')
  })
})
