/**
 * aiService.generateContentIdeaBatch — several content ideas from ONE model call.
 *
 * GET /api/content-operations/health/suggestions used to call Gemini once per
 * suggestion (10 by default) on a key whose free tier allows 20 requests a day.
 * The batch asks once for an array and keeps only complete, distinct ideas for
 * the platforms that were requested.
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

const { generateContentIdeaBatch } = require('../../server/services/aiService');

const NOTHING = { ideas: [], degraded: true };

describe('generateContentIdeaBatch', () => {
  beforeEach(() => {
    mockGoogleAI.generateContent.mockReset();
    mockGoogleAI.isConfigured = true;
  });

  it('makes ONE model call for the whole batch', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify([
      { platform: 'tiktok', title: 'A', idea: 'one' },
      { platform: 'linkedin', title: 'B', idea: 'two' },
      { platform: 'tiktok', title: 'C', idea: 'three' },
    ]));

    const out = await generateContentIdeaBatch(['tiktok', 'linkedin', 'tiktok']);

    expect(mockGoogleAI.generateContent).toHaveBeenCalledTimes(1);
    expect(out).toEqual({
      degraded: false,
      ideas: [
        { platform: 'tiktok', title: 'A', idea: 'one' },
        { platform: 'linkedin', title: 'B', idea: 'two' },
        { platform: 'tiktok', title: 'C', idea: 'three' },
      ],
    });
  });

  it('accepts the array wrapped in an { ideas } object', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('{"ideas":[{"platform":"tiktok","title":"A","idea":"one"}]}');
    expect(await generateContentIdeaBatch(['tiktok'])).toEqual({
      degraded: false, ideas: [{ platform: 'tiktok', title: 'A', idea: 'one' }],
    });
  });

  it('drops incomplete items, platforms nobody asked for, and duplicates', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify([
      { platform: 'tiktok', title: 'ok', idea: 'keep me' },
      { platform: 'tiktok', title: 'no idea text' },
      { platform: 'facebook', title: 'not requested', idea: 'wrong platform' },
      { platform: 'TikTok', title: 'dupe', idea: 'Keep me' },
      { platform: 'tiktok', title: 'blank', idea: '   ' },
    ]));

    expect(await generateContentIdeaBatch(['tiktok', 'tiktok'])).toEqual({
      degraded: false, ideas: [{ platform: 'tiktok', title: 'ok', idea: 'keep me' }],
    });
  });

  it('never returns more ideas than were asked for', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({ platform: 'tiktok', title: `T${i}`, idea: `idea ${i}` }))
    ));
    const out = await generateContentIdeaBatch(['tiktok', 'tiktok']);
    expect(out.ideas).toHaveLength(2);
  });

  it('keeps the finished ideas from a response that was cut off', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(
      '[{"platform":"tiktok","title":"A","idea":"one"},{"platform":"tiktok","title":"B","idea":"tw'
    );
    expect(await generateContentIdeaBatch(['tiktok', 'tiktok'])).toEqual({
      degraded: false, ideas: [{ platform: 'tiktok', title: 'A', idea: 'one' }],
    });
  });

  it('reports a missing title as null instead of inventing one', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('[{"platform":"tiktok","idea":"untitled idea"}]');
    expect((await generateContentIdeaBatch(['tiktok'])).ideas[0].title).toBeNull();
  });

  it('is degraded with no ideas when the upstream call fails (googleAI returns null)', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(null);
    expect(await generateContentIdeaBatch(['tiktok'])).toEqual(NOTHING);
  });

  it('is degraded when the model answers with something that is not JSON', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('Sorry, I cannot help with that.');
    expect(await generateContentIdeaBatch(['tiktok'])).toEqual(NOTHING);
  });

  it('is degraded when the model call throws', async () => {
    mockGoogleAI.generateContent.mockRejectedValue(new Error('boom'));
    expect(await generateContentIdeaBatch(['tiktok'])).toEqual(NOTHING);
  });

  it('does not call the model when AI is unconfigured or nothing was asked for', async () => {
    mockGoogleAI.isConfigured = false;
    expect(await generateContentIdeaBatch(['tiktok'])).toEqual(NOTHING);
    mockGoogleAI.isConfigured = true;
    expect(await generateContentIdeaBatch([])).toEqual(NOTHING);
    expect(await generateContentIdeaBatch('tiktok')).toEqual(NOTHING);
    expect(mockGoogleAI.generateContent).not.toHaveBeenCalled();
  });

  it('sizes the output budget to the batch', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('[]');
    await generateContentIdeaBatch(['tiktok']);
    await generateContentIdeaBatch(Array(10).fill('tiktok'));
    expect(mockGoogleAI.generateContent.mock.calls[0][1]).toEqual({ maxTokens: 380 });
    expect(mockGoogleAI.generateContent.mock.calls[1][1]).toEqual({ maxTokens: 2000 });
  });
});
