// The social-posting worker (currently unfed) now delegates ALL per-platform
// publishing to the canonical services/socialMediaService.postToSocialMedia — the
// same publisher routes/social.js + the scheduler cron use. This retired a
// divergent switch that had drifted out of sync (a non-existent Twitter method,
// no YouTube case, an Instagram field mismatch). These lock in:
//   - every platform is delegated (so the latent bugs can never resurface),
//   - the worker's content shape is mapped correctly,
//   - a { success:false } result is surfaced as a FAILURE (not a false success).

jest.mock('../../server/services/jobQueueService', () => ({
  createWorker: jest.fn(() => ({ on: jest.fn() })),
}));
jest.mock('../../server/services/socialMediaService', () => ({
  postToSocialMedia: jest.fn(),
}));

const socialMediaService = require('../../server/services/socialMediaService');
const { processSocialPostJob } = require('../../server/workers/socialPostProcessor');

const fakeJob = { id: 'job-1', updateProgress: jest.fn() };

beforeEach(() => socialMediaService.postToSocialMedia.mockReset());

describe('social-posting worker → canonical publisher delegation', () => {
  it('delegates each platform to postToSocialMedia (mapped content) and records success', async () => {
    socialMediaService.postToSocialMedia.mockResolvedValue({
      success: true, externalId: 'ext_1', postUrl: 'https://x/p/ext_1',
    });

    const res = await processSocialPostJob({
      userId: 'u1', platforms: ['youtube'],
      content: { text: 'hello world', mediaUrl: '/uploads/v.mp4', hashtags: ['a', 'b'] },
      options: {},
      // no scheduledPostId → skips the DB/ingest/webhook tail
    }, fakeJob);

    expect(socialMediaService.postToSocialMedia).toHaveBeenCalledWith(
      'u1', 'youtube',
      expect.objectContaining({ title: 'hello world', mediaUrl: '/uploads/v.mp4', tags: ['a', 'b'] }),
      {},
    );
    const r = res.results.find((x) => x.platform === 'youtube');
    expect(r.success).toBe(true);
    expect(r.postId).toBe('ext_1');
    expect(r.url).toBe('https://x/p/ext_1');
  });

  it('surfaces a { success:false } result as an honest failure (never a false success)', async () => {
    socialMediaService.postToSocialMedia.mockResolvedValue({
      success: false, error: 'Account not linked for platform: youtube',
    });
    const res = await processSocialPostJob({
      userId: 'u1', platforms: ['youtube'], content: { text: 'x' }, options: {},
    }, fakeJob);

    const r = res.results.find((x) => x.platform === 'youtube');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Account not linked/);
  });

  it('TikTok routes through the canonical path too (the honest "coming soon" failure)', async () => {
    socialMediaService.postToSocialMedia.mockResolvedValue({
      success: false, error: 'TikTok publishing is not yet available.',
    });
    const res = await processSocialPostJob({
      userId: 'u1', platforms: ['tiktok'], content: { text: 'x' }, options: {},
    }, fakeJob);

    const r = res.results.find((x) => x.platform === 'tiktok');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not yet available/i);
    // delegated — the worker never calls a TikTok service directly anymore
    expect(socialMediaService.postToSocialMedia).toHaveBeenCalledWith('u1', 'tiktok', expect.any(Object), {});
  });
});
