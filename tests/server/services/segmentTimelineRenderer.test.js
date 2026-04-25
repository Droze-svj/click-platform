const {
  planSegments,
  isPrimaryVideoSegment,
} = require('../../../server/services/segmentTimelineRenderer');

describe('segmentTimelineRenderer.isPrimaryVideoSegment', () => {
  it('accepts video on track 0 / 1', () => {
    expect(isPrimaryVideoSegment({ track: 0, type: 'video' })).toBe(true);
    expect(isPrimaryVideoSegment({ track: 1, type: 'video' })).toBe(true);
  });

  it('accepts broll and cut types on primary tracks', () => {
    expect(isPrimaryVideoSegment({ track: 0, type: 'broll' })).toBe(true);
    expect(isPrimaryVideoSegment({ track: 1, type: 'cut' })).toBe(true);
  });

  it('treats undefined track as track 0', () => {
    expect(isPrimaryVideoSegment({ type: 'video' })).toBe(true);
  });

  it('rejects graphics tracks (V3+)', () => {
    expect(isPrimaryVideoSegment({ track: 2, type: 'video' })).toBe(false);
    expect(isPrimaryVideoSegment({ track: 4, type: 'video' })).toBe(false);
  });

  it('rejects non-video segment types', () => {
    expect(isPrimaryVideoSegment({ track: 0, type: 'audio' })).toBe(false);
    expect(isPrimaryVideoSegment({ track: 0, type: 'text' })).toBe(false);
    expect(isPrimaryVideoSegment({ track: 0, type: 'transition' })).toBe(false);
  });

  it('rejects null / undefined', () => {
    expect(isPrimaryVideoSegment(null)).toBe(false);
    expect(isPrimaryVideoSegment(undefined)).toBe(false);
  });
});

