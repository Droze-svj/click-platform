/**
 * contentGenerationService: long-form adaptation and gap ideas must not pass
 * off non-results as results.
 *
 * - generateContentFromLongForm read `content.content`, which on a Content
 *   document is an object, so the model was asked to adapt "[object Object]".
 *   Its fallback (aiService.generateContentAdaptation) returns the ORIGINAL text
 *   as the adaptation whenever the model fails, so a copy of the source came
 *   back as success. Cross-client templates use this path.
 * - generateContent called generateContentIdea(niche, category) — the function
 *   takes a platforms array — and read hook/hashtags it never returns.
 */

jest.mock('../../server/services/aiService', () => ({
  generateSocialContent: jest.fn(),
  generateBlogSummary: jest.fn(),
  generateViralIdeas: jest.fn(),
  generateContentAdaptation: jest.fn(),
  generateContentIdea: jest.fn(),
}));
jest.mock('../../server/services/contentAdaptationService', () => ({
  adaptForPlatform: jest.fn(),
  adaptContentForPlatform: jest.fn(),
}));
jest.mock('../../server/services/socketService', () => ({ emitToUser: jest.fn() }));
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const aiService = require('../../server/services/aiService');
const adapter = require('../../server/services/contentAdaptationService');
const { generateContentFromLongForm, generateContent } = require('../../server/services/contentGenerationService');

const SOURCE = { _id: 'c1', title: 'Morning routine', content: { text: 'My full morning routine, step by step.' } };

beforeEach(() => jest.clearAllMocks());

describe('generateContentFromLongForm', () => {
  it('adapts the text of a Content document, not "[object Object]"', async () => {
    aiService.generateSocialContent.mockResolvedValue({ twitter: { platform: 'twitter', text: 'A tighter tweet' } });
    await generateContentFromLongForm(SOURCE, { platform: 'twitter' });
    expect(aiService.generateSocialContent).toHaveBeenCalledWith(SOURCE.content.text, 'general', ['twitter']);
  });

  it('still accepts plain-string content from older callers', async () => {
    aiService.generateSocialContent.mockResolvedValue({ twitter: { platform: 'twitter', text: 'New tweet' } });
    await generateContentFromLongForm({ content: 'plain string body' }, { platform: 'twitter' });
    expect(aiService.generateSocialContent.mock.calls[0][0]).toBe('plain string body');
  });

  it('returns the generated post when the model produced one', async () => {
    aiService.generateSocialContent.mockResolvedValue({
      twitter: { platform: 'twitter', text: 'A tighter tweet', hashtags: ['#am'] },
    });
    expect(await generateContentFromLongForm(SOURCE, { platform: 'twitter' })).toEqual({
      success: true, posts: [{ platform: 'twitter', content: 'A tighter tweet', hashtags: ['#am'] }],
    });
    expect(adapter.adaptForPlatform).not.toHaveBeenCalled();
  });

  it('falls back to the honest adapter when generation returns nothing', async () => {
    aiService.generateSocialContent.mockResolvedValue({});
    adapter.adaptForPlatform.mockResolvedValue({
      content: 'Adapted for LinkedIn', hashtags: [], optimized: true, score: null, suggestions: [],
    });
    expect(await generateContentFromLongForm(SOURCE, { platform: 'linkedin' })).toEqual({
      success: true, posts: [{ platform: 'linkedin', content: 'Adapted for LinkedIn', hashtags: [] }],
    });
  });

  it('fails honestly instead of passing the ORIGINAL text off as an adaptation', async () => {
    aiService.generateSocialContent.mockResolvedValue({});
    adapter.adaptForPlatform.mockResolvedValue({
      content: SOURCE.content.text, hashtags: [], optimized: false, degraded: true, score: null, suggestions: [],
    });
    const out = await generateContentFromLongForm(SOURCE, { platform: 'linkedin' });
    expect(out.success).toBe(false);
    // The input-echoing adapter is no longer used at all.
    expect(aiService.generateContentAdaptation).not.toHaveBeenCalled();
  });

  it('does not accept a "generated" post that is just the source text', async () => {
    aiService.generateSocialContent.mockResolvedValue({ twitter: { platform: 'twitter', text: SOURCE.content.text } });
    adapter.adaptForPlatform.mockResolvedValue({ content: SOURCE.content.text, optimized: false, degraded: true });
    expect((await generateContentFromLongForm(SOURCE, { platform: 'twitter' })).success).toBe(false);
  });

  it('refuses a source with no text without calling any model', async () => {
    const out = await generateContentFromLongForm({ title: 'Video only', content: {} }, { platform: 'twitter' });
    expect(out).toEqual({ success: false, message: 'Source content has no text to adapt' });
    expect(aiService.generateSocialContent).not.toHaveBeenCalled();
    expect(adapter.adaptForPlatform).not.toHaveBeenCalled();
  });
});

describe('generateContent', () => {
  it('calls generateContentIdea with a platforms array', async () => {
    aiService.generateContentIdea.mockResolvedValue({ title: 'T', idea: 'I', platforms: ['tiktok'] });
    await generateContent({ category: 'format' }, { platform: 'tiktok' });
    expect(aiService.generateContentIdea).toHaveBeenCalledWith(['tiktok']);
  });

  it('reports failure instead of success with filler when no idea was produced', async () => {
    aiService.generateContentIdea.mockResolvedValue({ title: null, idea: null, platforms: ['twitter'], degraded: true });
    expect(await generateContent({}, {})).toEqual({ success: false, message: 'Could not generate content idea' });
  });

  it('returns the real idea text as the description', async () => {
    aiService.generateContentIdea.mockResolvedValue({ title: 'Hook', idea: 'Open with a question', platforms: ['twitter'] });
    expect(await generateContent({ category: 'topic', topic: 'mornings' }, {})).toEqual({
      success: true,
      content: { title: 'Hook', description: 'Open with a question', category: 'topic', topic: 'mornings', suggestedPosts: [] },
    });
  });
});
