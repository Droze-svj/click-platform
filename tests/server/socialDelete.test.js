// Regression: socialMediaService.deleteFromSocial (the A/B "auto-killer", called
// from abSwarmService) dispatched to per-platform delete methods, but
// YouTubeSocialService.deleteVideo and MetaSocialService.deletePost did NOT exist
// → a runtime "X is not a function" crash for youtube/instagram/facebook. These
// lock in that every platform now returns an HONEST result (no crash, no fake
// success).

jest.mock('../../server/services/oauthService', () => ({
  getSocialCredentials: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
}));

const { deleteFromSocial } = require('../../server/services/socialMediaService');

describe('socialMediaService.deleteFromSocial — no crash, honest result', () => {
  it.each(['youtube', 'instagram', 'facebook', 'tiktok'])(
    '%s delete returns an honest failure (never "is not a function")',
    async (platform) => {
      const res = await deleteFromSocial('user-1', platform, 'ext-123');
      expect(res).toBeDefined();
      expect(res.success).toBe(false);
      expect(typeof res.message).toBe('string');
      expect(res.message.length).toBeGreaterThan(0);
    },
  );

  it('an unknown platform still throws a clear "not supported" error (not a crash)', async () => {
    await expect(deleteFromSocial('user-1', 'myspace', 'ext-1')).rejects.toThrow(/Deletion not supported/i);
  });
});
