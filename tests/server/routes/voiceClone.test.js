// /api/voice/clone + /api/voice/voices — validation, SSRF/LFI guards, provider
// preference, and honest 503 when no provider is configured. Self-contained: a
// mini express app with stubbed auth + mocked provider services.

const express = require('express');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

jest.mock('../../../server/middleware/auth', () => ({
  authenticate: (req, res, next) => { req.user = { _id: 'u1' }; next(); },
  authenticateToken: (req, res, next) => { req.user = { _id: 'u1' }; next(); },
}));
jest.mock('../../../server/middleware/enhancedRateLimiter', () => ({
  aiLimiter: (req, res, next) => next(),
}));
jest.mock('../../../server/services/omniVoiceService', () => ({
  isConfigured: jest.fn(() => false),
  cloneVoice: jest.fn(async () => 'ov-123'),
  listVoices: jest.fn(async () => []),
}));
jest.mock('../../../server/services/aiGenerativeDubbingService', () => ({
  cloneVoice: jest.fn(async () => 'el-456'),
}));
jest.mock('../../../server/services/aiVoiceoverService', () => ({
  listVoices: jest.fn(async () => [{ id: 'alloy', provider: 'openai' }]),
}));

const omniVoice = require('../../../server/services/omniVoiceService');
const dubbing = require('../../../server/services/aiGenerativeDubbingService');

const UPLOADS = path.join(process.cwd(), 'uploads');
const SAMPLE_NAME = 'test-voice-sample-fixture.wav';
const SAMPLE_ABS = path.join(UPLOADS, SAMPLE_NAME);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/voice', require('../../../server/routes/voice'));
  return app;
}

const OLD_KEY = process.env.ELEVENLABS_API_KEY;

beforeAll(() => {
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(SAMPLE_ABS, Buffer.from('RIFF....fake-wav-bytes'));
});
afterAll(() => {
  try { fs.unlinkSync(SAMPLE_ABS); } catch { /* ignore */ }
  if (OLD_KEY === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = OLD_KEY;
});
beforeEach(() => {
  jest.clearAllMocks();
  omniVoice.isConfigured.mockReturnValue(false);
  delete process.env.ELEVENLABS_API_KEY;
});

describe('POST /api/voice/clone — validation', () => {
  const app = makeApp();

  it('400 when name is missing', async () => {
    const res = await request(app).post('/api/voice/clone').send({ audioSampleUrl: `/uploads/${SAMPLE_NAME}` });
    expect(res.status).toBe(400);
  });

  it('400 when audioSampleUrl is missing', async () => {
    const res = await request(app).post('/api/voice/clone').send({ name: 'My Voice' });
    expect(res.status).toBe(400);
  });

  it('400 rejects a non-/uploads (SSRF) URL', async () => {
    const res = await request(app).post('/api/voice/clone')
      .send({ name: 'v', audioSampleUrl: 'http://169.254.169.254/latest/meta-data' });
    expect(res.status).toBe(400);
  });

  it('400 rejects a path-traversal attempt', async () => {
    const res = await request(app).post('/api/voice/clone')
      .send({ name: 'v', audioSampleUrl: '/uploads/../../etc/passwd.wav' });
    expect(res.status).toBe(400);
  });

  it('404 when the /uploads file does not exist', async () => {
    const res = await request(app).post('/api/voice/clone')
      .send({ name: 'v', audioSampleUrl: '/uploads/does-not-exist-xyz.wav' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/voice/clone — provider routing', () => {
  const app = makeApp();
  const body = { name: 'My Voice', audioSampleUrl: `/uploads/${SAMPLE_NAME}` };

  it('503 when no provider is configured', async () => {
    const res = await request(app).post('/api/voice/clone').send(body);
    expect(res.status).toBe(503);
    expect(dubbing.cloneVoice).not.toHaveBeenCalled();
    expect(omniVoice.cloneVoice).not.toHaveBeenCalled();
  });

  it('prefers OmniVoice when configured, passing a Buffer', async () => {
    omniVoice.isConfigured.mockReturnValue(true);
    const res = await request(app).post('/api/voice/clone').send(body);
    expect(res.status).toBe(200);
    expect(omniVoice.cloneVoice).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(omniVoice.cloneVoice.mock.calls[0][0])).toBe(true);
    expect(res.body.data).toMatchObject({ voiceId: 'ov-123', provider: 'omnivoice' });
  });

  it('falls back to ElevenLabs when OmniVoice is off but the key is set', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key';
    const res = await request(app).post('/api/voice/clone').send(body);
    expect(res.status).toBe(200);
    expect(dubbing.cloneVoice).toHaveBeenCalledTimes(1);
    expect(res.body.data).toMatchObject({ voiceId: 'el-456', provider: 'elevenlabs' });
  });
});

describe('GET /api/voice/voices', () => {
  it('returns the unified voice catalog', async () => {
    const res = await request(makeApp()).get('/api/voice/voices');
    expect(res.status).toBe(200);
    expect(res.body.data.voices).toEqual([{ id: 'alloy', provider: 'openai' }]);
  });
});
