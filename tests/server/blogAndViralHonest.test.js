/**
 * aiService.generateBlogSummary and generateViralIdeas must not invent output.
 *
 * - generateBlogSummary returned "Summary: <first 300 chars of the source>..."
 *   with no key or when the model call failed, and the literal "Summary
 *   generation failed. Please try again." on an error. Dashboard generation saved
 *   each as the content's blog summary.
 * - generateViralIdeas returned "<niche> Idea 1…N", each with a made-up
 *   potential of 75, when no key was configured — after first fetching the
 *   strategy framework and market trends it then discarded.
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
jest.mock('../../server/services/predictionService', () => ({
  ingestMarketTrends: jest.fn().mockResolvedValue({ trendingTopics: [] }),
}));

const predictionService = require('../../server/services/predictionService');
const { generateBlogSummary, generateViralIdeas } = require('../../server/services/aiService');

const SOURCE = 'My full morning routine, step by step, with the reasons behind each habit.';

beforeEach(() => {
  mockGoogleAI.generateContent.mockReset();
  mockGoogleAI.isConfigured = true;
  predictionService.ingestMarketTrends.mockClear();
});

describe('generateBlogSummary', () => {
  it('returns the summary the model wrote', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('  A real summary of the routine.  ');
    expect(await generateBlogSummary(SOURCE, 'fitness')).toBe('A real summary of the routine.');
  });

  it('returns an empty summary — not the source text — when the call fails', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(null);
    expect(await generateBlogSummary(SOURCE, 'fitness')).toBe('');
  });

  it('returns an empty summary — not an error message — when the call throws', async () => {
    mockGoogleAI.generateContent.mockRejectedValue(new Error('boom'));
    expect(await generateBlogSummary(SOURCE, 'fitness')).toBe('');
  });

  it('returns an empty summary without calling the model when AI is not configured', async () => {
    mockGoogleAI.isConfigured = false;
    expect(await generateBlogSummary(SOURCE, 'fitness')).toBe('');
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });
});

describe('generateViralIdeas', () => {
  it('returns no ideas — not invented ones — when AI is not configured', async () => {
    mockGoogleAI.isConfigured = false;
    expect(await generateViralIdeas('morning routines', 'fitness', 5)).toEqual([]);
  });

  it('does not fetch the framework or market trends when there is nothing to generate', async () => {
    mockGoogleAI.isConfigured = false;
    await generateViralIdeas('morning routines', 'fitness', 5);
    expect(predictionService.ingestMarketTrends).not.toHaveBeenCalled();
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });
});
