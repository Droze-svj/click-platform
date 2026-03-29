const socialMediaService = require('../../server/services/socialMediaService');
const TikTokSocialService = require('../../server/services/TikTokSocialService');
const YouTubeSocialService = require('../../server/services/YouTubeSocialService');
const TwitterSocialService = require('../../server/services/TwitterSocialService');
const Content = require('../../server/models/Content');
const OAuthService = require('../../server/services/OAuthService');

// Mock dependencies
jest.mock('../../server/services/TikTokSocialService');
jest.mock('../../server/services/YouTubeSocialService');
jest.mock('../../server/services/TwitterSocialService');
jest.mock('../../server/services/OAuthService');
jest.mock('../../server/models/Content');
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Social Media Integration (API Bridge)', () => {
  const userId = 'user_abc';
  const contentId = 'content_xyz';
  const mockContentData = {
    title: 'Test Post',
    description: 'This is a test post for 2026 Sovereign Systems',
    mediaUrl: 'https://cdn.click.ai/videos/test.mp4',
    tags: ['#sovereign', '#ai']
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('postToSocial Bridge', () => {
    it('should successfully dispatch to TikTok and update Content model', async () => {
      // Mock OAuth credentials
      OAuthService.getSocialCredentials.mockResolvedValue({ accessToken: 'tk-token-123' });
      
      // Mock TikTok success
      TikTokSocialService.postToTikTok.mockResolvedValue({
        id: 'tt_post_1',
        url: 'https://tiktok.com/@user/video/1'
      });
      
      // Mock Content update
      Content.findByIdAndUpdate.mockResolvedValue({ _id: contentId });

      const result = await socialMediaService.postToSocial(userId, 'tiktok', mockContentData, contentId);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('tiktok');
      expect(TikTokSocialService.postToTikTok).toHaveBeenCalled();
      expect(Content.findByIdAndUpdate).toHaveBeenCalledWith(contentId, expect.objectContaining({
        $push: { 'generatedContent.socialPosts': expect.any(Object) }
      }));
    });

    it('should successfully dispatch to YouTube and update Content model', async () => {
      OAuthService.getSocialCredentials.mockResolvedValue({ accessToken: 'yt-token-456' });
      
      YouTubeSocialService.uploadToYouTube.mockResolvedValue({
        id: 'yt_vid_1',
        url: 'https://youtube.com/watch?v=1'
      });
      
      Content.findByIdAndUpdate.mockResolvedValue({ _id: contentId });

      const result = await socialMediaService.postToSocial(userId, 'youtube', mockContentData, contentId);

      expect(result.success).toBe(true);
      expect(result.platform).toBe('youtube');
      expect(YouTubeSocialService.uploadToYouTube).toHaveBeenCalled();
    });

    it('should return error if account is not linked in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      OAuthService.getSocialCredentials.mockResolvedValue(null);

      const result = await socialMediaService.postToSocial(userId, 'tiktok', mockContentData, contentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Account not linked');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});
