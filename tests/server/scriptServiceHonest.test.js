/**
 * scriptService — no canned templates, and the creator's persona on the prompt.
 *
 * Every generator used to fall back to a fixed template when the model returned
 * nothing, which the route then saved as the user's script. They now return null
 * (the route answers "unavailable"). The podcast, blog and email generators also
 * prompted with no creator context at all; they now carry the creator's persona.
 */

const mockGoogleAI = { generateContent: jest.fn(), isConfigured: true };
jest.mock('../../server/utils/googleAI', () => mockGoogleAI);
const mockPersonalizePrompt = jest.fn();
jest.mock('../../server/utils/applyPersona', () => ({
  personalizePrompt: (...args) => mockPersonalizePrompt(...args),
  applyPersona: jest.fn(),
}));
jest.mock('../../server/services/marketingKnowledge', () => ({
  buildSystemPrompt: () => 'SYSTEM',
  getTopPerformingPlaybook: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../server/services/liveTrendService', () => ({
  getLatestTrends: jest.fn().mockResolvedValue([]),
  getTrendStrategy: jest.fn().mockResolvedValue({ mold: 'listicle', explanation: 'lists win', recommendedTone: 'bold' }),
}));

const scriptService = require('../../server/services/scriptService');

describe('scriptService', () => {
  beforeEach(() => {
    mockGoogleAI.generateContent.mockReset();
    mockPersonalizePrompt.mockReset();
    mockPersonalizePrompt.mockImplementation(async (prompt) => `PERSONA\n${prompt}`);
  });

  it.each([
    'generateYouTubeScript',
    'generatePodcastScript',
    'generateSocialMediaScript',
    'generateBlogScript',
    'generateEmailScript',
  ])('%s returns null — not a template — when the model returns nothing', async (name) => {
    mockGoogleAI.generateContent.mockResolvedValue(null);

    await expect(scriptService[name]('meal prep', { userId: 'u1' })).resolves.toBeNull();
  });

  it('returns null when the reply is not usable JSON', async () => {
    mockGoogleAI.generateContent.mockResolvedValue('Sorry, I cannot help with that.');

    await expect(scriptService.generateEmailScript('meal prep', { userId: 'u1' })).resolves.toBeNull();
  });

  it('writes the podcast with the script-writer persona for the creator', async () => {
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify({
      introduction: 'Intro', mainPoints: [{ title: 'P1', content: 'C1' }], conclusion: 'End',
    }));

    const script = await scriptService.generatePodcastScript('meal prep', { userId: 'u1', targetAudience: 'fitness' });

    expect(script.script).toContain('P1');
    expect(mockPersonalizePrompt).toHaveBeenCalledWith(
      expect.stringContaining('meal prep'),
      expect.objectContaining({ userId: 'u1', niche: 'fitness', role: 'script-writer' })
    );
    expect(mockGoogleAI.generateContent.mock.calls[0][0]).toMatch(/^PERSONA/);
  });

  it.each([
    ['generateBlogScript', { title: 'B', introduction: 'Intro', sections: [{ title: 'S1', content: 'C1' }], conclusion: 'End' }],
    ['generateEmailScript', { subject: 'Hi', opening: 'Hello', body: 'Body', callToAction: 'Reply' }],
  ])('%s carries the creator persona in the copywriter voice', async (name, reply) => {
    mockGoogleAI.generateContent.mockResolvedValue(JSON.stringify(reply));

    const script = await scriptService[name]('meal prep', { userId: 'u1', targetAudience: 'fitness' });

    expect(script).not.toBeNull();
    expect(mockPersonalizePrompt).toHaveBeenCalledWith(
      expect.stringContaining('meal prep'),
      expect.objectContaining({ userId: 'u1', role: 'copywriter' })
    );
    expect(mockGoogleAI.generateContent.mock.calls[0][0]).toMatch(/^PERSONA/);
  });
});
