// Locks in the /uploads signed-capability gate so it can't silently regress
// before REQUIRE_SIGNED_MEDIA is enabled in prod.
process.env.MEDIA_URL_SECRET = process.env.MEDIA_URL_SECRET || 'test-media-secret';
const requireSignedMedia = require('../../server/middleware/requireSignedMedia');
const { signMediaUrl } = require('../../server/utils/mediaUrlSigner');

function mockReqRes({ path = '/videos/x.mp4', query = {} } = {}) {
  let status = 200; let body = null; let nexted = false;
  const req = { baseUrl: '/uploads', path, query };
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  const next = () => { nexted = true; };
  return { req, res, next, get status() { return status; }, get body() { return body; }, get nexted() { return nexted; } };
}

function signedQuery(uploadsPath) {
  // signMediaUrl returns "/uploads/...?exp=..&sig=..": pull the query params out.
  const u = new URL('http://x' + signMediaUrl(uploadsPath));
  return { exp: u.searchParams.get('exp'), sig: u.searchParams.get('sig') };
}

describe('requireSignedMedia gate', () => {
  const ORIG = process.env.REQUIRE_SIGNED_MEDIA;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.REQUIRE_SIGNED_MEDIA;
    else process.env.REQUIRE_SIGNED_MEDIA = ORIG;
  });

  it('flag OFF → serves everything (current behavior, zero risk)', () => {
    delete process.env.REQUIRE_SIGNED_MEDIA;
    const m = mockReqRes({ path: '/videos/private.mp4' });
    requireSignedMedia(m.req, m.res, m.next);
    expect(m.nexted).toBe(true);
  });

  it('flag ON + unsigned → 403', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const m = mockReqRes({ path: '/videos/private.mp4', query: {} });
    requireSignedMedia(m.req, m.res, m.next);
    expect(m.nexted).toBe(false);
    expect(m.status).toBe(403);
  });

  it('flag ON + valid signature → passes', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const q = signedQuery('/uploads/videos/private.mp4');
    const m = mockReqRes({ path: '/videos/private.mp4', query: q });
    requireSignedMedia(m.req, m.res, m.next);
    expect(m.nexted).toBe(true);
  });

  it('flag ON + tampered signature → 403', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const q = signedQuery('/uploads/videos/private.mp4');
    const m = mockReqRes({ path: '/videos/private.mp4', query: { exp: q.exp, sig: 'deadbeef' } });
    requireSignedMedia(m.req, m.res, m.next);
    expect(m.status).toBe(403);
  });

  it('flag ON + public prefix (fonts/) → passes unsigned', () => {
    process.env.REQUIRE_SIGNED_MEDIA = 'true';
    const m = mockReqRes({ path: '/fonts/Inter.woff2', query: {} });
    requireSignedMedia(m.req, m.res, m.next);
    expect(m.nexted).toBe(true);
  });
});
