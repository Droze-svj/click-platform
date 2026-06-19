const {
  deriveChapters, suggestBrollKeywords, buildSentimentEffects,
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
