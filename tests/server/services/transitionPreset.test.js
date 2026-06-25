const { TRANSITION_PRESETS, resolveTransition, applyTransitionToSegments } = require('../../../server/services/transitionPresetService');
const { buildBeatCutPlan } = require('../../../server/services/beatSyncCutService');

// The xfade modes the render engine (stitchSegments XFADE_OK) accepts.
const RENDER_XFADE = new Set(['fade', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight',
  'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown', 'dissolve',
  'circleopen', 'circleclose', 'pixelize', 'radial', 'smoothleft', 'smoothright',
  'smoothup', 'smoothdown']);

describe('transition presets', () => {
  it('every preset maps to a render-VALID xfade mode (no silent-fail typo)', () => {
    expect(TRANSITION_PRESETS.length).toBeGreaterThan(8);
    for (const p of TRANSITION_PRESETS) {
      expect(RENDER_XFADE.has(p.xfade)).toBe(true);
      expect(p.duration).toBeGreaterThan(0);
    }
  });

  it('resolveTransition returns valid render fields + clamps duration', () => {
    const t = resolveTransition('whip-left');
    expect(t.transitionType).toBe('slideleft');
    expect(RENDER_XFADE.has(t.transitionType)).toBe(true);
    expect(resolveTransition('whip-left', { duration: 99 }).transitionDuration).toBeLessThanOrEqual(2);
  });

  it('falls back to fade for an unknown id (typo-safe)', () => {
    expect(resolveTransition('nonsense').transitionType).toBe('fade');
  });

  it('accepts a raw xfade name too', () => {
    expect(resolveTransition('circleclose').transitionType).toBe('circleclose');
  });
});

describe('applyTransitionToSegments (pure)', () => {
  it('sets the transition on every segment EXCEPT the last (xfade needs a next clip)', () => {
    const segs = [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }];
    const out = applyTransitionToSegments(segs, 'dissolve');
    expect(out[0].transitionType).toBe('dissolve');
    expect(out[1].transitionType).toBe('dissolve');
    expect(out[2].transitionType).toBeUndefined(); // last has no outgoing transition
    // does not mutate input
    expect(segs[0].transitionType).toBeUndefined();
  });

  it('composes with beat-cuts: a montage gets a transition on every cut', () => {
    const beats = Array.from({ length: 10 }, (_, i) => (i + 1) * 0.5);
    const plan = buildBeatCutPlan(beats, { duration: 5, everyNthBeat: 1, minClip: 0.4 });
    const withT = applyTransitionToSegments(plan.segments, 'whip-right');
    const withTransition = withT.filter((s) => s.transitionType);
    expect(withTransition.length).toBe(plan.segments.length - 1);
    expect(withTransition.every((s) => s.transitionType === 'slideright')).toBe(true);
  });

  it('is safe on empty input', () => {
    expect(applyTransitionToSegments([], 'fade')).toEqual([]);
  });
});
