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
