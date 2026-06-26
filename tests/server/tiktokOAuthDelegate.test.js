// tiktokOAuthService.postToTikTok / uploadVideoToTikTok are thin wrappers: resolve
// the user's stored token, then delegate to the ONE canonical implementation in
// TikTokSocialService. This keeps the OAuth-route path and the live publish path
// running the same correct code (no drift). These lock in that delegation.

jest.mock('../../server/services/TikTokSocialService', () => ({
  postToTikTok: jest.fn().mockResolvedValue({ id: 'pub_1', status: 'processing', url: null }),
  uploadVideoToTikTok: jest.fn().mockResolvedValue({ id: 'pub_1', status: 'processing', url: null }),
}));
jest.mock('../../server/services/oauthService', () => ({
  getSocialCredentials: jest.fn(),
}));

const OAuthService = require('../../server/services/oauthService');
const TikTokSocial = require('../../server/services/TikTokSocialService');
const tiktok = require('../../server/services/tiktokOAuthService');

beforeEach(() => {
  OAuthService.getSocialCredentials.mockReset().mockResolvedValue({ accessToken: 'user-token' });
  TikTokSocial.postToTikTok.mockClear();
  TikTokSocial.uploadVideoToTikTok.mockClear();
});

describe('tiktokOAuthService delegates to the canonical TikTokSocialService', () => {
  it('postToTikTok fetches the user token and delegates (mediaUrl + caption→title)', async () => {
    await tiktok.postToTikTok('user-1', { mediaUrl: 'https://x/v.mp4', caption: 'hi' });
    expect(OAuthService.getSocialCredentials).toHaveBeenCalledWith('user-1', 'tiktok');
    expect(TikTokSocial.postToTikTok).toHaveBeenCalledWith(
      { accessToken: 'user-token' },
      expect.objectContaining({ mediaUrl: 'https://x/v.mp4', title: 'hi' }),
    );
  });

  it('uploadVideoToTikTok delegates with the token + caption', async () => {
    await tiktok.uploadVideoToTikTok('user-1', '/tmp/v.mp4', 'My cap');
    expect(TikTokSocial.uploadVideoToTikTok).toHaveBeenCalledWith('user-token', '/tmp/v.mp4', { caption: 'My cap' });
  });

  it('throws honestly when the account is not connected (no token)', async () => {
    OAuthService.getSocialCredentials.mockResolvedValue(null);
    await expect(tiktok.postToTikTok('user-1', { mediaUrl: 'https://x/v.mp4' }))
      .rejects.toThrow(/No TikTok account connected/);
    expect(TikTokSocial.postToTikTok).not.toHaveBeenCalled();
  });
});
