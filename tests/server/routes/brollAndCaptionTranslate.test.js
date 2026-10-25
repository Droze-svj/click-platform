/**
 * Editor quick actions that read caption data.
 *
 * - "Suggest B-roll" read content.transcript.segments, but Content.transcript
 *   is a String, so every plan was empty. The timed segments live in the
 *   caption store.
 * - Caption "Translate" translated only the embedded text blob, wrote it to a
 *   Mixed field without markModified, and returned no segments, so the editor
 *   had nothing to show.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const captionStore = require('../../../server/services/captionStore');
const videoCaptionService = require('../../../server/services/videoCaptionService');
const brollService = require('../../../server/services/bRollIntelligenceService');
const database = require('../../../server/config/database');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('B-roll suggestions and caption translation', () => {
  let owner, content, token, healthSpy;

  beforeAll(async () => {
    // guardOwnership → resolveContent only queries Mongo once the app's DB
    // status says it is connected; the in-memory test DB never flips it.
    healthSpy = jest.spyOn(database, 'getDatabaseHealth').mockReturnValue({ status: 'connected', mongodb: true });
    owner = await new User({ email: 'broll-tr@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = jwt.sign({ userId: owner._id }, getJwtSecret(), { expiresIn: '1h' });
    content = await new Content({
      userId: String(owner._id), type: 'video', title: 'Talk', status: 'completed',
      transcript: 'hello there this is a long talk about mountains',
    }).save();
    await captionStore.saveSource(content._id, {
      language: 'en', format: 'srt', text: 'hello there this is a long talk about mountains',
      segments: [
        { start: 0, end: 5, text: 'hello there this is a long talk' },
        { start: 5, end: 11, text: 'about mountains' },
      ],
    });
  });

  afterAll(async () => {
    healthSpy.mockRestore();
    await Content.deleteOne({ _id: content._id });
    await User.deleteOne({ _id: owner._id });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('B-roll plans from the caption-store segments', async () => {
    const spy = jest.spyOn(brollService, 'orchestrateBRoll').mockResolvedValue([
      { startTime: 5, duration: 3, url: 'https://videos.example.com/m.mp4', keyword: 'mountains' },
    ]);
    try {
      const res = await auth(request(app).post(`/api/video/ai-editing/broll/${content._id}`)).send({});
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      const segs = spy.mock.calls[0][1].segments;
      expect(segs).toHaveLength(2);
      expect(segs[1]).toMatchObject({ start: 5, end: 11, text: 'about mountains' });
      expect(res.body.data.plan).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('Translate returns the translated segments and stores the translation', async () => {
    const spy = jest.spyOn(videoCaptionService, 'ensureCaptionsInLanguage').mockResolvedValue({
      language: 'es', text: 'hola montañas',
      segments: [{ start: 0, end: 5, text: 'hola' }, { start: 5, end: 11, text: 'montañas' }],
      formatted: '1\n00:00:00,000 --> 00:00:05,000\nhola\n', cached: false,
    });
    try {
      const res = await auth(request(app).post(`/api/video/captions/${content._id}/translate`)).send({ targetLanguage: 'es' });
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.language).toBe('es');
      expect(data.segments).toHaveLength(2);
      expect(data.segments[1].text).toBe('montañas');
      const stored = await Content.findById(content._id).lean();
      expect(stored.captions.translations.es).toBe('hola montañas');
    } finally {
      spy.mockRestore();
    }
  });
});
