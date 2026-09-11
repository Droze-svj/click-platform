/**
 * aiService.generateContentIdea must say when it produced no idea.
 *
 * It used to return hardcoded filler ('Content Idea' / 'Create engaging
 * content.') with no marker on every failure path, so POST /api/ai/generate-idea
 * reported the filler as success and callers treated it as a real idea. It now
 * returns { title: null, idea: null, platforms, degraded: true } instead, and
 * contentHealthService.getFutureContentSuggestions skips those rather than
 * showing the user a blank suggestion with a confidence score.
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

const { generateContentIdea } = require('../../server/services/aiService');

const UNAVAILABLE = (platforms) => ({ title: null, idea: null, platforms, degraded: true });

describe('generateContentIdea', () => {
  beforeEach(() => {
    mockGoogleAI.generateContent.mockReset();
    mockGoogleAI.isConfigured = true;
  });

  it('returns a real idea when the model answers with complete JSON', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(
      '{"title":"The What If Hook","idea":"Open with a bold what-if.","platforms":["tiktok"]}'
    );
    const out = await generateContentIdea(['tiktok']);
    expect(out).toEqual({ title: 'The What If Hook', idea: 'Open with a bold what-if.', platforms: ['tiktok'] });
    expect(out).not.toHaveProperty('degraded');
  });

  it('is degraded — not filler — when the response is cut off before the idea', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('{\n  "title": "The What If Hook",\n  "idea": "Open with a bo');
    const out = await generateContentIdea(['tiktok']);
    expect(out).toEqual(UNAVAILABLE(['tiktok']));
  });

  it('is degraded when the upstream call fails (googleAI returns null)', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(null);
    expect(await generateContentIdea(['tiktok'])).toEqual(UNAVAILABLE(['tiktok']));
  });

  it('is degraded when the response is not JSON', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('Sorry, I cannot help with that.');
    expect(await generateContentIdea(['tiktok'])).toEqual(UNAVAILABLE(['tiktok']));
  });

  it('is degraded when the model call throws', async () => {
    mockGoogleAI.generateContent.mockRejectedValue(new Error('boom'));
    expect(await generateContentIdea(['tiktok'])).toEqual(UNAVAILABLE(['tiktok']));
  });

  it('is degraded when AI is not configured, without calling the model', async () => {
    mockGoogleAI.isConfigured = false;
    expect(await generateContentIdea(['tiktok'])).toEqual(UNAVAILABLE(['tiktok']));
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });

  it('rejects a non-array platforms argument instead of coercing it', async () => {
    // contentGenerationService once passed (niche, category); wrapping the
    // string would generate an idea "for the platform general".
    expect(await generateContentIdea('general', 'tips')).toEqual(UNAVAILABLE([]));
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });

  it('never returns the old placeholder text on any failure path', async () => {
    for (const setup of [
      () => mockGoogleAI.generateContent.mockResolvedValue(null),
      () => mockGoogleAI.generateContent.mockResolvedValue('{"title":"T","idea":"cut'),
      () => mockGoogleAI.generateContent.mockRejectedValue(new Error('x')),
    ]) {
      mockGoogleAI.generateContent.mockReset();
      setup();
      const out = await generateContentIdea(['tiktok']);
      expect(JSON.stringify(out)).not.toMatch(/Content Idea|Create engaging content/);
    }
  });
});

describe('getFutureContentSuggestions', () => {
  // Suggestions used to cost one Gemini request each, carried a made-up
  // confidence (85 minus 2 per position) and a hardcoded impact/priority.
  const aiService = require('../../server/services/aiService');
  const { getFutureContentSuggestions } = require('../../server/services/contentHealthService');

  afterEach(() => jest.restoreAllMocks());

  it('asks for every idea in ONE batch call, cycling the platforms from the gaps', async () => {
    const spy = jest.spyOn(aiService, 'generateContentIdeaBatch').mockResolvedValue({ ideas: [], degraded: true });
    const gaps = [
      { category: 'platform', description: 'Not posting on tiktok', impact: 'medium', priority: 7 },
      { category: 'platform', description: 'Not posting on LinkedIn', impact: 'high', priority: 8 },
      { category: 'format', description: 'Missing video content', impact: 'high', priority: 9 },
    ];

    await getFutureContentSuggestions('user-1', gaps, 5);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(['tiktok', 'linkedin', 'tiktok', 'linkedin', 'tiktok']);
  });

  it('never asks for more than 10 ideas', async () => {
    const spy = jest.spyOn(aiService, 'generateContentIdeaBatch').mockResolvedValue({ ideas: [], degraded: true });
    await getFutureContentSuggestions('user-1', [], 1000);
    expect(spy.mock.calls[0][0]).toHaveLength(10);
  });

  it('carries real gap signals onto suggestions and reports confidence as unknown', async () => {
    jest.spyOn(aiService, 'generateContentIdeaBatch').mockResolvedValue({
      degraded: false,
      ideas: [
        { platform: 'tiktok', title: 'Hook', idea: 'A tiktok idea' },
        { platform: 'twitter', title: null, idea: 'An idea with no gap behind it' },
      ],
    });
    const gaps = [{ category: 'platform', description: 'Not posting on tiktok', impact: 'medium', priority: 7 }];

    const out = await getFutureContentSuggestions('user-1', gaps, 2);

    expect(out[0]).toMatchObject({
      platform: 'tiktok', idea: 'A tiktok idea', impact: 'medium', priority: 7,
      confidence: null, basedOnGap: 'Not posting on tiktok',
    });
    expect(out[1]).toMatchObject({ platform: 'twitter', impact: null, priority: null, confidence: null, basedOnGap: null });
  });

  it('returns an empty list, not blank suggestions, when no idea was produced', async () => {
    jest.spyOn(aiService, 'generateContentIdeaBatch').mockResolvedValue({ ideas: [], degraded: true });
    expect(await getFutureContentSuggestions('user-1', [], 3)).toEqual([]);
  });
});
