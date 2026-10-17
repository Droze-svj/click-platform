/**
 * POST /api/memo-script and POST /api/memo-script/transcribe
 *
 * The script endpoint must undo the global sanitizer's HTML-escaping before the
 * memo reaches the prompt, and report an unusable model reply as 503 rather than
 * a canned script. The transcribe endpoint must reject non-audio uploads with a
 * 400, say plainly when Whisper isn't configured, and always delete the temp
 * memo file.
 */

const fs = require('fs');

const mockGenerateMemoScript = jest.fn();
const mockTranscribe = jest.fn();

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: 'user-1' };
  req.assertBudget = jest.fn();
  req.recordAiUsage = jest.fn();
  next();
});
jest.mock('../../../server/middleware/enhancedRateLimiter', () => ({
  aiLimiter: (req, res, next) => next(),
}));
jest.mock('../../../server/middleware/costGuard', () => ({
  costGuard: () => (req, res, next) => next(),
}));
jest.mock('../../../server/services/personalizationService', () => ({
  buildPersonalizedSystemPrompt: jest.fn(),
  getPersona: jest.fn(),
}));
jest.mock('../../../server/services/whisperService', () => ({
  generateTranscriptFromAudio: (...args) => mockTranscribe(...args),
}));
jest.mock('../../../server/services/memoScriptService', () => {
  const actual = jest.requireActual('../../../server/services/memoScriptService');
  return { ...actual, generateMemoScript: (...args) => mockGenerateMemoScript(...args) };
});

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/memo-script');

const app = express();
app.use(express.json());
app.use('/api/memo-script', router);

describe('POST /api/memo-script', () => {
  beforeEach(() => mockGenerateMemoScript.mockReset());

  it('400s on an empty memo without calling the generator', async () => {
    await request(app).post('/api/memo-script').send({ memo: '  ' }).expect(400);
    expect(mockGenerateMemoScript).not.toHaveBeenCalled();
  });

  it('unescapes sanitizer entities and normalizes the format', async () => {
    mockGenerateMemoScript.mockResolvedValue({ script: { hook: 'h' } });
    const res = await request(app)
      .post('/api/memo-script')
      .send({ memo: 'don&#x27;t post &amp; pray', platform: 'youtube', format: 'weird' })
      .expect(200);
    const [input] = mockGenerateMemoScript.mock.calls[0];
    expect(input).toMatchObject({ memo: "don't post & pray", platform: 'youtube', format: 'short', userId: 'user-1' });
    expect(res.body.data.script.hook).toBe('h');
  });

  it('503s honestly when the model produced nothing usable', async () => {
    mockGenerateMemoScript.mockResolvedValue(null);
    const res = await request(app).post('/api/memo-script').send({ memo: 'raw' }).expect(503);
    expect(JSON.stringify(res.body)).toMatch(/temporarily unavailable/);
  });
});

describe('POST /api/memo-script/transcribe', () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    mockTranscribe.mockReset();
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterAll(() => {
    if (OLD_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = OLD_KEY;
  });

  const audio = Buffer.from('fake-audio-bytes');

  it('400s when no file is attached', async () => {
    await request(app).post('/api/memo-script/transcribe').expect(400);
  });

  it('400s on a non-audio upload', async () => {
    const res = await request(app)
      .post('/api/memo-script/transcribe')
      .attach('audio', Buffer.from('<html>'), { filename: 'x.html', contentType: 'text/html' })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/Unsupported audio type/);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('transcribes a browser webm memo, keeps the extension Whisper needs, and deletes the temp file', async () => {
    let seenPath;
    mockTranscribe.mockImplementation(async (p) => {
      seenPath = p;
      expect(fs.existsSync(p)).toBe(true);
      return '  hook idea, coffee shops  ';
    });
    const res = await request(app)
      .post('/api/memo-script/transcribe')
      .field('language', 'EN')
      .attach('audio', audio, { filename: 'memo.webm', contentType: 'audio/webm;codecs=opus' })
      .expect(200);
    expect(res.body.data.transcript).toBe('hook idea, coffee shops');
    expect(seenPath).toMatch(/\.webm$/);
    expect(mockTranscribe.mock.calls[0][1]).toEqual({ responseFormat: 'json', language: 'en' });
    await new Promise((r) => setImmediate(r));
    expect(fs.existsSync(seenPath)).toBe(false);
  });

  it('503s when Whisper is not configured, and still deletes the upload', async () => {
    delete process.env.OPENAI_API_KEY;
    const before = new Set(fs.readdirSync(require('os').tmpdir() + '/click-memos'));
    await request(app)
      .post('/api/memo-script/transcribe')
      .attach('audio', audio, { filename: 'memo.m4a', contentType: 'audio/mp4' })
      .expect(503);
    await new Promise((r) => setImmediate(r));
    const after = fs.readdirSync(require('os').tmpdir() + '/click-memos');
    expect(after.filter((f) => !before.has(f))).toEqual([]);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('502s when Whisper returns nothing', async () => {
    mockTranscribe.mockResolvedValue(null);
    await request(app)
      .post('/api/memo-script/transcribe')
      .attach('audio', audio, { filename: 'memo.mp3', contentType: 'audio/mpeg' })
      .expect(502);
  });
});
