/**
 * Clip metadata survives a save.
 *
 * generatedContent.shortVideos used to declare only url/thumbnail/duration/
 * caption/platform/highlight, so strict mode silently dropped everything else:
 * a rating never stuck, a "removed" clip came back on reload, a published clip
 * offered to publish again, and every clip in the hub read "Unrated".
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('clip hub metadata persistence', () => {
  let owner, content, token, keepId, dropId;

  beforeAll(async () => {
    owner = await new User({
      email: 'clip-meta@example.com', password: 'password123',
      name: 'Clip Owner', emailVerified: true,
    }).save();
    token = jwt.sign({ userId: owner._id }, getJwtSecret(), { expiresIn: '1h' });

    content = await new Content({
      userId: String(owner._id), type: 'video', title: 'Source', status: 'completed',
      originalFile: { url: '/uploads/source.mp4', duration: 120 },
      generatedContent: {
        shortVideos: [
          {
            url: '/uploads/clip-a.mp4', duration: 20, caption: 'A', platform: 'tiktok',
            viralScore: 81, hookScore: 77, sentimentEnergy: 7, viralMomentCount: 3,
            hookText: 'Wait for it', startTime: 10, endTime: 30, aiGenerated: true,
            recommendedCaptionVariants: { tiktok: ['one', 'two', 'three'] },
          },
          { url: '/uploads/clip-b.mp4', duration: 15, caption: 'B', platform: 'reels' },
        ],
      },
    }).save();
    keepId = String(content.generatedContent.shortVideos[0]._id);
    dropId = String(content.generatedContent.shortVideos[1]._id);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteOne({ _id: owner._id }),
      Content.deleteOne({ _id: content._id }),
    ]);
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('stores the scores the pipeline computed', async () => {
    const res = await auth(request(app).get(`/api/video/clips/hub/${content._id}`));
    expect(res.status).toBe(200);
    const clip = res.body.data.items.find((c) => String(c.id) === keepId);
    expect(clip.viralScore).toBe(81);
    expect(clip.hookScore).toBe(77);
    expect(clip.hookText).toBe('Wait for it');
    expect(clip.startTime).toBe(10);
    expect(clip.endTime).toBe(30);
    expect(clip.recommendedCaptionVariants).toEqual({ tiktok: ['one', 'two', 'three'] });
  });

  it('keeps a rating', async () => {
    const res = await auth(request(app).post(`/api/video/clips/${content._id}/${keepId}/rate`)).send({ rating: 4 });
    expect(res.status).toBe(200);
    const stored = await Content.findById(content._id).lean();
    expect(stored.generatedContent.shortVideos[0].rating).toBe(4);
  });

  it('keeps a removed clip removed', async () => {
    const res = await auth(request(app).delete(`/api/video/clips/${content._id}/${dropId}`));
    expect(res.status).toBe(200);
    const hub = await auth(request(app).get(`/api/video/clips/hub/${content._id}`));
    const ids = hub.body.data.items.map((c) => String(c.id));
    expect(ids).toContain(keepId);
    expect(ids).not.toContain(dropId);
  });

  it('keeps the publish state and returns it', async () => {
    const res = await auth(request(app).post(`/api/video/clips/${content._id}/${keepId}/publish`))
      .send({ platform: 'tiktok', caption: 'my caption', originalCaption: 'one' });
    expect(res.status).toBe(200);
    const hub = await auth(request(app).get(`/api/video/clips/hub/${content._id}`));
    const clip = hub.body.data.items.find((c) => String(c.id) === keepId);
    expect(clip.published).toBe(true);
    expect(clip.publishedAt).toBeTruthy();
    expect(clip.publishedPlatform).toBe('tiktok');
    expect(clip.rating).toBe(4);
  });

  it('persists Smart Publish suggestions written with a positional update', async () => {
    await Content.updateOne(
      { _id: content._id, 'generatedContent.shortVideos.url': '/uploads/clip-a.mp4' },
      { $set: {
        'generatedContent.shortVideos.$.recommendedSlots': [{ platform: 'tiktok', isoTime: '2026-10-25T19:00:00Z' }],
        'generatedContent.shortVideos.$.publishRationale': 'evening peak',
      } },
    );
    const stored = await Content.findById(content._id).lean();
    expect(stored.generatedContent.shortVideos[0].recommendedSlots).toHaveLength(1);
    expect(stored.generatedContent.shortVideos[0].publishRationale).toBe('evening peak');
  });
});
