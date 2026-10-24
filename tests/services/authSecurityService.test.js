// Pure parts of the login protocol: reset-link binding, session revocation
// boundaries, lockout timing, TOTP and one-time backup codes.

const speakeasy = require('speakeasy');
const jwt = require('jsonwebtoken');
const sec = require('../../server/services/authSecurityService');
const { issueTokenPair } = require('../../server/utils/jwtTokens');
const { getJwtSecret } = require('../../server/utils/jwtSecret');

describe('reset links are bound to the current password', () => {
  test('a token matches only while the password hash it was issued for is current', () => {
    const user = { _id: 'u1', password: '$2a$10$hashA' };
    const decoded = jwt.verify(sec.issueResetToken(user), getJwtSecret());
    expect(decoded).toMatchObject({ userId: 'u1', type: 'password_reset' });
    expect(sec.resetTokenMatches(decoded, user)).toBe(true);
    expect(sec.resetTokenMatches(decoded, { ...user, password: '$2a$10$hashB' })).toBe(false);
    expect(sec.resetTokenMatches({ userId: 'u1', type: 'password_reset' }, user)).toBe(false); // legacy token, no fingerprint
  });
});

describe('session revocation', () => {
  const revokedAt = new Date('2026-10-23T12:00:00.400Z'); // cutoff second = 12:00:01
  const user = { sessionsRevokedAt: revokedAt };
  const sec12 = Math.floor(Date.parse('2026-10-23T12:00:00Z') / 1000);

  test('tokens from before (or the same second as) the revocation are revoked', () => {
    expect(sec.isSessionRevoked({ iat: sec12 - 3600 }, user)).toBe(true);
    expect(sec.isSessionRevoked({ iat: sec12 }, user)).toBe(true);
  });
  test('tokens re-issued with the cutoff iat (and anything later) are valid', () => {
    expect(sec.isSessionRevoked({ iat: sec12 + 1 }, user)).toBe(false);
    expect(sec.isSessionRevoked({ iat: sec12 + 99 }, user)).toBe(false);
  });
  test('no revocation recorded → nothing is revoked', () => {
    expect(sec.isSessionRevoked({ iat: 1 }, {})).toBe(false);
    expect(sec.isSessionRevoked({ iat: 1 }, null)).toBe(false);
  });
  test('issueTokenPair honours an explicit iat for both tokens', () => {
    const { token, refreshToken } = issueTokenPair('u1', { iat: sec12 + 1 });
    expect(jwt.decode(token).iat).toBe(sec12 + 1);
    expect(jwt.decode(refreshToken).iat).toBe(sec12 + 1);
    expect(jwt.decode(issueTokenPair('u1').token).iat).toBeGreaterThan(sec12);
  });
});

describe('lockout + account state', () => {
  test('minutes left on a lock', () => {
    const now = Date.parse('2026-10-23T12:00:00Z');
    expect(sec.lockMinutesLeft({ lockUntil: new Date(now + 14.2 * 60000) }, now)).toBe(15);
    expect(sec.lockMinutesLeft({ lockUntil: new Date(now - 1) }, now)).toBe(0);
    expect(sec.lockMinutesLeft({}, now)).toBe(0);
  });
  test('suspended and deleted accounts are disabled', () => {
    expect(sec.isAccountDisabled({ status: 'suspended' })).toBe(true);
    expect(sec.isAccountDisabled({ status: 'deleted' })).toBe(true);
    expect(sec.isAccountDisabled({ status: 'active' })).toBe(false);
    expect(sec.isAccountDisabled({})).toBe(false);
  });
});

describe('TOTP + backup codes', () => {
  const secret = speakeasy.generateSecret({ length: 20 }).base32;

  test('accepts the current code (with spaces), rejects wrong or malformed ones', () => {
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    expect(sec.verifyTotp(secret, code)).toBe(true);
    expect(sec.verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe(true);
    expect(sec.verifyTotp(secret, String((Number(code) + 1) % 1e6).padStart(6, '0'))).toBe(false);
    expect(sec.verifyTotp(secret, 'abcdef')).toBe(false);
    expect(sec.verifyTotp(null, code)).toBe(false);
  });

  test('backup codes: 10 unique, stored only as hashes, each usable once', () => {
    const { codes, hashes } = sec.generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(hashes.some((h) => codes.includes(h))).toBe(false);

    const first = sec.consumeBackupCode(hashes, codes[3].toUpperCase().replace('-', ' '));
    expect(first.ok).toBe(true);
    expect(first.remaining).toHaveLength(9);
    expect(sec.consumeBackupCode(first.remaining, codes[3]).ok).toBe(false);
    expect(sec.consumeBackupCode(hashes, '123456').ok).toBe(false);
  });

  test('the second factor accepts a TOTP code or a backup code', () => {
    const { codes, hashes } = sec.generateBackupCodes();
    const user = { twoFactorSecret: sec.encryptSecret(secret), twoFactorBackupCodes: hashes };
    expect(sec.checkSecondFactor(user, speakeasy.totp({ secret, encoding: 'base32' }))).toMatchObject({ ok: true, usedBackupCode: false });
    expect(sec.checkSecondFactor(user, codes[0])).toMatchObject({ ok: true, usedBackupCode: true });
    expect(sec.checkSecondFactor(user, '000000').ok).toBe(false);
  });

  test('secrets are encrypted at rest and round-trip', () => {
    expect(sec.secretEncryptionAvailable()).toBe(true);
    const stored = sec.encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(sec.decryptSecret(stored)).toBe(secret);
  });

  test('pending-2FA tokens: only the right type, unexpired, yields a user id', () => {
    expect(sec.readTwoFactorPendingToken(sec.issueTwoFactorPendingToken({ _id: 'abc' }))).toBe('abc');
    expect(sec.readTwoFactorPendingToken(issueTokenPair('abc').token)).toBeNull(); // an access token isn't a 2FA token
    expect(sec.readTwoFactorPendingToken('garbage')).toBeNull();
  });
});
