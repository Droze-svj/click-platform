// Unit tests for personalizationService — the prompt assembler + learning-loop
// write wrapper. buildPersonalizedSystemPrompt is tested with a PRE-FETCHED
// persona (no DB); recordChoices is tested by spying on the model write methods.

const ps = require('../../../server/services/personalizationService');
const mk = require('../../../server/services/marketingKnowledge');
const UserStyleProfile = require('../../../server/models/UserStyleProfile');

const SEEDED = {
  styleProfile: {
    userId: 'u1',
    weightedHooks: [{ key: 'curiosity-gap', performanceScore: 0.6, sampleSize: 5 }],
    captionStyles: [{ key: 'bold-kinetic', count: 9 }],
    fonts: [{ key: 'Inter', count: 5 }],
  },
  topPerformers: {
    sampleSize: 6, postsAnalysed: 4, topHooks: ['curiosity-gap'], topCtaCategories: ['save'],
    topCaptions: ['bold-kinetic'], topColorGrades: ['cinematic'], topHookAngles: ['curiosity-gap'],
  },
  voice: { tone: 'blunt operator energy', hookStyle: 'data-flex', pacing: 'aggressive', vocab: ['cheat code'], banned: ['delve'] },
  brand: { colors: { primary: '#FF0050', accent: '#00E0FF' }, fonts: {}, colorGrade: 'cinematic', transition: '' },
  preferences: {}, niche: 'finance', platform: 'tiktok',
};

describe('personalizationService.buildPersonalizedSystemPrompt', () => {
  it('folds the creator\'s learned style + voice + brand into the prompt', async () => {
    const out = await ps.buildPersonalizedSystemPrompt({ userId: 'u1', niche: 'finance', platform: 'tiktok', persona: SEEDED });
    expect(out).toMatch(/blunt operator energy/);     // custom tone
    expect(out).toMatch(/cheat code/);                // custom vocab
    expect(out).toMatch(/"delve"/);                   // banned word
    expect(out).toMatch(/#FF0050/);                   // brand color (extra block)
    expect(out).toMatch(/worked for THIS creator/i);  // top-performers block
    expect(out).toMatch(/curiosity-gap/);             // learned hook
    expect(out).toMatch(/data-flex/);                 // preferred hook framework
  });

  it('applies a per-request tone override', async () => {
    const out = await ps.buildPersonalizedSystemPrompt({ userId: 'u1', niche: 'finance', platform: 'tiktok', persona: SEEDED, override: { tone: 'calm professorial' } });
    expect(out).toMatch(/calm professorial/);
    expect(out).not.toMatch(/blunt operator energy/);
  });

  it('cold-start (userId null) === the plain base prompt, no extra blocks, no throw', async () => {
    const out = await ps.buildPersonalizedSystemPrompt({ userId: null, niche: 'finance', platform: 'tiktok' });
    const base = mk.buildSystemPrompt({ persona: 'creative-director', niche: 'finance', platform: 'tiktok' });
    expect(out).toBe(base);
    expect(out).not.toMatch(/worked for THIS creator/i);
  });
});

describe('personalizationService.recordChoices', () => {
  const VALID_ID = '5f9d88b9c8a4f12345678901'; // a 24-hex ObjectId
  afterEach(() => jest.restoreAllMocks());

  it('routes picks and performance to the right model methods, drops invalid facets', async () => {
    const pick = jest.spyOn(UserStyleProfile, 'recordPick').mockResolvedValue({});
    const perf = jest.spyOn(UserStyleProfile, 'recordPerformance').mockResolvedValue({});
    const r = await ps.recordChoices(VALID_ID, [
      { facet: 'platforms', key: 'tiktok' },
      { weightedFacet: 'weightedHooks', key: 'curiosity-gap', retentionDelta: 0.4 },
      { facet: 'not_a_real_facet', key: 'x' },     // dropped
      { facet: 'niches' },                          // no key → dropped
    ]);
    expect(r.recorded).toBe(2);
    expect(pick).toHaveBeenCalledWith(VALID_ID, 'platforms', 'tiktok');
    expect(perf).toHaveBeenCalledWith(VALID_ID, 'weightedHooks', 'curiosity-gap', 0.4);
  });

  it('never throws and records nothing for a non-ObjectId user', async () => {
    const pick = jest.spyOn(UserStyleProfile, 'recordPick').mockResolvedValue({});
    const r = await ps.recordChoices('dev-user-123', [{ facet: 'platforms', key: 'tiktok' }]);
    expect(r.recorded).toBe(0);
    expect(pick).not.toHaveBeenCalled();
  });

  it('clamps retentionDelta to [-1,1] and defaults missing delta', async () => {
    const perf = jest.spyOn(UserStyleProfile, 'recordPerformance').mockResolvedValue({});
    await ps.recordChoices(VALID_ID, [
      { weightedFacet: 'weightedColorGrades', key: 'cinematic', retentionDelta: 9 },
      { weightedFacet: 'weightedVoiceTones', key: 'hype' },
    ]);
    expect(perf).toHaveBeenCalledWith(VALID_ID, 'weightedColorGrades', 'cinematic', 1);
    expect(perf).toHaveBeenCalledWith(VALID_ID, 'weightedVoiceTones', 'hype', 0.3);
  });
});
