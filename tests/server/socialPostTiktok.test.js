// Regression: TikTok was never handled in the social-posting worker, so every
// scheduled TikTok post failed with a generic "Unsupported platform" (the
// tiktokOAuthService.postToTikTok upload helper existed but was never called).
// These lock in: tiktok now routes to the real upload, and a misconfigured/no-
// file case fails SPECIFICALLY + honestly (success:false) — never a fake success.

// createWorker runs at module load — stub it so requiring the worker doesn't spin
// a real BullMQ worker / hit Redis.
jest.mock('../../server/services/jobQueueService', () => ({
  createWorker: jest.fn(() => ({ on: jest.fn() })),
}));

jest.mock('../../server/services/tiktokOAuthService', () => ({
  isConfigured: jest.fn(() => true),
  postToTikTok: jest.fn(async () => ({
    id: 'tt_pub_1', status: 'published', url: 'https://www.tiktok.com/@u/video/tt_pub_1',
  })),
}));

const tiktokOAuth = require('../../server/services/tiktokOAuthService');
const { processSocialPostJob } = require('../../server/workers/socialPostProcessor');

const fakeJob = { id: 'job-1', updateProgress: jest.fn() };

beforeEach(() => {
  tiktokOAuth.isConfigured.mockReturnValue(true);
  tiktokOAuth.postToTikTok.mockClear();
});

describe('social-posting worker — TikTok dispatch', () => {
  it('routes a tiktok post to the real postToTikTok upload and records success', async () => {
    const res = await processSocialPostJob({
      userId: 'user-1',
      platforms: ['tiktok'],
      content: { text: 'go viral', videoPath: '/tmp/clip.mp4' },
      options: {},
      // no scheduledPostId → skips the DB/ingest/webhook tail, keeps the test pure
    }, fakeJob);

    expect(tiktokOAuth.postToTikTok).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ videoPath: '/tmp/clip.mp4' }),
    );
    const tt = res.results.find((r) => r.platform === 'tiktok');
    expect(tt.success).toBe(true);
    expect(tt.postId).toBe('tt_pub_1');
    expect(res.success).toBe(true);
  });

  it('fails SPECIFICALLY + honestly (not "Unsupported platform") when TikTok is unconfigured', async () => {
    tiktokOAuth.isConfigured.mockReturnValue(false);
    const res = await processSocialPostJob({
      userId: 'user-1',
      platforms: ['tiktok'],
      content: { text: 'x' },
      options: {},
    }, fakeJob);

    const tt = res.results.find((r) => r.platform === 'tiktok');
    expect(tt.success).toBe(false);
    expect(tt.error).toMatch(/TikTok OAuth not configured/i);
    expect(tt.error).not.toMatch(/Unsupported platform/i);
    expect(tiktokOAuth.postToTikTok).not.toHaveBeenCalled();
  });

  it('surfaces an honest failure (never fake success) when the upload throws', async () => {
    tiktokOAuth.postToTikTok.mockRejectedValueOnce(new Error('TikTok requires a valid video file path for publishing'));
    const res = await processSocialPostJob({
      userId: 'user-1',
      platforms: ['tiktok'],
      content: { text: 'x', mediaUrl: 'https://cdn.example.com/clip.mp4' },
      options: {},
    }, fakeJob);

    const tt = res.results.find((r) => r.platform === 'tiktok');
    expect(tt.success).toBe(false);
    expect(tt.error).toMatch(/valid video file path/i);
  });
});
