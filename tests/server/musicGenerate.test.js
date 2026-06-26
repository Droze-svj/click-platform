// /api/music/generate — AI music generation. Locks in: HONEST 503 when no provider
// is configured (never a fabricated track), dev user blocked, and per-user isolation
// on polling (a user can't poll someone else's generation).

jest.mock('../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: req.headers['x-uid'] || 'realuser' }; next(); });
jest.mock('../../server/middleware/enhancedRateLimiter', () => ({ aiLimiter: (req, res, next) => next() }));
jest.mock('../../server/utils/mediaUrlSigner', () => ({ signMediaUrls: (x) => x }));
jest.mock('../../server/models/Music', () => ({
  schema: { path: (p) => ({ enumValues: p === 'genre' ? ['pop', 'other'] : ['happy', 'energetic'] }) },
  updateOne: jest.fn(),
}));
jest.mock('../../server/models/AIMusicProviderConfig', () => ({ findOne: jest.fn() }));
jest.mock('../../server/models/MusicGeneration', () => ({ findOne: jest.fn() }));
jest.mock('../../server/services/aiMusicGenerationService', () => ({
  generateMusicTrack: jest.fn(), checkGenerationStatus: jest.fn(), downloadAndStoreTrack: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const AIMusicProviderConfig = require('../../server/models/AIMusicProviderConfig');
const MusicGeneration = require('../../server/models/MusicGeneration');
const svc = require('../../server/services/aiMusicGenerationService');
const router = require('../../server/routes/music-generate');

function app() { const a = express(); a.use(express.json()); a.use('/api/music', router); return a; }
const provider = (p) => AIMusicProviderConfig.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(p ? { provider: p } : null) }) });

describe('/api/music/generate', () => {
  beforeEach(() => {
    AIMusicProviderConfig.findOne.mockReset();
    MusicGeneration.findOne.mockReset();
    svc.generateMusicTrack.mockReset();
    svc.checkGenerationStatus.mockReset();
  });

  it('HONEST 503 when no provider is configured (no fabricated track)', async () => {
    provider(null);
    const res = await request(app()).post('/api/music/generate').set('x-uid', '6a3500000000000000000aaa').send({ genre: 'pop', mood: 'happy' });
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe('provider-not-configured');
    expect(svc.generateMusicTrack).not.toHaveBeenCalled();
  });

  it('blocks the demo/dev user', async () => {
    provider('mubert');
    const res = await request(app()).post('/api/music/generate').set('x-uid', 'dev-user-123').send({ genre: 'pop' });
    expect(res.status).toBe(403);
    expect(svc.generateMusicTrack).not.toHaveBeenCalled();
  });

  it('starts a generation when a provider is configured (validated params)', async () => {
    provider('mubert');
    svc.generateMusicTrack.mockResolvedValue({ generationId: 'gen1', status: 'processing', estimatedTime: 20 });
    const res = await request(app()).post('/api/music/generate').set('x-uid', '6a3500000000000000000aaa').send({ genre: 'pop', mood: 'happy', energy: 'high', duration: 9999 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('processing');
    expect(res.body.data.generationId).toBe('gen1');
    const [calledProvider, params, userId] = svc.generateMusicTrack.mock.calls[0];
    expect(calledProvider).toBe('mubert');
    expect(params.genre).toBe('pop');
    expect(params.duration).toBe(180);       // clamped from 9999
    expect(String(userId)).toBe('6a3500000000000000000aaa');
  });

  it('polling another user’s generation is isolated → 404', async () => {
    MusicGeneration.findOne.mockReturnValue({ lean: () => Promise.resolve(null) }); // not owned by caller
    const res = await request(app()).get('/api/music/generate/someoneElsesId').set('x-uid', '6a3500000000000000000bbb');
    expect(res.status).toBe(404);
    // the query must be scoped by userId
    expect(MusicGeneration.findOne.mock.calls[0][0]).toMatchObject({ userId: '6a3500000000000000000bbb' });
  });
});
