// The scheduler cron (routes/scheduler.js) stores the platform's post id on
// ScheduledPost.platformPostId. postToSocialMedia returns it as `externalId`,
// which the cron never read — every post got a `post-<timestamp>` placeholder
// and no analytics sync could find it. For TikTok the publish_id is also kept
// in metadata so syncTikTokAnalytics can resolve the video id later.

const mockTicks = [];
jest.mock('node-cron', () => ({
  schedule: jest.fn((_expr, fn) => { mockTicks.push(fn); return { start() {}, stop() {} }; }),
}));
jest.mock('../../server/services/socialMediaService', () => ({ postToSocialMedia: jest.fn() }));
jest.mock('../../server/services/socketService', () => ({ emitToUser: jest.fn() }));
jest.mock('../../server/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(null) }));

const mongoose = require('mongoose');
const ScheduledPost = require('../../server/models/ScheduledPost');
const SocialConnection = require('../../server/models/SocialConnection');
const { postToSocialMedia } = require('../../server/services/socialMediaService');

// The cron is stubbed out under NODE_ENV=test; load the route with another env
// so the real node-cron (mocked above) receives the tick function.
const prevEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
require('../../server/routes/scheduler');
process.env.NODE_ENV = prevEnv;
const tick = mockTicks[0];

async function seed(platform) {
  const userId = new mongoose.Types.ObjectId();
  await SocialConnection.collection.insertOne({
    userId, platform, platformUserId: 'pu', accessToken: 'enc', isActive: true,
  });
  return ScheduledPost.create({
    userId: String(userId), platform, status: 'scheduled',
    scheduledTime: new Date(Date.now() - 1000),
    content: { text: 'Hello #fun', mediaUrl: 'https://cdn.example.com/v.mp4', hashtags: ['fun'] },
  });
}

describe('scheduler cron → platformPostId', () => {
  it('has a tick function', () => expect(typeof tick).toBe('function'));

  it('TikTok: stores externalId (the video id) and keeps the publish_id in metadata', async () => {
    const post = await seed('tiktok');
    postToSocialMedia.mockResolvedValueOnce({
      success: true, platform: 'tiktok', externalId: '7296688264532561153',
      postUrl: 'https://www.tiktok.com/@maker/video/7296688264532561153', publishId: 'v_pub_file~v2-1.1',
    });
    await tick();
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.status).toBe('posted');
    expect(saved.platformPostId).toBe('7296688264532561153');
    expect(saved.metadata).toMatchObject({ tiktokPublishId: 'v_pub_file~v2-1.1' });
  });

  it('other platforms: externalId is stored instead of a post-<timestamp> placeholder', async () => {
    const post = await seed('twitter');
    postToSocialMedia.mockResolvedValueOnce({ success: true, platform: 'twitter', externalId: '1850000000000000000', postUrl: 'https://x.com/i/1' });
    await tick();
    const saved = await ScheduledPost.findById(post._id).lean();
    expect(saved.platformPostId).toBe('1850000000000000000');
    expect(saved.metadata?.tiktokPublishId).toBeUndefined();
  });
});
