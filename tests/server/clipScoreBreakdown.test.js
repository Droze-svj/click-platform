// buildClipPlan's virality score is 0.6*hookScore + 0.25*peakBoost + triggerWeight*20,
// but only the composite was ever returned — so the UI could show a number and
// not a reason, and the clips hub invented its own explanation from thresholds.
// These lock in that the real contributions are reported, and that they are the
// ones the formula actually used.

const { buildClipPlan } = require('../../server/services/aiVideoEditingService');

const keyMoments = ({ hookScore = 80, peakConfidence = 0.8, triggerType = 'shock' } = {}) => ({
  hookScore,
  clipSuggestions: [{ start: 10, end: 40, reason: 'the payoff lands here' }],
  highlights: [{ time: 20, confidence: peakConfidence }],
  reactions: [{ time: 21, triggerType, text: 'you will not believe this' }],
});

describe('buildClipPlan — score breakdown', () => {
  it('reports the three real contributions, not just the composite', () => {
    const [clip] = buildClipPlan(keyMoments(), { duration: 120, maxClips: 1 });
    expect(clip.scoreBreakdown).toEqual({
      hook: 48,      // 0.6 * 80
      peak: 20,      // 0.25 * (0.8 * 100)
      trigger: 20,   // shock weight 1.0 * 20
    });
  });

  it('the parts are the ones the score was built from', () => {
    const [clip] = buildClipPlan(keyMoments(), { duration: 120, maxClips: 1 });
    const { hook, peak, trigger } = clip.scoreBreakdown;
    expect(clip.viralityScore).toBe(Math.round(hook + peak + trigger));
  });

  it('weights each trigger type distinctly', () => {
    const shock = buildClipPlan(keyMoments({ triggerType: 'shock' }), { duration: 120, maxClips: 1 })[0];
    const value = buildClipPlan(keyMoments({ triggerType: 'value' }), { duration: 120, maxClips: 1 })[0];
    expect(shock.scoreBreakdown.trigger).toBe(20);   // 1.0 * 20
    expect(value.scoreBreakdown.trigger).toBe(16);   // 0.8 * 20
    expect(shock.viralityScore).toBeGreaterThan(value.viralityScore);
  });

  it('an unknown trigger falls back to the documented default weight', () => {
    const clip = buildClipPlan(keyMoments({ triggerType: 'made-up' }), { duration: 120, maxClips: 1 })[0];
    expect(clip.scoreBreakdown.trigger).toBe(14);    // 0.7 * 20
  });

  it('reports zero contributions honestly rather than omitting them', () => {
    // No highlights and no reactions — peak and trigger genuinely contributed
    // nothing, and the UI should be able to say so.
    const clip = buildClipPlan({
      hookScore: 60,
      clipSuggestions: [{ start: 0, end: 30, reason: 'opening' }],
    }, { duration: 120, maxClips: 1 })[0];
    expect(clip.scoreBreakdown.peak).toBe(0);
    expect(clip.scoreBreakdown.trigger).toBe(0);
    expect(clip.scoreBreakdown.hook).toBe(36);
  });

  it('still ranks and caps clips as before', () => {
    const clips = buildClipPlan({
      hookScore: 70,
      clipSuggestions: [
        { start: 0, end: 30, reason: 'a' },
        { start: 40, end: 70, reason: 'b' },
        { start: 80, end: 110, reason: 'c' },
      ],
      highlights: [{ time: 50, confidence: 0.95 }],
      reactions: [{ time: 51, triggerType: 'shock', text: 'wow' }],
    }, { duration: 200, maxClips: 2 });

    expect(clips).toHaveLength(2);
    expect(clips[0].rank).toBe(1);
    // The window containing the peak AND the reaction must outrank the others.
    expect(clips[0].startTime).toBe(40);
    expect(clips[0].viralityScore).toBeGreaterThan(clips[1].viralityScore);
    for (const c of clips) expect(c.scoreBreakdown).toBeDefined();
  });
});
