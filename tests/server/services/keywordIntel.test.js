const {
  scoreKeyword, parseAutocomplete, demandFromRank, getKeywordIdeas,
} = require('../../../server/services/keywordIntelService');

describe('scoreKeyword (pure)', () => {
  it('rewards high demand + low competition', () => {
    const hot = scoreKeyword('capcut editing', { demand: 90, competition: 20, relevance: 90 });
    const cold = scoreKeyword('niche thing', { demand: 20, competition: 90, relevance: 40 });
    expect(hot.score).toBeGreaterThan(cold.score);
    expect(hot.recommendation).toBe('target');
    expect(['secondary', 'long-tail']).toContain(cold.recommendation);
  });

  it('is bounded 0–100 and safe on missing signals', () => {
    const k = scoreKeyword('x');
    expect(k.score).toBeGreaterThanOrEqual(0);
    expect(k.score).toBeLessThanOrEqual(100);
  });
});

describe('parseAutocomplete (pure)', () => {
  it('parses the firefox-client suggest JSON', () => {
    const raw = JSON.stringify(['capcut', ['capcut editing', 'capcut tutorial', 'capcut tips']]);
    expect(parseAutocomplete(raw)).toEqual(['capcut editing', 'capcut tutorial', 'capcut tips']);
  });
  it('returns [] on garbage', () => {
    expect(parseAutocomplete('not json')).toEqual([]);
    expect(parseAutocomplete(null)).toEqual([]);
  });
});

describe('demandFromRank (pure)', () => {
  it('ranks earlier suggestions as higher demand', () => {
    expect(demandFromRank(0, 10)).toBeGreaterThan(demandFromRank(9, 10));
  });
});

describe('getKeywordIdeas (orchestrator)', () => {
  it('builds scored, deduped, sorted ideas from autocomplete (AI off)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      text: async () => JSON.stringify(['capcut editing', ['capcut editing tips', 'capcut editing tutorial', 'capcut editing tips']]),
    });
    const r = await getKeywordIdeas('capcut editing', { fetchImpl, useAi: false, limit: 10 });
    expect(r.available).toBe(true);
    expect(r.source).toBe('youtube_autocomplete');
    // seed + 2 unique suggestions (the duplicate is removed)
    const kws = r.ideas.map((i) => i.keyword);
    expect(kws).toContain('capcut editing');
    expect(new Set(kws).size).toBe(kws.length); // deduped
    // sorted desc by score
    for (let i = 1; i < r.ideas.length; i++) expect(r.ideas[i - 1].score).toBeGreaterThanOrEqual(r.ideas[i].score);
  });

  it('returns available:false / source none when autocomplete yields nothing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ text: async () => 'garbage' });
    const r = await getKeywordIdeas('zzz', { fetchImpl, useAi: false });
    // only the seed remains
    expect(r.source).toBe('none');
    expect(r.ideas.every((i) => i.source === 'seed')).toBe(true);
  });
});
