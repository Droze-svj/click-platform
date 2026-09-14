/**
 * Caption routes — two regressions, proven at the HTTP boundary:
 *
 * 1. A malformed content id used to flow into Content.findOne, throw a Mongoose
 *    CastError, and come back as a 500: a caller's typo reported as a server
 *    fault. Every caption route now answers 400.
 * 2. Editing captions used to wipe every word timing whenever the edit changed
 *    the segment COUNT, silently downgrading karaoke captions to static blocks.
 *    The helper is unit-tested; this proves the PUT route actually uses it.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const captionStore = require('../../../server/services/captionStore');

const sign = (u) => jwt.sign({ userId: u._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });

describe('caption routes — malformed content id', () => {
  let user, token;

  beforeAll(async () => {
    user = await new User({
      email: 'caption-idval@example.com', password: 'password123',
      name: 'Caption Idval', emailVerified: true,
    }).save();
    token = sign(user);
  });

  afterAll(async () => {
    await User.deleteOne({ _id: user._id });
  });

  it.each([
    ['get', '/api/video/captions/not-an-id'],
    ['put', '/api/video/captions/not-an-id'],
    ['post', '/api/video/captions/not-an-id/translate'],
    ['get', '/api/video/captions/not-an-id/in-language?language=es'],
  ])('%s %s answers 400, not a 500', async (method, url) => {
    const res = await request(app)[method](url)
      .set('Authorization', `Bearer ${token}`)
      .send({ segments: [{ start: 0, end: 1, text: 'x' }], targetLanguage: 'es' });
    expect(res.status).toBe(400);
  });

  it('POST /generate answers 400 for a malformed contentId in the body', async () => {
    const res = await request(app)
      .post('/api/video/captions/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentId: 'not-an-id' });
    expect(res.status).toBe(400);
  });

  it('still requires authentication before anything else', async () => {
    const res = await request(app).get('/api/video/captions/not-an-id');
    expect([401, 403]).toContain(res.status);
  });
});

describe('PUT /api/video/captions/:contentId — word timings survive an edit', () => {
  let owner, token, content;

  const WORDS = [
    { word: 'one', start: 0, end: 1 },
    { word: 'two', start: 1, end: 2 },
    { word: 'three', start: 2, end: 3 },
    { word: 'four', start: 3, end: 4 },
  ];

  beforeAll(async () => {
    owner = await new User({
      email: 'caption-words@example.com', password: 'password123',
      name: 'Caption Words', emailVerified: true,
    }).save();
    token = sign(owner);
    content = await new Content({
      userId: owner._id, type: 'video', title: 'Karaoke', status: 'completed',
    }).save();
  });

  beforeEach(async () => {
    await captionStore.saveSource(content._id, {
      language: 'en', format: 'srt', text: 'one two three four',
      segments: [{ start: 0, end: 2, text: 'one two' }, { start: 2, end: 4, text: 'three four' }],
      words: WORDS,
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteOne({ _id: owner._id }),
      Content.deleteOne({ _id: content._id }),
    ]);
  });

  const put = (segments) => request(app)
    .put(`/api/video/captions/${content._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ segments, language: 'en' });

  it('keeps every word when a segment is SPLIT (the count changed 2 → 3)', async () => {
    // Exactly the edit the old rule punished: same spoken span, one more segment.
    const res = await put([
      { start: 0, end: 1, text: 'one' },
      { start: 1, end: 2, text: 'two' },
      { start: 2, end: 4, text: 'three four' },
    ]);
    expect(res.status).toBe(200);

    const stored = await captionStore.getSource(content._id);
    expect(stored.words).toHaveLength(4);
    // Timings are the spoken ones, untouched — not re-estimated.
    expect(stored.words[2]).toMatchObject({ word: 'three', start: 2, end: 3 });
  });

  it('drops only the words whose region the edit removed', async () => {
    const res = await put([{ start: 0, end: 2, text: 'one two' }]);
    expect(res.status).toBe(200);

    const stored = await captionStore.getSource(content._id);
    expect(stored.words.map((w) => w.word)).toEqual(['one', 'two']);
  });

  it('GET returns the words, so the editor does not re-transcribe to get them', async () => {
    const res = await request(app)
      .get(`/api/video/captions/${content._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const data = res.body.data ?? res.body;
    expect(Array.isArray(data.words)).toBe(true);
    expect(data.words).toHaveLength(4);
  });
});
