import {
  applyViralTransitions,
  buildViralCaptions,
  planAutoViralEdit,
  VIRAL_TRANSITION_CYCLE,
} from '../autoViralEdit'
import type { TimelineSegment } from '../../types/editor'

function vid(i: number): TimelineSegment {
  return {
    id: `s${i}`, startTime: i, endTime: i + 1, duration: 1, type: 'video',
    name: `c${i}`, color: '#000', track: 0,
  } as TimelineSegment
}

describe('applyViralTransitions', () => {
  it('puts a transition on every segment but the last', () => {
    const out = applyViralTransitions([vid(0), vid(1), vid(2)])
    expect(out[0].transitionOut).toBeTruthy()
    expect(out[1].transitionOut).toBeTruthy()
    expect(out[2].transitionOut).toBeUndefined() // last clip stays clean
  })

  it('never repeats the same transition on adjacent cuts', () => {
    const out = applyViralTransitions(Array.from({ length: 6 }, (_, i) => vid(i)))
    for (let i = 1; i < out.length - 1; i++) {
      expect(out[i].transitionOut).not.toBe(out[i - 1].transitionOut)
    }
  })

  it('only uses transitions the render engine understands (no invalid names)', () => {
    const out = applyViralTransitions(Array.from({ length: 6 }, (_, i) => vid(i)))
    out.slice(0, -1).forEach((s) => {
      expect(VIRAL_TRANSITION_CYCLE).toContain(s.transitionOut)
    })
  })

  it('does not mutate the input segments', () => {
    const input = [vid(0), vid(1)]
    const before = JSON.stringify(input)
    applyViralTransitions(input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('is safe on empty / single-segment timelines', () => {
    expect(applyViralTransitions([])).toEqual([])
    const one = applyViralTransitions([vid(0)])
    expect(one[0].transitionOut).toBeUndefined()
  })

  it('honours a custom transition duration', () => {
    const out = applyViralTransitions([vid(0), vid(1)], { transitionDuration: 0.5 })
    expect(out[0].transitionDuration).toBe(0.5)
  })
})

describe('buildViralCaptions', () => {
  const caps = [
    { text: 'make money fast', startTime: 0, endTime: 1.2 },
    { text: 'this is the secret', startTime: 1.2, endTime: 2.4 },
  ]
  const words = [
    { word: 'make', start: 0, end: 0.4 },
    { word: 'money', start: 0.4, end: 0.8 },
    { word: 'fast', start: 0.8, end: 1.2 },
    { word: 'this', start: 1.2, end: 1.5 },
    { word: 'is', start: 1.5, end: 1.7 },
    { word: 'the', start: 1.7, end: 1.9 },
    { word: 'secret', start: 1.9, end: 2.4 },
  ]

  it('emits one karaoke overlay per caption with synced words', () => {
    const out = buildViralCaptions(caps, words)
    expect(out).toHaveLength(2)
    expect(out[0].captionMode).toBe('word')
    expect(out[0].words?.map((w) => w.word)).toEqual(['make', 'money', 'fast'])
  })

  it('auto-highlights keywords and auto-picks an emoji', () => {
    const out = buildViralCaptions(caps, words)
    expect(out[0].highlightWords).toEqual(expect.arrayContaining(['money']))
    expect(out[0].emoji).toBe('💰')         // "money" → money bag
    expect(out[1].captionPreset).toBe('hook') // default viral preset
  })

  it('falls back to block mode when there are no word timings', () => {
    const out = buildViralCaptions(caps, [])
    expect(out[0].captionMode).toBe('block')
    expect(out[0].words).toEqual([])
  })

  it('drops caption rows with bad/empty timing (no crash)', () => {
    const out = buildViralCaptions(
      [{ text: '', startTime: 0, endTime: 1 }, { text: 'ok', startTime: 2, endTime: 1 }, { text: 'good', startTime: 3, endTime: 4 }],
      [],
    )
    expect(out).toHaveLength(1)
    expect(out[0].text).toBe('good')
  })
})

describe('planAutoViralEdit', () => {
  const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
  const caps = [{ text: 'go viral now', startTime: 0, endTime: 2 }]
  const words = [
    { word: 'go', start: 0, end: 0.6 },
    { word: 'viral', start: 0.6, end: 1.2 },
    { word: 'now', start: 1.2, end: 2.0 },
  ]

  it('does the full edit: beat-cuts, varies transitions, and karaoke-captions', () => {
    const r = planAutoViralEdit({ beats, duration: 6, captions: caps, words, sourceUrl: 'https://x/v.mp4' })
    expect(r.summary.didCut).toBe(true)
    expect(r.summary.clips).toBeGreaterThanOrEqual(2)
    expect(r.summary.transitions).toBe(r.summary.clips - 1) // all but the last
    expect(r.summary.didCaption).toBe(true)
    expect(r.segments.every((s) => s.type === 'video' && s.sourceUrl === 'https://x/v.mp4')).toBe(true)
  })

  it('captions-only (honest) when there are no beats', () => {
    const r = planAutoViralEdit({ beats: [], duration: 6, captions: caps, words })
    expect(r.summary.didCut).toBe(false)
    expect(r.segments).toEqual([])
    expect(r.summary.didCaption).toBe(true)
    expect(r.summary.notes.join(' ')).toMatch(/no music beats/i)
  })

  it('cut-only (honest) when there is no transcript', () => {
    const r = planAutoViralEdit({ beats, duration: 6 })
    expect(r.summary.didCut).toBe(true)
    expect(r.summary.didCaption).toBe(false)
    expect(r.summary.notes.join(' ')).toMatch(/no transcript/i)
  })

  it('never throws on fully empty input', () => {
    const r = planAutoViralEdit({ beats: [], duration: 0 })
    expect(r.segments).toEqual([])
    expect(r.overlays).toEqual([])
    expect(r.summary.didCut).toBe(false)
    expect(r.summary.didCaption).toBe(false)
  })
})
