// Content detail page: the versions tab called /versions/content/:id (no such
// route) and restored by version _id; any user could read anyone's versions;
// comments had no reaction route (and no reactions field, so the list crashed);
// the translations list sat behind /content/:contentId/:language, which took
// "translations" as a language; and the scheduler's free-text "Generate in
// <language>" always 400'd because /translate required a contentId.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/utils/googleAI', () => {
  const actual = jest.requireActual('../../../server/utils/googleAI');
  return {
    ...actual,
    isConfigured: true,
    generateContent: jest.fn(async (prompt) => (
      String(prompt).includes('Translate the following text') ? 'Hola, ¿qué tal?' : 'en'
    )),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const Team = require('../../../server/models/Team');
const Comment = require('../../../server/models/Comment');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const googleAI = require('../../../server/utils/googleAI');

const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

describe('content detail fixes', () => {
  let owner; let other; let token; let otherToken; let content;

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ['cdf-a@example.com', 'cdf-b@example.com'] } });
    owner = await new User({ email: 'cdf-a@example.com', password: 'password123', name: 'Owner', emailVerified: true }).save();
    other = await new User({ email: 'cdf-b@example.com', password: 'password123', name: 'Other', emailVerified: true }).save();
    token = sign(owner); otherToken = sign(other);
    content = await Content.create({ userId: String(owner._id), type: 'article', title: 'v1 title', description: 'd' });
  });

  const as = (t) => (r) => r.set('Authorization', `Bearer ${t}`);

  describe('versions', () => {
    it('lists, restores by number, and is owner-only', async () => {
      const created = await as(token)(request(app).post(`/api/versions/${content._id}/create`)).send({ changeSummary: 'first' });
      expect(created.status).toBe(201);
      await Content.updateOne({ _id: content._id }, { title: 'v2 title' });

      const list = await as(token)(request(app).get(`/api/versions/${content._id}`));
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({ version: 1, changeSummary: 'first', title: 'v1 title' });

      // Another user can neither read nor restore.
      expect((await as(otherToken)(request(app).get(`/api/versions/${content._id}`))).status).toBe(404);
      expect((await as(otherToken)(request(app).get(`/api/versions/${content._id}/1`))).status).toBe(404);
      expect((await as(otherToken)(request(app).post(`/api/versions/${content._id}/1/restore`))).status).toBe(404);

      const restored = await as(token)(request(app).post(`/api/versions/${content._id}/1/restore`));
      expect(restored.status).toBe(200);
      expect((await Content.findById(content._id)).title).toBe('v1 title');
    });

    it('compare is not swallowed by /:contentId/:versionNumber', async () => {
      const res = await as(token)(request(app).get(`/api/versions/${content._id}/compare`));
      expect(res.status).toBe(400); // missing version1/version2 — reached the compare handler
    });

    it('a missing version is a 404, not a 500', async () => {
      const res = await as(token)(request(app).post(`/api/versions/${content._id}/99/restore`));
      expect(res.status).toBe(404);
    });
  });

  describe('comment reactions', () => {
    it('toggles a reaction for team members only', async () => {
      const team = await Team.create({ name: 'T', ownerId: String(owner._id), members: [] });
      const comment = await Comment.create({
        userId: String(owner._id), userName: 'Owner', teamId: team._id,
        entityType: 'content', entityId: String(content._id), text: 'hi',
      });

      const on = await as(token)(request(app).post(`/api/comments/${comment._id}/reaction`)).send({ type: 'like' });
      expect(on.status).toBe(200);
      expect(on.body.data.reactions).toEqual([{ userId: String(owner._id), type: 'like' }]);

      const off = await as(token)(request(app).post(`/api/comments/${comment._id}/reaction`)).send({ type: 'like' });
      expect(off.body.data.reactions).toEqual([]);

      expect((await as(otherToken)(request(app).post(`/api/comments/${comment._id}/reaction`)).send({ type: 'like' })).status).toBe(404);
      expect((await as(token)(request(app).post(`/api/comments/${comment._id}/reaction`)).send({ type: 'nope' })).status).toBe(400);
    });
  });

  it('optimal posting times are not always empty', async () => {
    const res = await as(token)(request(app).get('/api/social/optimal-times?platform=instagram'));
    expect(res.status).toBe(200);
    expect(res.body.data.optimalTimes.length).toBeGreaterThan(0);
    expect(res.body.data.optimalTimes[0]).toEqual(expect.objectContaining({ start: expect.any(Number), end: expect.any(Number), label: expect.any(String) }));
  });

  describe('translation', () => {
    it('the translations list is reachable (not read as a language code)', async () => {
      const res = await as(token)(request(app).get(`/api/translation/content/${content._id}/translations`));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.translations)).toBe(true);
    });

    it('translates free text without a contentId', async () => {
      const res = await as(token)(request(app).post('/api/translation/translate'))
        .send({ text: "It's a caption #fyp", targetLanguage: 'es', context: 'social_media_caption' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ translatedText: 'Hola, ¿qué tal?', targetLanguage: 'es' });
      const prompt = googleAI.generateContent.mock.calls.map((c) => c[0]).find((p) => p.includes('Translate the following text'));
      expect(prompt).toContain("It's a caption"); // sanitizer escaping undone
    });

    it('free text: honest 503 when the model returns nothing, 400 for an unknown language', async () => {
      googleAI.generateContent.mockResolvedValueOnce(null);
      const res = await as(token)(request(app).post('/api/translation/translate')).send({ text: 'hello', targetLanguage: 'es' });
      expect(res.status).toBe(503);
      const bad = await as(token)(request(app).post('/api/translation/translate')).send({ text: 'hello', targetLanguage: 'xx' });
      expect(bad.status).toBe(400);
    });
  });
});
