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

describe('cacheMiddleware — credentialed requests never use the shared bucket', () => {
  // The global /api GET cache runs before route auth, so req.user is unset
  // there. Found by the e2e journeys: with Redis on (the CI e2e job), signed-in
  // users were served each other's cached GETs and status polls never moved.
  let inner;
  let cacheMiddleware;
  beforeEach(() => {
    jest.resetModules();
    inner = jest.fn((req, res, next) => next());
    jest.doMock('../../server/services/cacheService', () => ({ cacheMiddleware: jest.fn(() => inner) }));
    ({ cacheMiddleware } = require('../../server/middleware/cacheMiddleware'));
  });

  const run = (req) => { const next = jest.fn(); cacheMiddleware(300)(req, {}, next); return next; };

  it('skips the cache for a bearer-token request that has no req.user yet', () => {
    const next = run({ method: 'GET', originalUrl: '/api/video', query: {}, headers: { authorization: 'Bearer abc' } });
    expect(inner).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('skips the cache for a cookie-carrying request that has no req.user yet', () => {
    run({ method: 'GET', originalUrl: '/api/video', query: {}, headers: { cookie: 'token=abc' } });
    expect(inner).not.toHaveBeenCalled();
  });

  it('still caches anonymous requests and authenticated (req.user) ones', () => {
    run({ method: 'GET', originalUrl: '/api/plans', query: {}, headers: {} });
    run({ method: 'GET', originalUrl: '/api/me', query: {}, headers: { authorization: 'Bearer abc' }, user: { _id: 'AAA' } });
    expect(inner).toHaveBeenCalledTimes(2);
  });
});
