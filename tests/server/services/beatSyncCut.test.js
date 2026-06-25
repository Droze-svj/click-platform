const { buildBeatCutPlan, generateBeatCuts } = require('../../../server/services/beatSyncCutService');

describe('buildBeatCutPlan (pure)', () => {
  it('cuts on every Nth beat once past minClip and tiles the duration', () => {
    // beats every 0.5s up to 6s.
    const beats = Array.from({ length: 12 }, (_, i) => (i + 1) * 0.5);
    const plan = buildBeatCutPlan(beats, { duration: 6, minClip: 0.6, maxClip: 4, everyNthBeat: 2 });
    expect(plan.count).toBeGreaterThan(1);
    // contiguous, non-overlapping segments covering [0, 6]
    expect(plan.segments[0].start).toBe(0);
    expect(plan.segments[plan.segments.length - 1].end).toBe(6);
    for (let i = 1; i < plan.segments.length; i++) {
      expect(plan.segments[i].start).toBe(plan.segments[i - 1].end);
    }
  });

  it('every clip respects min/max length bounds', () => {
    const beats = Array.from({ length: 40 }, (_, i) => (i + 1) * 0.25); // dense beats
    const plan = buildBeatCutPlan(beats, { duration: 10, minClip: 0.6, maxClip: 3, everyNthBeat: 2 });
    for (const s of plan.segments) {
      expect(s.durationSec).toBeGreaterThanOrEqual(0.6 - 0.001);
      // last segment can be short (tail); interior ones must respect maxClip.
    }
    // no interior clip exceeds maxClip (forced cut)
    const interior = plan.segments.slice(0, -1);
    for (const s of interior) expect(s.durationSec).toBeLessThanOrEqual(3 + 0.5);
  });

  it('cuts land ON beats (cut points are a subset of the beats)', () => {
    const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    const plan = buildBeatCutPlan(beats, { duration: 3, minClip: 0.4, everyNthBeat: 1 });
    for (const c of plan.cutPoints) expect(beats).toContain(c);
  });

  it('is honest with no beats', () => {
    expect(buildBeatCutPlan([], { duration: 5 })).toMatchObject({ count: 0, reason: 'no_beats' });
    expect(buildBeatCutPlan().segments).toEqual([]);
  });
});

describe('generateBeatCuts (orchestrator, injected detector)', () => {
  it('runs detection then the planner', async () => {
    const detectImpl = jest.fn().mockResolvedValue([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]);
    const r = await generateBeatCuts('/tmp/x.mp4', { detectImpl, duration: 4, everyNthBeat: 2, minClip: 0.6 });
    expect(detectImpl).toHaveBeenCalledWith('/tmp/x.mp4');
    expect(r.available).toBe(true);
    expect(r.count).toBeGreaterThan(0);
    expect(r.beatCount).toBe(8);
  });

  it('is honest when detection fails or yields nothing', async () => {
    const fail = jest.fn().mockRejectedValue(new Error('probe failed'));
    expect((await generateBeatCuts('/tmp/x.mp4', { detectImpl: fail })).available).toBe(false);
    const none = jest.fn().mockResolvedValue([]);
    expect((await generateBeatCuts('/tmp/x.mp4', { detectImpl: none })).available).toBe(false);
    expect((await generateBeatCuts('')).reason).toBe('no_input');
  });
});
