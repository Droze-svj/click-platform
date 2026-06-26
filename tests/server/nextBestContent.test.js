// nextBestContentService — the "what to make next" engine. Locks in the honesty
// contract: it ONLY produces ideas grounded in the creator's real proven data
// (persona.topPerformers), returns an explicit need-more-data otherwise, never
// fabricates a numeric lift, and never calls the AI when there's no data.

jest.mock('../../server/utils/googleAI', () => ({
  isConfigured: true,
  generateContent: jest.fn(),
}));
jest.mock('../../server/services/personalizationService', () => ({
  getPersona: jest.fn(),
  buildPersonalizedSystemPrompt: jest.fn().mockResolvedValue('SYSTEM PROMPT'),
}));

const googleAI = require('../../server/utils/googleAI');
const personalization = require('../../server/services/personalizationService');
const { getNextBest } = require('../../server/services/nextBestContentService');

const PROVEN_PERSONA = {
  niche: 'finance',
  voice: { tone: 'punchy', hookStyle: 'curiosity-gap', pacing: 'fast', vocab: [], banned: [] },
  avoidSignals: [],
  topPerformers: { sampleSize: 12, topHooks: ['curiosity-gap', 'data-flex'], topCaptions: ['hormozi-bold'], topColorGrades: ['teal-orange'] },
};

describe('nextBestContentService.getNextBest', () => {
  beforeEach(() => {
    googleAI.generateContent.mockReset();
    personalization.getPersona.mockReset();
  });

  it('grounds ranked ideas in the creator’s proven performers (real data)', async () => {
    personalization.getPersona.mockResolvedValue(PROVEN_PERSONA);
    googleAI.generateContent.mockResolvedValue(JSON.stringify([
      { title: '3 money myths', hook: 'curiosity-gap', platform: 'tiktok', why: 'Leans on your proven curiosity-gap hook', expectedLift: 'high' },
      { title: 'Net worth breakdown', hook: 'data-flex', platform: 'youtube', why: 'Your data-flex angle performs', expectedLift: 'moderate' },
    ]));

    const r = await getNextBest('6a3500000000000000000aaa', { count: 2 });
    expect(r.hasRealData).toBe(true);
    expect(r.sampleSize).toBe(12);
    expect(r.ideas).toHaveLength(2);
    expect(r.ideas[0].title).toBe('3 money myths');
    expect(r.ideas[0].hook).toBe('curiosity-gap');
    expect(r.ideas[0].why).toMatch(/curiosity-gap/i);
    expect(r.groundedOn.hooks).toContain('curiosity-gap');
    // expectedLift stays qualitative — never a fabricated percentage.
    expect(r.ideas[0].expectedLift).toBe('high');
    expect(r.ideas.every((i) => !/%/.test(String(i.expectedLift)))).toBe(true);
  });

  it('returns honest need-more-data (and does NOT call the AI) when the profile is thin', async () => {
    personalization.getPersona.mockResolvedValue({ niche: 'finance', topPerformers: null });
    const r = await getNextBest('6a3500000000000000000bbb', { count: 4 });
    expect(r.hasRealData).toBe(false);
    expect(r.reason).toBe('need-more-data');
    expect(r.ideas).toEqual([]);
    expect(googleAI.generateContent).not.toHaveBeenCalled();
  });

  it('dev users get an honest cold-start with no persona/AI read', async () => {
    const r = await getNextBest('dev-user-123', {});
    expect(r.hasRealData).toBe(false);
    expect(personalization.getPersona).not.toHaveBeenCalled();
    expect(googleAI.generateContent).not.toHaveBeenCalled();
  });

  it('degrades honestly when the AI returns unparseable junk', async () => {
    personalization.getPersona.mockResolvedValue(PROVEN_PERSONA);
    googleAI.generateContent.mockResolvedValue('sorry, no JSON here');
    const r = await getNextBest('6a3500000000000000000ccc', { count: 3 });
    expect(r.hasRealData).toBe(false);
    expect(r.reason).toBe('parse-failed');
  });
});
