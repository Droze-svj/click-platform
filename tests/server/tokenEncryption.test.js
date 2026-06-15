// Token-at-rest encryption hardening.
//  - utils/dataEncryption (SocialConnection tokens, AES-256-GCM): round-trips,
//    passes legacy plaintext through, and is tamper-evident.
//  - services/oauthService (legacy token store): migrated CBC→GCM but still
//    DECRYPTS legacy AES-256-CBC blobs so already-stored tokens keep working.

const crypto = require('crypto');
const { encryptToken, decryptToken, isEncryptedToken } = require('../../server/utils/dataEncryption');
const oauthService = require('../../server/services/oauthService');

describe('dataEncryption.encryptToken/decryptToken (AES-256-GCM)', () => {
  test('round-trips a token through the enc:v1 envelope', () => {
    const secret = 'ya29.a0Af-very-secret-access-token';
    const enc = encryptToken(secret);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(isEncryptedToken(enc)).toBe(true);
    expect(enc).not.toContain(secret); // ciphertext, not plaintext
    expect(decryptToken(enc)).toBe(secret);
  });

  test('passes legacy plaintext + empty/non-string values through unchanged', () => {
    expect(decryptToken('legacy-plaintext-token')).toBe('legacy-plaintext-token');
    expect(encryptToken('')).toBe('');
    expect(encryptToken(null)).toBe(null);
    expect(encryptToken(undefined)).toBe(undefined);
  });

  test('is idempotent on an already-encrypted value', () => {
    const once = encryptToken('abc');
    expect(encryptToken(once)).toBe(once);
  });

  test('a tampered ciphertext does not yield a forged plaintext (auth tag)', () => {
    const enc = encryptToken('original-token');
    // Flip a byte in the base64 payload; GCM verification must fail → decryptToken
    // returns the stored value unchanged (never a silently-forged plaintext).
    const tampered = enc.slice(0, -4) + (enc.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    const out = decryptToken(tampered);
    expect(out).not.toBe('original-token');
  });
});

describe('oauthService.encrypt/decrypt (GCM + legacy CBC read)', () => {
  test('round-trips with the new authenticated GCM format (iv:tag:ct)', () => {
    const token = 'oauth-access-token-xyz';
    const enc = oauthService.encrypt(token);
    expect(enc.split(':').length).toBe(3); // iv:tag:ciphertext
    expect(enc).not.toContain(token);
    expect(oauthService.decrypt(enc)).toBe(token);
  });

  test('still decrypts a legacy AES-256-CBC blob (iv:ct) so stored tokens survive', () => {
    const token = 'legacy-cbc-token';
    const key = Buffer.from((process.env.OAUTH_ENCRYPTION_KEY || 'development-secret-key-32-chars-!!').padEnd(32).substring(0, 32));
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const ct = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const legacyBlob = `${iv.toString('hex')}:${ct.toString('hex')}`;
    expect(oauthService.decrypt(legacyBlob)).toBe(token);
  });
});
