const { buildGrowthActions } = require('../../../server/services/growthBriefService');
const { generateHookExperiment } = require('../../../server/services/hookExperimentService');

describe('buildGrowthActions (pure)', () => {
  it('merges SEO quick wins + retention recs, sorted high→low, deduped', () => {
    const scorecard = {
      quickWins: [{ field: 'thumbnail', severity: 'high', fix: 'Add a custom thumbnail.' }],
      issues: [
        { field: 'thumbnail', severity: 'high', fix: 'Add a custom thumbnail.' }, // dup of quick win
        { field: 'tags', severity: 'medium', fix: 'Add the keyword to tags.' },
        { field: 'title', severity: 'low', fix: 'minor' }, // low → excluded from issues loop
      ],
    };
    const retention = {
      available: true,
      recommendations: [
        { type: 'hook', priority: 'high', message: 'Strengthen the hook.' },
        { type: 'cut', priority: 'medium', second: 15, message: 'Cut around 15s.' },
      ],
    };
    const actions = buildGrowthActions(scorecard, retention);
    // dedup: thumbnail appears once
    expect(actions.filter((a) => a.area === 'thumbnail')).toHaveLength(1);
    // includes the medium tag fix + both retention recs
    expect(actions.some((a) => a.area === 'tags')).toBe(true);
    expect(actions.some((a) => a.source === 'retention' && a.area === 'cut')).toBe(true);
    // sorted: first action is high priority
    expect(actions[0].priority).toBe('high');
  });

  it('is safe when retention is unavailable / inputs empty', () => {
    expect(buildGrowthActions({}, { available: false })).toEqual([]);
    expect(buildGrowthActions()).toEqual([]);
  });
});

describe('generateHookExperiment keyword wiring', () => {
  it('weaves the SEO keyword into the template fallback', async () => {
    const r = await generateHookExperiment('how to edit faster', { keyword: 'capcut editing' });
    expect(r.variants).toHaveLength(3);
    // With AI unavailable in test, templates lead with the keyword.
    const joined = r.variants.map((v) => v.hook.toLowerCase()).join(' ');
    expect(joined).toContain('capcut editing');
  });
});
