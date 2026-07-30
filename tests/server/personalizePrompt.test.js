// personalizePrompt — the direct-import persona helper used by services that call
// the AI client without an injectable deps object (aiIdeation, contentSuggestions,
// advancedRepurposing, contentEngagementOptimizer, audienceEngagement).

jest.mock('../../server/services/personalizationService', () => ({
  buildPersonalizedSystemPrompt: jest.fn(),
}));

const svc = require('../../server/services/personalizationService');
const { personalizePrompt } = require('../../server/utils/applyPersona');

describe('personalizePrompt', () => {
  beforeEach(() => svc.buildPersonalizedSystemPrompt.mockReset());

  it('prepends the persona when a userId yields a non-empty system prompt', async () => {
    svc.buildPersonalizedSystemPrompt.mockResolvedValue('PERSONA-TEXT');
    const out = await personalizePrompt('TASK', { userId: 'u1', platform: 'tiktok', niche: 'fitness', stage: 'ideas' });
    expect(svc.buildPersonalizedSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', platform: 'tiktok', niche: 'fitness', stage: 'ideas' })
    );
    expect(out).toContain('PERSONA-TEXT');
    expect(out).toContain('── Task ──');
    expect(out).toContain('TASK');
  });

  it('returns the base prompt (no call) when userId is absent', async () => {
    const out = await personalizePrompt('TASK', { platform: 'tiktok' });
    expect(out).toBe('TASK');
    expect(svc.buildPersonalizedSystemPrompt).not.toHaveBeenCalled();
  });

  it('falls back to the base prompt when the persona is empty', async () => {
    svc.buildPersonalizedSystemPrompt.mockResolvedValue('   ');
    expect(await personalizePrompt('TASK', { userId: 'u1' })).toBe('TASK');
  });

  it('falls back to the base prompt when personalization throws (never blocks generation)', async () => {
    svc.buildPersonalizedSystemPrompt.mockRejectedValue(new Error('boom'));
    expect(await personalizePrompt('TASK', { userId: 'u1' })).toBe('TASK');
  });
});
