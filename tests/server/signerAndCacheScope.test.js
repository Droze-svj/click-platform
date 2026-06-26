// Two fixes found while prepping the local test env:
// 1. signMediaUrls must NOT mangle a bson ObjectId into { buffer: … } (it broke _id
//    in every signed response — e.g. the music picker's grouping + React keys).
// 2. The global /api GET cache key must be USER-SCOPED, or per-user responses
//    (/music/browse, /me/*, …) could be served across users (cross-user leak).

const mongoose = require('mongoose');

describe('signMediaUrls — ObjectId is preserved (not mangled)', () => {
  const { signMediaUrls } = require('../../server/utils/mediaUrlSigner');

  it('serializes a top-level/nested ObjectId to hex, and signs the url', () => {
    const id = new mongoose.Types.ObjectId();
    const out = signMediaUrls({ _id: id, file: { url: '/uploads/x.mp3' } });
    expect(JSON.stringify(out._id)).toBe(JSON.stringify(id.toHexString())); // hex, not {buffer}
    expect(String(out._id)).toBe(id.toHexString());                          // String() → hex
    expect(out.file.url).toMatch(/^\/uploads\/x\.mp3\?exp=\d+&sig=/);         // url still signed
  });

  it('preserves ObjectId through a mongoose-doc toObject() (the real route path)', () => {
    const id = new mongoose.Types.ObjectId();
    const doc = { toObject: () => ({ _id: id, file: { url: '/uploads/y.mp3' } }) };
    const out = signMediaUrls([doc])[0];
    expect(String(out._id)).toBe(id.toHexString());
    expect(String(out._id)).not.toBe('[object Object]');
  });
});

describe('cacheMiddleware — user-scoped key (no cross-user leak)', () => {
  jest.resetModules();
  jest.doMock('../../server/services/cacheService', () => ({ cacheMiddleware: jest.fn(() => (req, res, next) => next()) }));
  const cacheService = require('../../server/services/cacheService');
  const { cacheMiddleware } = require('../../server/middleware/cacheMiddleware');

  it('keys the cache by the caller id so A and B never collide', () => {
    cacheMiddleware(300);
    const keyGen = cacheService.cacheMiddleware.mock.calls[0][1];
    expect(typeof keyGen).toBe('function');
    const base = { originalUrl: '/api/music/browse', query: {} };
    const keyA = keyGen({ ...base, user: { _id: 'AAA' } });
    const keyB = keyGen({ ...base, user: { _id: 'BBB' } });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('AAA');
    expect(keyGen({ ...base })).toContain('anon'); // unauthenticated → shared bucket
  });
});
