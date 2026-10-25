// ElevenLabs dubs must be playable in the editor. The start route used to hand
// the browser `https://api.elevenlabs.io/v1/dubbing/<id>/audio/<lang>` — an
// endpoint that needs our API key and sits on a CSP-blocked origin — and sent
// the provider a made-up cdn.clickapp.io source URL. Now the real file is sent,
// the job is bound to its owner, and the finished audio is copied into
// /uploads/dubs and returned signed + same-origin.
//
// No real provider is called: global.fetch is stubbed. Mongo is the in-memory
// DB owned by tests/setup.js.

const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const OWNER = new mongoose.Types.ObjectId();
const OTHER = new mongoose.Types.ObjectId();
let mockCurrentUser = OWNER;

jest.mock('../../../server/middleware/auth', () => {
  const fn = (req, res, next) => { req.user = { _id: mockCurrentUser }; next(); };
  return { authenticateToken: fn, authenticate: fn };
});
jest.mock('../../../server/middleware/tierGate', () => ({
  requireFeature: () => (req, res, next) => next(),
}));

const Content = require('../../../server/models/Content');
const DubbingJob = require('../../../server/models/DubbingJob');

const UPLOADS = path.join(__dirname, '../../../uploads');
const VIDEO_NAME = `dub-test-${Date.now()}.mp4`;
const VIDEO_ABS = path.join(UPLOADS, 'videos', VIDEO_NAME);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dubbing', require('../../../server/routes/dubbing'));
  return app;
}

const OLD_KEY = process.env.ELEVENLABS_API_KEY;
const realFetch = global.fetch;
const written = [];

beforeAll(() => {
  fs.mkdirSync(path.dirname(VIDEO_ABS), { recursive: true });
  fs.writeFileSync(VIDEO_ABS, Buffer.from('fake-mp4-bytes'));
});
afterAll(() => {
  fs.rmSync(VIDEO_ABS, { force: true });
  for (const rel of written) fs.rmSync(path.join(UPLOADS, rel), { force: true });
  global.fetch = realFetch;
  if (OLD_KEY === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = OLD_KEY;
});

describe('ElevenLabs dubbing → same-origin /uploads audio', () => {
  let video;
  let calls;

  beforeEach(async () => {
    mockCurrentUser = OWNER;
    process.env.ELEVENLABS_API_KEY = 'test-key';
    await DubbingJob.deleteMany({});
    video = await Content.create({
      userId: OWNER, title: 'Dub me', type: 'video', status: 'completed',
      originalFile: { url: `/uploads/videos/${VIDEO_NAME}`, filename: VIDEO_NAME },
    });
    calls = [];
    let dubbed = false;
    global.fetch = jest.fn(async (url, opts = {}) => {
      calls.push({ url: String(url), opts });
      if (String(url).endsWith('/dubbing') && opts.method === 'POST') {
        return { ok: true, json: async () => ({ dubbing_id: 'dub_abc' }) };
      }
      if (/\/dubbing\/dub_abc$/.test(String(url))) {
        const status = dubbed ? 'dubbed' : 'dubbing';
        dubbed = true;
        return { ok: true, json: async () => ({ status, progress: dubbed ? 100 : 40 }) };
      }
      if (/\/dubbing\/dub_abc\/audio\/es$/.test(String(url))) {
        return { ok: true, arrayBuffer: async () => Buffer.from('ID3-fake-mp3') };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  });

  it('sends the real file, then serves the finished dub from signed /uploads', async () => {
    const app = makeApp();
    const start = await request(app).post('/api/dubbing/start').send({ videoId: String(video._id), targetLanguage: 'es' });
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ jobId: 'dub_abc', audioUrl: null, status: 'processing' });

    const form = calls[0].opts.body;
    expect(form.get('file')).toBeTruthy();
    expect(form.get('source_url')).toBeNull();

    const first = await request(app).get('/api/dubbing/status/dub_abc');
    expect(first.body.status).toBe('processing');

    const done = await request(app).get('/api/dubbing/status/dub_abc');
    expect(done.body.status).toBe('completed');
    expect(done.body.audioUrl).toMatch(/^\/uploads\/dubs\/[a-f0-9]{32}\.mp3\?exp=\d+&sig=[a-f0-9]+$/);
    const rel = done.body.audioUrl.split('?')[0].replace(/^\/uploads\//, '');
    written.push(rel);
    expect(fs.readFileSync(path.join(UPLOADS, rel)).toString()).toBe('ID3-fake-mp3');
    expect(JSON.stringify(done.body)).not.toMatch(/elevenlabs\.io/);

    // Polling again re-signs the stored file — no second provider download.
    const n = calls.length;
    const again = await request(app).get('/api/dubbing/status/dub_abc');
    expect(again.body.audioUrl.split('?')[0]).toBe(done.body.audioUrl.split('?')[0]);
    expect(calls.length).toBe(n);
  });

  it("refuses another user's job", async () => {
    const app = makeApp();
    await request(app).post('/api/dubbing/start').send({ videoId: String(video._id), targetLanguage: 'es' });
    mockCurrentUser = OTHER;
    const res = await request(app).get('/api/dubbing/status/dub_abc');
    expect(res.status).toBe(404);
  });
});
