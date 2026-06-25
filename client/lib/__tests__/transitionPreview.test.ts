import { activeTransitionAt, transitionOverlayStyle } from '../transitionPreview'
import type { TimelineSegment } from '../../types/editor'

const seg = (over: Partial<TimelineSegment>): TimelineSegment => ({
  id: 'a', startTime: 0, endTime: 2, duration: 2, type: 'video', name: '', color: '', track: 0, ...over,
}) as TimelineSegment

describe('activeTransitionAt (pure)', () => {
  const segments = [
    seg({ id: 's1', startTime: 0, endTime: 2, transitionOut: 'flash', transitionDuration: 0.4 }),
    seg({ id: 's2', startTime: 2, endTime: 4 }), // last clip, no transition
  ]

  it('returns the active transition + progress inside the window [end-dur, end]', () => {
    expect(activeTransitionAt(segments, 1.0)).toBeNull() // before the window
    const at = activeTransitionAt(segments, 1.8) // window is [1.6, 2.0]
    expect(at).not.toBeNull()
    expect(at!.type).toBe('flash')
    expect(at!.progress).toBeCloseTo(0.5, 1)
    expect(at!.segmentId).toBe('s1')
  })

  it('clamps progress to [0,1] at the window edges', () => {
    expect(activeTransitionAt(segments, 1.6)!.progress).toBe(0)
    expect(activeTransitionAt(segments, 2.0)!.progress).toBe(1)
  })

  it('ignores none / zero-duration / non-video segments', () => {
    const noT = [seg({ transitionOut: 'none', transitionDuration: 0.4 })]
    expect(activeTransitionAt(noT, 1.9)).toBeNull()
    const zero = [seg({ transitionOut: 'flash', transitionDuration: 0 })]
    expect(activeTransitionAt(zero, 1.9)).toBeNull()
    const audio = [seg({ type: 'audio' as any, transitionOut: 'flash', transitionDuration: 0.4 })]
    expect(activeTransitionAt(audio, 1.9)).toBeNull()
  })

  it('is safe on bad input', () => {
    expect(activeTransitionAt(undefined, 1)).toBeNull()
    expect(activeTransitionAt([], NaN)).toBeNull()
  })
})

describe('transitionOverlayStyle (pure)', () => {
  it('flash is a bright white overlay peaking mid-transition', () => {
    const mid = transitionOverlayStyle('flash', 0.5)
    expect(mid.background).toBe('#fff')
    expect(Number(mid.opacity)).toBeGreaterThan(Number(transitionOverlayStyle('flash', 0).opacity))
  })
  it('wipe-left reveals via clipPath proportional to progress', () => {
    expect(transitionOverlayStyle('wipe-left', 0.25).clipPath).toContain('75%')
  })
  it('always returns a non-interactive absolute overlay', () => {
    const s = transitionOverlayStyle('crossfade', 0.5)
    expect(s.position).toBe('absolute')
    expect(s.pointerEvents).toBe('none')
  })
})
