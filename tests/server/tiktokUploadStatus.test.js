// Honesty guard for uploadVideoToTikTok's return.
//
// Completing the TikTok init + byte upload does NOT mean the video is live —
// TikTok processes/reviews it asynchronously (and for unaudited apps it can land
// in the creator's drafts). The method used to claim status:'published' and a
// FABRICATED public URL. These lock in the honest reality: status:'processing'
// and url:null (the real URL isn't known until processing completes).

jest.mock('axios');
const axios = require('axios');
const fs = require('fs');
const OAuthService = require('../../server/services/oauthService');
const tiktok = require('../../server/services/tiktokOAuthService');

describe('uploadVideoToTikTok — honest status + url', () => {
  beforeEach(() => {
    jest.spyOn(OAuthService, 'getSocialCredentials').mockResolvedValue({ accessToken: 'tok' });
    jest.spyOn(fs, 'statSync').mockReturnValue({ size: 2048 });
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fakevideo'));
    // init → returns publish_id + upload_url; upload PUT → ok
    axios.post.mockResolvedValue({ data: { data: { publish_id: 'pub_xyz', upload_url: 'https://upload.tiktokapis.com/x' } } });
    axios.put.mockResolvedValue({ data: {} });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports processing (NOT published) and does not fabricate a URL', async () => {
    const res = await tiktok.uploadVideoToTikTok('user-1', '/tmp/clip.mp4');

    expect(res.id).toBe('pub_xyz');
    expect(res.publishId).toBe('pub_xyz');
    // the honesty assertions:
    expect(res.status).toBe('processing');
    expect(res.status).not.toBe('published');
    expect(res.url).toBeNull();
  });
});
