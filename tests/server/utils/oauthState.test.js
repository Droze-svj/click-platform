// Tests for the signed OAuth state helper (CSRF protection).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-oauth-state';
const { signState, verifyState } = require('../../../server/utils/oauthState');

describe('oauthState — signed state', () => {
  it('round-trips a payload through sign → verify', () => {
    const s = signState({ userId: 'u123', platform: 'twitter', codeVerifier: 'abc' });
    const p = verifyState(s);
    expect(p).toBeTruthy();
    expect(p.userId).toBe('u123');
    expect(p.platform).toBe('twitter');
    expect(p.codeVerifier).toBe('abc');
  });

  it('rejects a tampered payload (forged userId)', () => {
    const s = signState({ userId: 'victim', platform: 'twitter' });
    const [body, sig] = s.split('.');
    // Forge a new body with a different userId, keep the old signature.
    const forgedBody = Buffer.from(JSON.stringify({ userId: 'attacker', platform: 'twitter', _iat: Date.now() })).toString('base64url');
    expect(verifyState(`${forgedBody}.${sig}`)).toBeNull();
    // sanity: original still verifies
    expect(verifyState(`${body}.${sig}`)?.userId).toBe('victim');
  });

  it('rejects an unsigned legacy base64 blob (no signature)', () => {
    const legacy = Buffer.from(JSON.stringify({ userId: 'x' })).toString('base64');
    expect(verifyState(legacy)).toBeNull();
  });

  it('rejects malformed / empty input', () => {
    expect(verifyState('')).toBeNull();
    expect(verifyState(null)).toBeNull();
    expect(verifyState('garbage')).toBeNull();
    expect(verifyState('a.b.c')).toBeNull();
  });

  it('rejects an expired state (past maxAge)', () => {
    const s = signState({ userId: 'u1' });
    // Verify with a 0ms window → already expired.
    expect(verifyState(s, { maxAgeMs: -1 })).toBeNull();
  });
});
