/**
 * PUT /api/video/captions/:contentId — persisting hand-edited captions.
 *
 * VideoCaptionEditor (mounted on /dashboard/content/[id]) has always sent this
 * request on Save, but no PUT handler existed, so every edit 404'd and was
 * silently lost.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const captionStore = require('../../../server/services/captionStore');

describe('PUT /api/video/captions/:contentId', () => {
  let owner, other, content, token, otherToken;

  beforeAll(async () => {
    owner = await new User({
      email: 'caption-save@example.com', password: 'password123',
      name: 'Caption Owner', emailVerified: true,
    }).save();
    other = await new User({
      email: 'caption-other@example.com', password: 'password123',
      name: 'Caption Other', emailVerified: true,
    }).save();
    token = jwt.sign({ userId: owner._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: other._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

    content = await new Content({
      userId: owner._id, type: 'video', title: 'Captioned', status: 'completed',
    }).save();

    await captionStore.saveSource(content._id, {
      language: 'en', format: 'srt', text: 'one two',
      segments: [{ start: 0, end: 1, text: 'one' }, { start: 1, end: 2, text: 'two' }],
      words: [{ word: 'one', start: 0, end: 1 }, { word: 'two', start: 1, end: 2 }],
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ _id: { $in: [owner._id, other._id] } }),
      Content.deleteOne({ _id: content._id }),
    ]);
  });

  const put = (tok, body) => request(app)
    .put(`/api/video/captions/${content._id}`)
    .set('Authorization', `Bearer ${tok}`)
    .send(body);

  it('persists edited segments and returns the updated captions', async () => {
    const segments = [
      { start: 0, end: 1.5, text: 'ONE edited' },
      { start: 1.5, end: 2, text: 'TWO edited' },
    ];
    const res = await put(token, { segments, language: 'en' });

    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(data.segments).toHaveLength(2);
    expect(data.text).toBe('ONE edited TWO edited');
    expect(data.captions).toContain('ONE edited');

    // and it is actually stored, not just echoed back
    const stored = await captionStore.getSource(content._id);
    expect(stored.text).toBe('ONE edited TWO edited');
    expect(stored.segments[0].text).toBe('ONE edited');
  });

  it('rejects malformed segments rather than storing unrenderable captions', async () => {
    for (const bad of [
      { segments: [] },
      { segments: [{ start: 0, end: 1 }] },                       // no text
      { segments: [{ start: 'x', end: 1, text: 'a' }] },          // non-numeric
      { segments: [{ start: 5, end: 2, text: 'a' }] },            // end < start
    ]) {
      const res = await put(token, bad);
      expect(res.status).toBe(400);
    }
  });

  it("does not let another user write someone else's captions", async () => {
    const res = await put(otherToken, {
      segments: [{ start: 0, end: 1, text: 'hijacked' }],
    });
    expect(res.status).toBe(404);

    const stored = await captionStore.getSource(content._id);
    expect(stored.text).not.toContain('hijacked');
  });
});
