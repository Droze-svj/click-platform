const { detectFillerWords } = require('../../../server/services/aiVideoEditingService');

describe('detectFillerWords', () => {
  it('flags clear disfluencies with their word-level timings', () => {
    const transcript = {
      words: [
        { word: 'So', start: 0.0, end: 0.3 },
        { word: 'um', start: 0.4, end: 0.7 },
        { word: 'this', start: 0.8, end: 1.0 },
        { word: 'uh', start: 1.1, end: 1.3 },
        { word: 'works', start: 1.4, end: 1.8 },
      ],
    };
    const cuts = detectFillerWords(transcript);
    expect(cuts).toHaveLength(2);
    expect(cuts[0]).toMatchObject({ type: 'filler', timestamp: 0.4 });
    expect(cuts[1].timestamp).toBeCloseTo(1.1);
    expect(cuts.every((c) => c.paddingMs > 0 && c.duration > 0)).toBe(true);
  });

  it('does NOT flag ambiguous words (like/so/actually) — no POS tagging', () => {
    const transcript = {
      words: [
        { word: 'I', start: 0, end: 0.2 },
        { word: 'like', start: 0.3, end: 0.6 },
        { word: 'this', start: 0.7, end: 0.9 },
        { word: 'actually', start: 1.0, end: 1.4 },
        { word: 'so', start: 1.5, end: 1.7 },
      ],
    };
    expect(detectFillerWords(transcript)).toHaveLength(0);
  });

  it('handles missing/empty/timing-less data safely', () => {
    expect(detectFillerWords(null)).toEqual([]);
    expect(detectFillerWords({})).toEqual([]);
    expect(detectFillerWords({ words: [] })).toEqual([]);
    // a filler with no start time is skipped (can't place a cut)
    expect(detectFillerWords({ words: [{ word: 'um' }] })).toEqual([]);
  });

  it('accepts `text` field + punctuation/casing variants', () => {
    const cuts = detectFillerWords({ words: [{ text: 'Um,', start: 2.0, end: 2.3 }] });
    expect(cuts).toHaveLength(1);
    expect(cuts[0].timestamp).toBe(2.0);
  });
});
