import { mapTimelineToSource, resolveSegmentSpeed, selectPrimarySegments, clampPlaybackRate } from '../timelinePlayback'
import { TimelineSegment } from '../../types/editor'

// A minimal segment factory — only the fields the mapper reads.
function seg(p: Partial<TimelineSegment>): TimelineSegment {
  return {
    id: p.id ?? 'x',
    startTime: p.startTime ?? 0,
    endTime: p.endTime ?? 0,
    duration: p.duration ?? ((p.endTime ?? 0) - (p.startTime ?? 0)),
    type: (p.type ?? 'video') as any,
    name: p.name ?? 'seg',
    color: p.color ?? '#000',
    track: p.track ?? 0,
    ...p,
  } as TimelineSegment
}

describe('resolveSegmentSpeed', () => {
  it('defaults to 1 when unset', () => {
    expect(resolveSegmentSpeed(seg({}))).toBe(1)
    expect(resolveSegmentSpeed(null)).toBe(1)
  })
  it('uses playbackSpeed', () => {
    expect(resolveSegmentSpeed(seg({ playbackSpeed: 2 }))).toBe(2)
    expect(resolveSegmentSpeed(seg({ playbackSpeed: 0.5 }))).toBe(0.5)
  })
  it('averages a speed ramp (matching the renderer)', () => {
    expect(resolveSegmentSpeed(seg({ playbackSpeedStart: 1, playbackSpeedEnd: 3 }))).toBe(2)
  })
  it('clamps to the renderer range 0.25–4', () => {
    expect(resolveSegmentSpeed(seg({ playbackSpeed: 99 }))).toBe(4)
    expect(resolveSegmentSpeed(seg({ playbackSpeed: 0.01 }))).toBe(0.25)
  })
})

describe('clampPlaybackRate', () => {
  it('keeps sane rates, clamps extremes, and never returns 0/NaN', () => {
    expect(clampPlaybackRate(1.5)).toBe(1.5)
    expect(clampPlaybackRate(0)).toBe(1)
    expect(clampPlaybackRate(NaN)).toBe(1)
    expect(clampPlaybackRate(999)).toBe(16)
  })
})

describe('selectPrimarySegments', () => {
  it('keeps main-track video/cut, drops audio/text/effects/broll, sorts by startTime', () => {
    const segs = [
      seg({ id: 'b', startTime: 5, endTime: 10, type: 'video' }),
      seg({ id: 'a', startTime: 0, endTime: 5, type: 'video' }),
      seg({ id: 'audio', startTime: 0, endTime: 5, type: 'audio', track: 6 }),
      seg({ id: 'text', startTime: 0, endTime: 5, type: 'text' }),
      // B-roll is a cover OVERLAY, not a main-sequence source-switch — excluded
      // here so it isn't double-processed (overlay + source swap → black flash).
      seg({ id: 'broll', startTime: 2, endTime: 4, type: 'broll' }),
    ]
    const out = selectPrimarySegments(segs)
    expect(out.map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('mapTimelineToSource', () => {
  it('returns identity when there are no primary segments', () => {
    const m = mapTimelineToSource(3, [])
    expect(m.segment).toBeNull()
    expect(m.sourceTime).toBe(3)
    expect(m.speed).toBe(1)
  })

  it('order + trim: seeks into each segment source in startTime order (speed 1 unchanged)', () => {
    const segs = [
      seg({ id: 'a', startTime: 0, endTime: 4, sourceStartTime: 10 }), // shows source 10..14
      seg({ id: 'b', startTime: 4, endTime: 8, sourceStartTime: 2 }),  // shows source 2..6
    ]
    // 1s into segment a -> source 11
    expect(mapTimelineToSource(1, segs)).toMatchObject({ sourceTime: 11, speed: 1 })
    // 1s into segment b (t=5) -> source 3
    expect(mapTimelineToSource(5, segs)).toMatchObject({ sourceTime: 3, speed: 1 })
  })

  it('speed: a 2x segment consumes source twice as fast (export parity)', () => {
    const s = seg({ id: 's', startTime: 0, endTime: 5, sourceStartTime: 0, playbackSpeed: 2 })
    // 1 output second into a 2x clip -> 2 source seconds
    expect(mapTimelineToSource(1, [s])).toMatchObject({ sourceTime: 2, speed: 2 })
    expect(mapTimelineToSource(2, [s])).toMatchObject({ sourceTime: 4, speed: 2 })
  })

  it('slow-mo: a 0.5x segment consumes source at half rate', () => {
    const s = seg({ id: 's', startTime: 0, endTime: 4, sourceStartTime: 6, playbackSpeed: 0.5 })
    expect(mapTimelineToSource(2, [s])).toMatchObject({ sourceTime: 7, speed: 0.5 })
  })

  it('freeze: holds the source start frame regardless of time', () => {
    const s = seg({ id: 's', startTime: 0, endTime: 4, sourceStartTime: 9, freezeFrame: true })
    expect(mapTimelineToSource(3, [s]).sourceTime).toBe(9)
    expect(mapTimelineToSource(3, [s]).freeze).toBe(true)
  })

  it('carries per-segment sourceUrl for multi-clip, null when absent', () => {
    const multi = seg({ id: 'm', startTime: 0, endTime: 4, sourceUrl: '/uploads/videos/clip2.mp4' } as any)
    expect(mapTimelineToSource(1, [multi]).sourceUrl).toBe('/uploads/videos/clip2.mp4')
    const single = seg({ id: 's', startTime: 0, endTime: 4 })
    expect(mapTimelineToSource(1, [single]).sourceUrl).toBeNull()
  })

  it('past the end clamps to the last segment source end', () => {
    const segs = [seg({ id: 'a', startTime: 0, endTime: 4, sourceStartTime: 0, sourceEndTime: 4 })]
    expect(mapTimelineToSource(99, segs)).toMatchObject({ sourceTime: 4 })
  })

  it('lead-in gap (t before the first segment) shows the BASE source, not the last clip', () => {
    const segs = [
      seg({ id: 'a', startTime: 2, endTime: 5, sourceStartTime: 0 }),
      seg({ id: 'z', startTime: 5, endTime: 9, sourceUrl: '/uploads/videos/ending.mp4' } as any),
    ]
    // At t=0.5 (before segment a starts at 2) we must NOT jump to the ending clip.
    const m = mapTimelineToSource(0.5, segs)
    expect(m.segment).toBeNull()
    expect(m.sourceUrl).toBeNull()
    expect(m.sourceTime).toBe(0.5)
  })

  it('interior gap holds the previous segment end, not the final clip', () => {
    const segs = [
      seg({ id: 'a', startTime: 0, endTime: 4, sourceStartTime: 0, sourceEndTime: 4 }),
      seg({ id: 'z', startTime: 8, endTime: 12, sourceUrl: '/uploads/videos/ending.mp4', sourceStartTime: 1, sourceEndTime: 5 } as any),
    ]
    // t=6 is in the gap between a (ends 4) and z (starts 8): hold a's end, not z.
    const m = mapTimelineToSource(6, segs)
    expect(m.segment?.id).toBe('a')
    expect(m.sourceUrl).toBeNull()
    expect(m.sourceTime).toBe(4)
  })
})