describe('segmentTimelineRenderer.planSegments', () => {
  it('returns no usable segments when input is empty', () => {
    const r = planSegments([], '/tmp/primary.mp4');
    expect(r.usable).toEqual([]);
    expect(r.totalDuration).toBe(0);
    expect(r.inputUrls).toEqual(['/tmp/primary.mp4']);
  });

  it('plans a single primary segment at input index 0', () => {
    const r = planSegments(
      [{ id: 'a', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5,
         sourceStartTime: 0, sourceEndTime: 5 }],
      '/tmp/primary.mp4'
    );
    expect(r.usable).toHaveLength(1);
    expect(r.usable[0].inputIndex).toBe(0);
    expect(r.totalDuration).toBe(5);
  });

  it('assigns distinct input indices per unique sourceUrl', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 3, duration: 3, sourceUrl: '/tmp/primary.mp4' },
        { id: 'b', track: 0, type: 'broll', startTime: 3, endTime: 5, duration: 2, sourceUrl: '/tmp/broll.mp4' },
        { id: 'c', track: 0, type: 'video', startTime: 5, endTime: 8, duration: 3, sourceUrl: '/tmp/primary.mp4' },
      ],
      '/tmp/primary.mp4'
    );
    expect(r.inputUrls).toEqual(['/tmp/primary.mp4', '/tmp/broll.mp4']);
    expect(r.usable.map((u) => u.inputIndex)).toEqual([0, 1, 0]);
    expect(r.totalDuration).toBe(8);
  });

  it('keeps timeline cursor monotonic across multiple sources', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 2, duration: 2, sourceUrl: '/p.mp4' },
        { id: 'b', track: 0, type: 'broll', startTime: 2, endTime: 4, duration: 2, sourceUrl: '/q.mp4' },
        { id: 'c', track: 0, type: 'broll', startTime: 4, endTime: 6, duration: 2, sourceUrl: '/r.mp4' },
      ],
      '/p.mp4'
    );
    expect(r.usable[0].visualStart).toBe(0);
    expect(r.usable[1].visualStart).toBe(2);
    expect(r.usable[2].visualStart).toBe(4);
    expect(r.inputUrls).toHaveLength(3);
  });

  it('applies J-cut audio offset correctly', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5 },
        { id: 'b', track: 0, type: 'video', startTime: 5, endTime: 10, duration: 5, audioLeadInSec: 0.5 },
      ],
      '/tmp/primary.mp4'
    );
    expect(r.usable[0].audioOffset).toBe(0);
    expect(r.usable[1].audioOffset).toBe(4.5);
  });

  it('clamps J-cut offset to non-negative when leadIn > visualStart', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 0.3, duration: 0.3, audioLeadInSec: 1.0 },
      ],
      '/tmp/primary.mp4'
    );
    expect(r.usable[0].audioOffset).toBe(0);
  });

  it('skips orphan segments with no sourceUrl and no primary', () => {
    const r = planSegments(
      [{ id: 'orphan', track: 0, type: 'video', startTime: 0, endTime: 3, duration: 3 }],
      null
    );
    expect(r.usable).toEqual([]);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].id).toBe('orphan');
  });

  it('falls back to primary sourceUrl for segments without one', () => {
    const r = planSegments(
      [{ id: 'a', track: 0, type: 'video', startTime: 0, endTime: 3, duration: 3 }],
      '/tmp/primary.mp4'
    );
    expect(r.usable).toHaveLength(1);
    expect(r.usable[0].inputIndex).toBe(0);
    expect(r.skipped).toEqual([]);
  });

  it('ignores non-primary segments (e.g. text overlays, graphics tracks)', () => {
    const r = planSegments(
      [
        { id: 'v', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5, sourceUrl: '/p.mp4' },
        { id: 't', track: 0, type: 'text', startTime: 0, endTime: 5, duration: 5 },
        { id: 'g', track: 4, type: 'video', startTime: 0, endTime: 5, duration: 5 },
      ],
      '/p.mp4'
    );
    expect(r.usable).toHaveLength(1);
    expect(r.usable[0].seg.id).toBe('v');
  });

  it('sorts segments by startTime regardless of input order', () => {
    const r = planSegments(
      [
        { id: 'second', track: 0, type: 'video', startTime: 5, endTime: 10, duration: 5, sourceUrl: '/p.mp4' },
        { id: 'first',  track: 0, type: 'video', startTime: 0, endTime: 5,  duration: 5, sourceUrl: '/p.mp4' },
      ],
      '/p.mp4'
    );
    expect(r.usable[0].seg.id).toBe('first');
    expect(r.usable[1].seg.id).toBe('second');
  });

  it('enforces a minimum duration floor of 0.05s', () => {
    const r = planSegments(
      [{ id: 'tiny', track: 0, type: 'video', startTime: 0, endTime: 0, duration: 0, sourceUrl: '/p.mp4' }],
      '/p.mp4'
    );
    expect(r.usable[0].duration).toBe(0.05);
  });

  it('preserves segment object identity in usable results', () => {
    const seg = { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5, sourceUrl: '/p.mp4', reversed: true };
    const r = planSegments([seg], '/p.mp4');
    expect(r.usable[0].seg).toBe(seg);
    expect(r.usable[0].seg.reversed).toBe(true);
  });
});

