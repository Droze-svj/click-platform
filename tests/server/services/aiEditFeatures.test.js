const {
  deriveChapters, suggestBrollKeywords, buildSentimentEffects, buildClipPlan,
} = require('../../../server/services/aiVideoEditingService');

describe('deriveChapters', () => {
  it('builds contiguous labelled chapters spanning the duration', () => {
    const ch = deriveChapters({ narrativeStructure: 'hook-story-reveal' }, 30);
    expect(ch.map((c) => c.label)).toEqual(['Hook', 'Story', 'Reveal']);
    expect(ch[0].startTime).toBe(0);
    expect(ch[2].endTime).toBe(30);
    expect(ch[1].startTime).toBe(ch[0].endTime); // contiguous, no gaps/overlap
    expect(ch[2].startTime).toBe(ch[1].endTime);
  });

  it('defaults unknown structure + returns [] with no duration', () => {
    expect(deriveChapters({}, 0)).toEqual([]);
    expect(deriveChapters({ narrativeStructure: 'mystery-xyz' }, 12).map((c) => c.label))
      .toEqual(['Intro', 'Main', 'Wrap-up']);
  });

  it('uses engagement peaks as boundaries when present', () => {
    const ch = deriveChapters({ narrativeStructure: 'problem-solution', highlights: [{ time: 8 }, { time: 20 }] }, 30);
    expect(ch).toHaveLength(3);
    expect(ch[2].endTime).toBe(30);
  });
});

describe('suggestBrollKeywords', () => {
  it('maps trigger types to keyword sets', () => {
    const s = suggestBrollKeywords({ reactions: [
      { time: 3, triggerType: 'authority', reason: 'expert claim' },
      { time: 9, triggerType: 'fomo' },
    ] });
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ time: 3, triggerType: 'authority' });
    expect(s[0].keywords.length).toBeGreaterThan(0);
  });

  it('defaults unknown triggers, skips invalid times, empty input', () => {
    expect(suggestBrollKeywords({})).toEqual([]);
    const s = suggestBrollKeywords({ reactions: [
      { time: 'x', triggerType: 'shock' },     // bad time → skipped
      { time: 5, triggerType: 'weird-thing' }, // unknown → default keywords
    ] });
    expect(s).toHaveLength(1);
    expect(s[0].keywords.length).toBeGreaterThan(0);
  });
});

describe('buildSentimentEffects', () => {
  it('emits timelineEffects in compileTimelineEffects shape, bounded to duration', () => {
    const fx = buildSentimentEffects({ sentimentArc: 'rising' }, 20);
    expect(fx.length).toBeGreaterThanOrEqual(1);
    for (const e of fx) {
      expect(e).toHaveProperty('type');
      expect(e.enabled).toBe(true);
      expect(e.startTime).toBeGreaterThanOrEqual(0);
      expect(e.endTime).toBeLessThanOrEqual(20);
      expect(e.endTime).toBeGreaterThan(e.startTime);
    }
  });

  it('defaults to a single consistent-polish effect; [] with no duration', () => {
    expect(buildSentimentEffects({ sentimentArc: 'consistent' }, 0)).toEqual([]);
    expect(buildSentimentEffects({}, 10)).toHaveLength(1);
  });
});

describe('buildClipPlan (batch auto-clip + virality ranking)', () => {
  it('ranks clips by virality, returns top-N with scores/windows/ranks', () => {
    const km = {
      geminiInsights: { hookScore: 80 },
      clipSuggestions: [
        { start: 0, end: 20, reason: 'strong opener' },
        { start: 40, end: 70, reason: 'mid value' },
        { start: 100, end: 130, reason: 'cta' },
      ],
      highlights: [{ time: 50, intensity: 95 }],
      reactions: [{ time: 105, triggerType: 'shock', text: 'wow', reason: 'shock moment' }],
    };
    const clips = buildClipPlan(km, { duration: 140, maxClips: 3 });
    expect(clips).toHaveLength(3);
    for (const c of clips) {
      expect(c.viralityScore).toBeGreaterThan(0);
      expect(c.viralityScore).toBeLessThanOrEqual(100);
      expect(c.endTime).toBeGreaterThan(c.startTime);
      expect(c).toHaveProperty('rank');
      expect(c).toHaveProperty('hook');
    }
    expect(clips[0].viralityScore).toBeGreaterThanOrEqual(clips[1].viralityScore);
    expect(clips[1].viralityScore).toBeGreaterThanOrEqual(clips[2].viralityScore);
    expect(clips.map((c) => c.rank)).toEqual([1, 2, 3]);
  });

  it('clamps clip length to [minLen,maxLen] and bounds to duration', () => {
    const km = { clipSuggestions: [{ start: 5, end: 8 }, { start: 10, end: 300 }] };
    const clips = buildClipPlan(km, { duration: 120, minLen: 5, maxLen: 60, maxClips: 5 });
    for (const c of clips) {
      expect(c.durationSec).toBeGreaterThanOrEqual(5 - 0.01);
      expect(c.durationSec).toBeLessThanOrEqual(60 + 0.01);
      expect(c.endTime).toBeLessThanOrEqual(120);
    }
  });

  it('falls back to engagement peaks when no clipSuggestions', () => {
    const clips = buildClipPlan({ highlights: [{ time: 30, intensity: 80 }, { time: 60, intensity: 70 }] }, { duration: 120 });
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0].endTime).toBeGreaterThan(clips[0].startTime);
  });

  it('handles empty/missing input safely', () => {
    expect(buildClipPlan({}, { duration: 60 })).toEqual([]);
    expect(buildClipPlan(null, {})).toEqual([]);
    expect(buildClipPlan({ clipSuggestions: [] }, { duration: 60 })).toEqual([]);
  });
});
