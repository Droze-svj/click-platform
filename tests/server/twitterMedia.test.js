// TwitterSocialService — media is actually ATTACHED now (it used to be silently
// dropped). With a mediaUrl: upload the bytes (v1.uploadMedia) and attach
// media_ids to the v2 tweet. Without: a plain text tweet. If the media upload
// fails: an HONEST error (never a silent text-only post).

jest.mock('twitter-api-v2', () => {
  const client = { v1: { uploadMedia: jest.fn() }, v2: { tweet: jest.fn() } };
  return { TwitterApi: jest.fn(() => client), __client: client };
});
jest.mock('../../server/utils/downloadUtils', () => ({ streamDownload: jest.fn().mockResolvedValue({ bytes: 1 }) }));

const fs = require('fs');
const { __client: client } = require('twitter-api-v2');
const TwitterSocialService = require('../../server/services/TwitterSocialService');

const auth = { accessToken: 't', accessSecret: 's' };

describe('TwitterSocialService.postTweet — media attachment', () => {
  beforeEach(() => {
    client.v1.uploadMedia.mockReset().mockResolvedValue('MEDIA_ID_1');
    client.v2.tweet.mockReset().mockResolvedValue({ data: { id: 'tw_1' } });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('uploads media and attaches media_ids when a mediaUrl is present', async () => {
    const res = await TwitterSocialService.postTweet(auth, { title: 'Go', description: 'viral', mediaUrl: '/uploads/v.mp4', tags: ['x'] });
    expect(client.v1.uploadMedia).toHaveBeenCalledTimes(1);
    expect(client.v1.uploadMedia).toHaveBeenCalledWith(expect.stringContaining('uploads'), { mimeType: 'video/mp4' });
    expect(client.v2.tweet).toHaveBeenCalledWith(expect.any(String), { media: { media_ids: ['MEDIA_ID_1'] } });
    expect(res.id).toBe('tw_1');
  });

  it('posts a text-only tweet when there is no media (no upload)', async () => {
    const res = await TwitterSocialService.postTweet(auth, { title: 'Hi', description: 'there', tags: [] });
    expect(client.v1.uploadMedia).not.toHaveBeenCalled();
    expect(client.v2.tweet).toHaveBeenCalledWith(expect.any(String), undefined);
    expect(res.id).toBe('tw_1');
  });

  it('fails HONESTLY when media upload throws (never a silent text-only post)', async () => {
    client.v1.uploadMedia.mockRejectedValueOnce(new Error('media upload 400'));
    await expect(TwitterSocialService.postTweet(auth, { title: 'x', description: '', mediaUrl: '/uploads/v.mp4' }))
      .rejects.toThrow(/media upload 400/);
    expect(client.v2.tweet).not.toHaveBeenCalled(); // did not silently post text-only
  });
});