describe('segmentTimelineRenderer edge-case interactions', () => {
  it('multi-source + freeze: freeze keeps its source input registered', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 2, duration: 2, sourceUrl: '/a.mp4' },
        { id: 'b', track: 0, type: 'video', startTime: 2, endTime: 3, duration: 1, sourceUrl: '/b.mp4', freezeFrame: true, sourceStartTime: 0.5, sourceEndTime: 0.55 },
        { id: 'c', track: 0, type: 'video', startTime: 3, endTime: 5, duration: 2, sourceUrl: '/a.mp4' },
      ],
      '/a.mp4'
    );
    expect(r.inputUrls).toEqual(['/a.mp4', '/b.mp4']);
    expect(r.usable[1].inputIndex).toBe(1);
    expect(r.usable[1].seg.freezeFrame).toBe(true);
    expect(r.totalDuration).toBe(5);
  });

  it('J-cut + reversed segment: audio offset still applies; reversed flag preserved', () => {
    const r = planSegments(
      [
        { id: 'a', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5 },
        { id: 'b', track: 0, type: 'video', startTime: 5, endTime: 10, duration: 5, reversed: true, audioLeadInSec: 0.5 },
      ],
      '/p.mp4'
    );
    expect(r.usable[1].audioOffset).toBe(4.5);
    expect(r.usable[1].seg.reversed).toBe(true);
  });

  it('L-cut + freeze does not blow up: audioTailOutSec stored as-is', () => {
    const r = planSegments(
      [
        { id: 'freeze', track: 0, type: 'video', startTime: 0, endTime: 1, duration: 1, freezeFrame: true, audioTailOutSec: 0.5 },
        { id: 'next', track: 0, type: 'video', startTime: 1, endTime: 3, duration: 2 },
      ],
      '/p.mp4'
    );
    expect(r.usable[0].seg.audioTailOutSec).toBe(0.5);
    expect(r.usable[0].seg.freezeFrame).toBe(true);
  });

  it('J-cut on first segment: clamps audio offset to non-negative (no negative adelay)', () => {
    const r = planSegments(
      [
        { id: 'first', track: 0, type: 'video', startTime: 0, endTime: 2, duration: 2, audioLeadInSec: 1.0 },
      ],
      '/p.mp4'
    );
    expect(r.usable[0].audioOffset).toBe(0);
  });

  it('reorder + multi-source: input indices follow first-seen order, not segment order', () => {
    const r = planSegments(
      [
        // Visual order: secondary first, primary second, then secondary again
        { id: 's1', track: 0, type: 'video', startTime: 0, endTime: 1, duration: 1, sourceUrl: '/secondary.mp4' },
        { id: 'p1', track: 0, type: 'video', startTime: 1, endTime: 3, duration: 2, sourceUrl: '/primary.mp4' },
        { id: 's2', track: 0, type: 'video', startTime: 3, endTime: 4, duration: 1, sourceUrl: '/secondary.mp4' },
      ],
      '/primary.mp4'
    );
    // primary is registered first (because it's the explicit primarySourceUrl)
    expect(r.inputUrls[0]).toBe('/primary.mp4');
    expect(r.inputUrls[1]).toBe('/secondary.mp4');
    expect(r.usable[0].inputIndex).toBe(1); // s1 -> secondary
    expect(r.usable[1].inputIndex).toBe(0); // p1 -> primary
    expect(r.usable[2].inputIndex).toBe(1); // s2 -> reuses secondary
  });

  it('reverse + freeze on the same segment: both flags survive planning (renderer prefers freeze path)', () => {
    const r = planSegments(
      [{ id: 'a', track: 0, type: 'video', startTime: 0, endTime: 2, duration: 2, freezeFrame: true, reversed: true }],
      '/p.mp4'
    );
    expect(r.usable[0].seg.freezeFrame).toBe(true);
    expect(r.usable[0].seg.reversed).toBe(true);
    // Note: in the filter graph, freezeFrame branch wins because reverse on a
    // single still frame is a no-op. This test just ensures planning preserves
    // the data so the render function can decide.
  });

  it('non-primary tracks (V3+) are skipped even with sourceUrl', () => {
    const r = planSegments(
      [
        { id: 'v1', track: 0, type: 'video', startTime: 0, endTime: 5, duration: 5, sourceUrl: '/p.mp4' },
        { id: 'broll-overlay', track: 2, type: 'video', startTime: 1, endTime: 4, duration: 3, sourceUrl: '/q.mp4' },
        { id: 'graphics', track: 4, type: 'video', startTime: 0, endTime: 5, duration: 5, sourceUrl: '/r.mp4' },
      ],
      '/p.mp4'
    );
    // Only the V1 segment is planned. Track 2+ are skipped silently because
    // multi-track compositing is not yet implemented.
    expect(r.usable).toHaveLength(1);
    expect(r.usable[0].seg.id).toBe('v1');
  });

  it('zero-duration segment is floored to 0.05s minimum', () => {
    const r = planSegments(
      [
        { id: 'normal', track: 0, type: 'video', startTime: 0, endTime: 2, duration: 2, sourceUrl: '/p.mp4' },
        { id: 'tiny', track: 0, type: 'video', startTime: 2, endTime: 2, duration: 0, sourceUrl: '/p.mp4' },
      ],
      '/p.mp4'
    );
    expect(r.usable[1].duration).toBeCloseTo(0.05);
    expect(r.totalDuration).toBeCloseTo(2.05);
  });
});
