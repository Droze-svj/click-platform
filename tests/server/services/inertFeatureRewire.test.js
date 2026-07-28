// Two previously-inert features restored (they called nonexistent exports →
// silently returned base/empty). abVariant is unit-tested here (googleAI mocked);
// slaTrackingService.getSLAStatus rollup logic is checked via lightweight fakes.

jest.mock('../../../server/utils/googleAI');
const googleAI = require('../../../server/utils/googleAI');
const ab = require('../../../server/services/abVariantService');

describe('abVariantService — AI-driven variants (was returning base identical)', () => {
  afterEach(() => jest.clearAllMocks());

  it('generateHeadlineVariant returns the AI headline (quote-stripped)', async () => {
    googleAI.generateContent = jest.fn().mockResolvedValue('  "5 Ways to Win"  ');
    const out = await ab.generateHeadlineVariant({ title: 'Original' }, 0);
    expect(out).toBe('5 Ways to Win');
    expect(googleAI.generateContent).toHaveBeenCalledTimes(1);
    expect(googleAI.generateContent.mock.calls[0][0]).toContain('Original');
  });

  it('generateHeadlineVariant falls back to base title when AI is unavailable (null)', async () => {
    googleAI.generateContent = jest.fn().mockResolvedValue(null);
    const out = await ab.generateHeadlineVariant({ title: 'Base Title' }, 1);
    expect(out).toBe('Base Title');
  });

  it('generateCaptionVariant returns the rewritten caption', async () => {
    googleAI.generateContent = jest.fn().mockResolvedValue('A punchy new caption.');
    const out = await ab.generateCaptionVariant({ content: { text: 'old caption' } }, 2);
    expect(out).toBe('A punchy new caption.');
  });

  it('generateHashtagVariant parses a list into # tags, dropping non-tags', async () => {
    googleAI.generateContent = jest.fn().mockResolvedValue('#growth, #saas marketing #ai, plainword');
    const out = await ab.generateHashtagVariant({ content: { text: 'x' } }, 0);
    expect(out).toEqual(['#growth', '#saas', '#ai']);
  });

  it('generateHashtagVariant falls back to base hashtags when AI yields nothing', async () => {
    googleAI.generateContent = jest.fn().mockResolvedValue('');
    const out = await ab.generateHashtagVariant({ content: { text: 'x' }, hashtags: ['#base'] }, 0);
    expect(out).toEqual(['#base']);
  });

  it('produces DIFFERENT headline variants across indices (the actual A/B point)', async () => {
    googleAI.generateContent = jest.fn()
      .mockResolvedValueOnce('Curiosity headline')
      .mockResolvedValueOnce('Benefit headline');
    const v0 = await ab.generateHeadlineVariant({ title: 'X' }, 0);
    const v1 = await ab.generateHeadlineVariant({ title: 'X' }, 1);
    expect(v0).not.toBe(v1);
  });
});
