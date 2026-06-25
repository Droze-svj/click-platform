const { TRANSITION_PRESETS, resolveTransition, applyTransitionToSegments } = require('../../../server/services/transitionPresetService');
const { buildBeatCutPlan } = require('../../../server/services/beatSyncCutService');
const { resolveXfadeName } = require('../../../server/services/videoRenderService');

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

describe('resolveXfadeName (render: friendly names → valid xfade)', () => {
  it('maps the editor SegmentTransitionType friendly names to valid xfade modes', () => {
    expect(resolveXfadeName('crossfade')).toBe('fade');
    expect(resolveXfadeName('dip')).toBe('fadeblack');
    expect(resolveXfadeName('wipe-left')).toBe('wipeleft');
    expect(resolveXfadeName('wipe-right')).toBe('wiperight');
    expect(resolveXfadeName('zoom')).toBe('pixelize');
    expect(RENDER_XFADE.has(resolveXfadeName('zoom'))).toBe(true);
  });

  it('maps the EXPANDED creative set (flash/dissolve/slide/whip/iris/radial/glitch)', () => {
    const EDITOR_TRANSITIONS = ['none', 'crossfade', 'dissolve', 'flash', 'dip', 'whip-left',
      'whip-right', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down', 'slide-up', 'slide-down',
      'zoom', 'glitch', 'iris', 'radial'];
    for (const name of EDITOR_TRANSITIONS) {
      const xt = resolveXfadeName(name);
      if (name === 'none') { expect(xt).toBeNull(); continue; }
      // EVERY editor transition resolves to a render-VALID xfade (never a silent typo).
      expect(RENDER_XFADE.has(xt)).toBe(true);
    }
    expect(resolveXfadeName('flash')).toBe('fadewhite');
    expect(resolveXfadeName('slide-up')).toBe('smoothup');
    expect(resolveXfadeName('iris')).toBe('circleopen');
    expect(resolveXfadeName('glitch')).toBe('pixelize');
    expect(resolveXfadeName('dissolve')).toBe('dissolve');
    expect(resolveXfadeName('radial')).toBe('radial');
  });
  it('returns null for none/empty (→ plain concat, no fake fade)', () => {
    expect(resolveXfadeName('none')).toBeNull();
    expect(resolveXfadeName('')).toBeNull();
    expect(resolveXfadeName(undefined)).toBeNull();
  });
  it('passes raw xfade names through and falls back to fade for unknowns', () => {
    expect(resolveXfadeName('slideleft')).toBe('slideleft');
    expect(resolveXfadeName('bogus')).toBe('fade');
  });
});
