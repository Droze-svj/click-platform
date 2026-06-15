// Security regressions for the auth subsystem:
//  C1 — the dev auth-bypass must be reachable ONLY in a local `development`
//       env, never on a deployed env (staging/preview/unset) where the
//       localhost signal comes from spoofable headers.
//  H1/H2 — the auth middleware must reject non-access tokens (refresh /
//       2fa_pending / password_reset are signed with the same secret and carry
//       userId, but must never grant API access).

const jwt = require('jsonwebtoken');
const { allowDevMode } = require('../../server/utils/devUser');
const { getJwtSecret } = require('../../server/utils/jwtSecret');

const ORIG_ENV = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = ORIG_ENV; });

describe('C1 — allowDevMode is development-only (no deployed-env header bypass)', () => {
  const spoofLocalhost = { headers: { 'x-forwarded-for': '203.0.113.9, 127.0.0.1', host: 'app.staging.example.com' } };

  test('staging + spoofed X-Forwarded-For: 127.0.0.1 → false', () => {
    process.env.NODE_ENV = 'staging';
    expect(allowDevMode(spoofLocalhost)).toBe(false);
  });

  test('production + Host: localhost → false', () => {
    process.env.NODE_ENV = 'production';
    expect(allowDevMode({ headers: { host: 'localhost:5001' } })).toBe(false);
  });

  test('unset NODE_ENV (deployed host) + localhost referer → false', () => {
    delete process.env.NODE_ENV;
    expect(allowDevMode({ headers: { referer: 'http://localhost/' } })).toBe(false);
  });

  test('test env → false', () => {
    process.env.NODE_ENV = 'test';
    expect(allowDevMode({ headers: { host: '127.0.0.1' } })).toBe(false);
  });

  test('development + localhost → true (local dev still frictionless)', () => {
    process.env.NODE_ENV = 'development';
    expect(allowDevMode({ headers: { host: 'localhost:5001' } })).toBe(true);
  });

  test('development + no localhost signal → false', () => {
    process.env.NODE_ENV = 'development';
    expect(allowDevMode({ headers: { host: 'example.com' } })).toBe(false);
  });
});

describe('H1/H2 — auth middleware confines tokens to the access type', () => {
  const auth = require('../../server/middleware/auth');
  const secret = getJwtSecret();
  const uid = '000000000000000000000abc';

  function run(token) {
    const req = {
      header: (n) => (n === 'Authorization' ? `Bearer ${token}` : undefined),
      headers: {}, path: '/protected', url: '/protected',
    };
    const res = { statusCode: null, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    let nextCalled = false;
    return auth(req, res, () => { nextCalled = true; }).then(() => ({ res, nextCalled }));
  }

  test.each(['refresh', '2fa_pending', 'password_reset'])(
    'rejects a same-secret %s token with 401 Invalid token (no next())',
    async (type) => {
      const token = jwt.sign({ userId: uid, type }, secret);
      const { res, nextCalled } = await run(token);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Invalid token');
      expect(nextCalled).toBe(false);
    }
  );

  test('an access token (no type claim) passes the type guard (not rejected as Invalid token)', async () => {
    const token = jwt.sign({ userId: uid }, secret);
    const { res, nextCalled } = await run(token);
    // It won't reach next() here (no DB user in the unit env), but it must NOT
    // be rejected by the type guard — i.e. the failure reason is "user not
    // found", never "Invalid token".
    expect(nextCalled).toBe(false);
    if (res.body) expect(res.body.error).not.toBe('Invalid token');
  });
});
