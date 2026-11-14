// Facebook Pages picker + Meta publish routes (what Meta's App Review watches):
//  - GET /api/oauth/facebook/pages lists Pages (never tokens) + the default;
//  - PUT /api/oauth/facebook/default-page changes where posts go;
//  - /oauth/facebook/post publishes a VIDEO to that Page;
//  - our own /uploads media is only sent to Meta with a valid signature.

process.env.FACEBOOK_APP_ID = '1234567890';
process.env.FACEBOOK_APP_SECRET = 'fb-secret';
process.env.APP_URL = 'https://click.example.com';

jest.mock('../../../server/utils/urlGuard', () => ({
  ...jest.requireActual('../../../server/utils/urlGuard'),
  assertPublicUrl: jest.fn().mockResolvedValue(true),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const oauthService = require('../../../server/services/oauthService');
const { signMediaUrl } = require('../../../server/utils/mediaUrlSigner');

const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });
const UPLOAD_DIR = path.join(__dirname, '../../../uploads/meta-review-test');
const FILE = '/uploads/meta-review-test/clip.mp4';

describe('Meta Pages picker + publish routes', () => {
  let user; let token;
  const as = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../../..', FILE), Buffer.from('fake mp4'));
    await User.deleteMany({ email: 'meta-routes@example.com' });
    user = await new User({ email: 'meta-routes@example.com', password: 'password123', name: 'M', emailVerified: true }).save();
    token = sign(user);
    await oauthService.saveSocialCredentials(String(user._id), 'facebook', {
      accessToken: 'user-token',
      platformUserId: 'fb-1',
      extra: {
        platformUserId: 'fb-1',
        platformUsername: 'M',
        pages: [
          { id: 'p1', name: 'First Page', accessToken: 'TOKEN-P1', instagramBusinessId: null },
          { id: 'p2', name: 'Second Page', accessToken: 'TOKEN-P2', instagramBusinessId: 'ig-2' },
        ],
      },
    });
  });

  afterAll(() => fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }));
  afterEach(() => jest.restoreAllMocks());

  it('lists the Pages without tokens and defaults to the first', async () => {
    const res = await as(request(app).get('/api/oauth/facebook/pages'));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      connected: true,
      defaultPageId: 'p1',
      pages: [
        { id: 'p1', name: 'First Page', hasInstagram: false },
        { id: 'p2', name: 'Second Page', hasInstagram: true },
      ],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/TOKEN-P/);
  });

  it('changes the default Page, and refuses a Page that is not connected', async () => {
    expect((await as(request(app).put('/api/oauth/facebook/default-page').send({ pageId: 'nope' }))).status).toBe(404);
    const ok = await as(request(app).put('/api/oauth/facebook/default-page').send({ pageId: 'p2' }));
    expect(ok.status).toBe(200);
    expect((await as(request(app).get('/api/oauth/facebook/pages'))).body.data.defaultPageId).toBe('p2');
  });

  it('refuses to send an unsigned or forged /uploads link to Meta', async () => {
    const post = jest.spyOn(axios, 'post');
    for (const videoUrl of [FILE, `${FILE}?exp=9999999999&sig=deadbeef`]) {
      const res = await as(request(app).post('/api/oauth/facebook/post').send({ text: 'hi', videoUrl }));
      expect(res.status).toBe(403);
      const ig = await as(request(app).post('/api/oauth/instagram/post').send({ videoUrl, caption: 'hi' }));
      expect(ig.status).toBe(403);
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('posts a signed upload as a VIDEO to the default Page with that Page token', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { id: 'video-9' } });
    const res = await as(request(app).post('/api/oauth/facebook/post').send({ text: 'Launch day', videoUrl: signMediaUrl(FILE) }));
    expect(res.status).toBe(200);
    const [url, , cfg] = post.mock.calls[0];
    expect(url).toMatch(/\/p2\/videos$/);
    expect(cfg.params.access_token).toBe('TOKEN-P2');
    expect(cfg.params.description).toBe('Launch day');
    expect(cfg.params.file_url).toMatch(/^https:\/\/click\.example\.com\/uploads\/meta-review-test\/clip\.mp4\?exp=\d+&sig=/);
  });

  it('records the published video so analytics and learning can follow it — once, and only linked to your own video', async () => {
    jest.spyOn(require('../../../server/config/database'), 'getDatabaseHealth').mockReturnValue({ status: 'connected', mongodb: true });
    const Content = require('../../../server/models/Content');
    const ScheduledPost = require('../../../server/models/ScheduledPost');
    const mine = await Content.create({ userId: user._id, title: 'Mine', type: 'video', status: 'completed' });
    const theirs = await Content.create({ userId: new (require('mongoose').Types.ObjectId)(), title: 'Theirs', type: 'video', status: 'completed' });
    const post = jest.spyOn(axios, 'post');

    post.mockResolvedValueOnce({ data: { id: 'video-10' } });
    await as(request(app).post('/api/oauth/facebook/post').send({ text: 'A', videoUrl: signMediaUrl(FILE), contentId: String(mine._id) }));
    post.mockResolvedValueOnce({ data: { id: 'video-10' } }); // same post id again
    await as(request(app).post('/api/oauth/facebook/post').send({ text: 'A', videoUrl: signMediaUrl(FILE), contentId: String(mine._id) }));
    post.mockResolvedValueOnce({ data: { id: 'video-11' } });
    await as(request(app).post('/api/oauth/facebook/post').send({ text: 'B', videoUrl: signMediaUrl(FILE), contentId: String(theirs._id) }));

    const rows = await ScheduledPost.find({ userId: String(user._id), platform: 'facebook', platformPostId: { $in: ['video-10', 'video-11'] } }).sort({ platformPostId: 1 }).lean();
    expect(rows.map((r) => r.platformPostId)).toEqual(['video-10', 'video-11']);
    expect(rows[0]).toMatchObject({ status: 'posted', contentId: String(mine._id), metadata: { source: 'direct' } });
    expect(rows[1].contentId).toBeNull(); // someone else's video is never linked
    expect(rows[0].lastLearnedAt).toBeTruthy();

    const { runLearningTick } = require('../../../server/services/performanceLearningCron');
    const tick = await runLearningTick();
    expect(tick.processed || 0).toBe(0); // nothing measured yet, nothing learned
  });
});
