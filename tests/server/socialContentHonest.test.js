/**
 * aiService.generateSocialContent must never invent posts.
 *
 * With no API key it returned "Check out this <niche> content! <first 100
 * chars>..." for every platform, and when a model call failed — googleAI returns
 * null on quota exhaustion or an upstream error — that platform's post became
 * "Check out this <niche> content!". Dashboard content generation, the unified
 * pipeline and long-form adaptation saved and showed those as generated posts.
 * Now a platform the model did not write for is simply absent.
 */

const mockGoogleAI = { generateContent: jest.fn(), isConfigured: true };
jest.mock('../../server/utils/googleAI', () => mockGoogleAI);
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../server/services/personalizationService', () => ({
  getPersona: jest.fn().mockResolvedValue(null),
  applyPersona: jest.fn((p) => p),
}));

const { generateSocialContent } = require('../../server/services/aiService');

describe('generateSocialContent', () => {
  beforeEach(() => {
    mockGoogleAI.generateContent.mockReset();
    mockGoogleAI.isConfigured = true;
  });

  it('returns the posts the model wrote, with their hashtags', async () => {
    mockGoogleAI.generateContent
      .mockResolvedValueOnce('  Morning wins start early #morning #habits  ')
      .mockResolvedValueOnce('A LinkedIn take on routines');

    expect(await generateSocialContent('source text', 'fitness', ['twitter', 'linkedin'])).toEqual({
      twitter: { platform: 'twitter', text: 'Morning wins start early #morning #habits', hashtags: ['#morning', '#habits'] },
      linkedin: { platform: 'linkedin', text: 'A LinkedIn take on routines', hashtags: [] },
    });
  });

  it('leaves out a platform whose call failed, keeping the ones that worked', async () => {
    mockGoogleAI.generateContent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('A LinkedIn take on routines');

    const out = await generateSocialContent('source text', 'fitness', ['twitter', 'linkedin']);

    expect(Object.keys(out)).toEqual(['linkedin']);
  });

  it('returns nothing — not filler — when every call fails or comes back blank', async () => {
    mockGoogleAI.generateContent.mockResolvedValueOnce(null).mockResolvedValueOnce('   ');
    expect(await generateSocialContent('source text', 'fitness', ['twitter', 'linkedin'])).toEqual({});
  });

  it('returns nothing when the model call throws', async () => {
    mockGoogleAI.generateContent.mockRejectedValue(new Error('boom'));
    expect(await generateSocialContent('source text', 'fitness', ['twitter'])).toEqual({});
  });

  it('returns nothing when AI is not configured, without calling the model', async () => {
    mockGoogleAI.isConfigured = false;
    expect(await generateSocialContent('source text', 'fitness', ['twitter', 'linkedin'])).toEqual({});
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });

  it('never produces the old "Check out this" filler on any path', async () => {
    for (const setup of [
      () => { mockGoogleAI.isConfigured = false; },
      () => { mockGoogleAI.generateContent.mockResolvedValue(null); },
      () => { mockGoogleAI.generateContent.mockRejectedValue(new Error('x')); },
    ]) {
      mockGoogleAI.generateContent.mockReset();
      mockGoogleAI.isConfigured = true;
      setup();
      const out = await generateSocialContent('some source text', 'fitness', ['twitter', 'instagram']);
      expect(JSON.stringify(out)).not.toMatch(/Check out this/);
    }
  });
});
