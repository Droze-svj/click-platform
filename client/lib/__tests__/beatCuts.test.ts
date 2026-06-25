import { buildBeatCutPlan, planToSegments } from '../beatCuts'

describe('buildBeatCutPlan (client, mirrors server)', () => {
  it('tiles the duration with contiguous beat-aligned segments', () => {
    const beats = Array.from({ length: 12 }, (_, i) => (i + 1) * 0.5)
    const plan = buildBeatCutPlan(beats, { duration: 6, minClip: 0.6, maxClip: 4, everyNthBeat: 2 })
    expect(plan.count).toBeGreaterThan(1)
    expect(plan.segments[0].start).toBe(0)
    expect(plan.segments[plan.segments.length - 1].end).toBe(6)
    for (let i = 1; i < plan.segments.length; i++) {
      expect(plan.segments[i].start).toBe(plan.segments[i - 1].end)
    }
  })

  it('cut points are a subset of the beats', () => {
    const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
    const plan = buildBeatCutPlan(beats, { duration: 3, minClip: 0.4, everyNthBeat: 1 })
    for (const c of plan.cutPoints) expect(beats).toContain(c)
  })

  it('is honest with no beats', () => {
    expect(buildBeatCutPlan([], { duration: 5 }).reason).toBe('no_beats')
  })
})

describe('planToSegments', () => {
  const plan = buildBeatCutPlan([0.5, 1.0, 1.5, 2.0, 2.5, 3.0], { duration: 3, minClip: 0.4, everyNthBeat: 1 })

  it('produces contiguous video timeline segments mapped to the source window', () => {
    const segs = planToSegments(plan, { sourceUrl: 'http://x/clip.mp4' })
    expect(segs.length).toBe(plan.count)
    for (const s of segs) {
      expect(s.type).toBe('video')
      expect(s.sourceStartTime).toBe(s.startTime)
      expect(s.sourceEndTime).toBe(s.endTime)
      expect(s.sourceUrl).toBe('http://x/clip.mp4')
    }
  })

  it('applies a transition on every segment EXCEPT the last', () => {
    const segs = planToSegments(plan, { transition: 'wipe-left', transitionDuration: 0.3 })
    const withT = segs.filter((s) => s.transitionOut)
    expect(withT.length).toBe(segs.length - 1)
    expect(segs[segs.length - 1].transitionOut).toBeUndefined()
    expect(withT.every((s) => s.transitionOut === 'wipe-left')).toBe(true)
  })

  it('omits transitions when none requested + has unique ids', () => {
    const segs = planToSegments(plan, {})
    expect(segs.every((s) => !s.transitionOut)).toBe(true)
    expect(new Set(segs.map((s) => s.id)).size).toBe(segs.length)
  })
})
