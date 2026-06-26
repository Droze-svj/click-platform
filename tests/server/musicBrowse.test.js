// GET /api/music/browse — organized categorized music. Locks in: per-user isolation
// (the query only ever exposes the caller's own tracks + public), dev-user gets
// public-only, grouping by category is correct, and an empty library is honest.

jest.mock('../../server/middleware/auth', () => (req, res, next) => { req.user = { _id: req.headers['x-uid'] || 'realuser' }; next(); });
jest.mock('../../server/utils/mediaUrlSigner', () => ({ signMediaUrls: (x) => x }));
jest.mock('../../server/models/Music', () => ({ find: jest.fn() }));

const request = require('supertest');
const express = require('express');
const Music = require('../../server/models/Music');
const router = require('../../server/routes/music-browse');

function app() { const a = express(); a.use(express.json()); a.use('/api/music', router); return a; }
let capturedQuery;
function mockTracks(docs) {
  Music.find.mockImplementation((q) => { capturedQuery = q; return { sort: () => ({ limit: () => Promise.resolve(docs) }) }; });
}

describe('GET /api/music/browse', () => {
  beforeEach(() => { Music.find.mockReset(); capturedQuery = undefined; });

  it('scopes the query to the caller’s own tracks + public (per-user isolation)', async () => {
    mockTracks([]);
    await request(app()).get('/api/music/browse').set('x-uid', '6a3500000000000000000aaa');
    expect(capturedQuery).toEqual({ $or: [{ userId: '6a3500000000000000000aaa' }, { isPublic: true }] });
  });

  it('dev/mock user gets PUBLIC-only (no userId in query)', async () => {
    mockTracks([]);
    await request(app()).get('/api/music/browse').set('x-uid', 'dev-user-123');
    expect(capturedQuery).toEqual({ isPublic: true });
  });

  it('groups tracks by genre / mood / energy / usage', async () => {
    mockTracks([
      { _id: 'a', genre: 'pop', mood: 'happy', energy: 'high', usageContext: ['intro', 'hook'] },
      { _id: 'b', genre: 'pop', mood: 'calm', energy: 'low', usageContext: ['background'] },
    ]);
    const res = await request(app()).get('/api/music/browse').set('x-uid', '6a3500000000000000000aaa');
    const d = res.body.data;
    expect(d.tracks).toHaveLength(2);
    expect(d.byGenre.pop.sort()).toEqual(['a', 'b']);
    expect(d.byMood.happy).toEqual(['a']);
    expect(d.byEnergy.high).toEqual(['a']);
    expect(d.byUsage.hook).toEqual(['a']);
    expect(d.byUsage.background).toEqual(['b']);
  });

  it('honest empty groups when the library is empty', async () => {
    mockTracks([]);
    const res = await request(app()).get('/api/music/browse').set('x-uid', '6a3500000000000000000aaa');
    expect(res.body.data).toEqual({ tracks: [], byGenre: {}, byMood: {}, byEnergy: {}, byUsage: {} });
  });
});
