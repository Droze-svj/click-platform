// Paste-link ingest and Remix must hand the editor a real, saved Content id.
// /ingest/url used to answer a made-up `ingest-<ts>` id and discard (and
// swallow failures of) Content.create; Remix lived only in the in-memory dev
// store. GET /ingest/recent listed every user's entries.
// The connection + in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/utils/downloadUtils', () => {
  const actual = jest.requireActual('../../../server/utils/downloadUtils');
  return {
    ...actual,
    streamDownload: jest.fn(async (_url, dest) => {
      require('fs').writeFileSync(dest, Buffer.alloc(1024));
      return { bytes: 1024 };
    }),
  };
});
jest.mock('../../../server/utils/urlGuard', () => ({
  ...jest.requireActual('../../../server/utils/urlGuard'),
  assertPublicUrl: jest.fn(async () => true),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const { devVideoStore } = require('../../../server/utils/devStore');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('ingest', () => {
  let me;
  let other;
  let token;
  const created = [];

  beforeEach(async () => {
    await User.deleteMany({ email: /ingest-persist-/ });
    me = await new User({ email: 'ingest-persist-me@example.com', password: 'password123', name: 'Me', emailVerified: true }).save();
    other = await new User({ email: 'ingest-persist-other@example.com', password: 'password123', name: 'Other', emailVerified: true }).save();
    token = jwt.sign({ userId: String(me._id) }, getJwtSecret(), { expiresIn: '1h' });
    // tests/setup.js connects Mongo itself, so connectDB's health flag (which
    // resolveContent checks) is never set here; in production it is.
    jest.spyOn(require('../../../server/config/database'), 'getDatabaseHealth').mockReturnValue({ status: 'connected', mongodb: true });
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    for (const f of created) { try { fs.unlinkSync(path.join(process.cwd(), f)); } catch (_) { /* gone */ } }
  });

  const authed = (r) => r.set('Authorization', `Bearer ${token}`);

  // (The URL also goes through the input sanitizer, which escapes `/`; the
  // route undoes it — before that, every pasted link was "not recognised".)
  it('saves the imported video and returns its real _id', async () => {
    const res = await authed(request(app).post('/api/ingest/url')).send({ url: 'https://cdn.example.com/clip.mp4', title: 'My clip' });
    expect(res.status).toBe(200);
    const { contentId } = res.body.data;
    const fileUrl = res.body.data.fileUrl.split('?')[0]; // responses carry a signed media URL
    created.push(fileUrl);
    expect(mongoose.Types.ObjectId.isValid(contentId)).toBe(true);
    const doc = await Content.findById(contentId).lean();
    expect(doc).toMatchObject({ userId: String(me._id), type: 'video', title: 'My clip', originalFile: { url: fileUrl } });
  });

  it('answers 500 (and removes the download) when the project cannot be saved', async () => {
    jest.spyOn(Content, 'create').mockRejectedValueOnce(new Error('db down'));
    const res = await authed(request(app).post('/api/ingest/url')).send({ url: 'https://cdn.example.com/clip2.mp4' });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('saves a remix as a new Content owned by the caller', async () => {
    const original = await Content.create({ userId: String(me._id), title: 'Original', type: 'video', status: 'completed', originalFile: { url: '/uploads/videos/a.mp4' }, tags: ['x'] });
    const res = await authed(request(app).post('/api/ingest/remix')).send({ contentId: String(original._id) });
    expect(res.status).toBe(200);
    const remix = await Content.findById(res.body.data.contentId).lean();
    expect(remix).toMatchObject({ userId: String(me._id), title: 'Original (Remix)', type: 'video', tags: ['x'], originalFile: { url: '/uploads/videos/a.mp4' } });
    expect(String(remix._id)).not.toBe(String(original._id));
    expect(remix.metadata.remixOf).toBe(String(original._id));
  });

  it('refuses to remix someone else\'s content', async () => {
    const theirs = await Content.create({ userId: String(other._id), title: 'Theirs', type: 'video', status: 'completed' });
    const res = await authed(request(app).post('/api/ingest/remix')).send({ contentId: String(theirs._id) });
    expect(res.status).toBe(403);
  });

  it('GET /recent lists only the caller\'s videos', async () => {
    await Content.create({ userId: String(me._id), title: 'Mine', type: 'video', status: 'completed', originalFile: { url: '/uploads/videos/mine.mp4' } });
    await Content.create({ userId: String(other._id), title: 'Not mine', type: 'video', status: 'completed', originalFile: { url: '/uploads/videos/theirs.mp4' } });
    devVideoStore.set('dev-content-leak', { title: 'Dev leak', userId: String(other._id), originalFile: { url: '/uploads/videos/leak.mp4' }, createdAt: new Date().toISOString() });

    const res = await authed(request(app).get('/api/ingest/recent'));
    devVideoStore.delete('dev-content-leak');
    expect(res.status).toBe(200);
    const titles = res.body.data.map((x) => x.title);
    expect(titles).toContain('Mine');
    expect(titles).not.toContain('Not mine');
    expect(titles).not.toContain('Dev leak');
  });
});
