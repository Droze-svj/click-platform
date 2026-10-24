// Login-protocol helpers for the MongoDB account store — the store production
// runs on (it has no Supabase). The Mongo login path used to skip everything
// the User model already had fields for: no lockout, no 2FA, no way to revoke
// a session, and reset links that worked as often as you liked for an hour.
//
// Everything here is either pure or takes the user document it acts on, so the
// route handlers stay thin and this file is unit-testable without a server.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtSecret');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const TWO_FACTOR_PENDING_TTL = '10m';
const RESET_TOKEN_TTL = '1h';
const BACKUP_CODE_COUNT = 10;

// ── Constant-time misses ─────────────────────────────────────────────────────

// Compared against when the email is unknown, so "no such account" costs the
// same bcrypt work as "wrong password" and response time can't enumerate
// accounts. Cost 10 matches User's pre-save hash. Built lazily: hashing at
// require time would slow every boot and every test file that imports auth.
let dummyHash = null;
function getDummyHash() {
  if (!dummyHash) dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
  return dummyHash;
}

async function equalizeMissTiming(password) {
  await bcrypt.compare(String(password || ''), getDummyHash());
}

// ── Passwords ────────────────────────────────────────────────────────────────
// Strength rules live in utils/passwordPolicy (one policy for every path).

/**
 * Pure: a short fingerprint of the stored password hash. A reset link carries
 * it, so the link dies the moment the password changes — which makes every
 * reset link single-use without a token table.
 */
function passwordFingerprint(passwordHash) {
  return crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 16);
}

function issueResetToken(user) {
  return jwt.sign(
    { userId: String(user._id), type: 'password_reset', pf: passwordFingerprint(user.password) },
    getJwtSecret(),
    { expiresIn: RESET_TOKEN_TTL },
  );
}

/** Pure: does a decoded reset token still match the account's current password? */
function resetTokenMatches(decoded, user) {
  return Boolean(decoded && decoded.pf && user && decoded.pf === passwordFingerprint(user.password));
}

// ── Sessions ─────────────────────────────────────────────────────────────────

// JWT `iat` has one-second resolution. Revocation is stored to the millisecond,
// so compare against the NEXT whole second: anything signed in the same second
// as (or before) the revocation is revoked, and tokens re-issued right after a
// revocation are signed with iat = that second so the current device stays in.
function revokedAtSecond(user) {
  if (!user || !user.sessionsRevokedAt) return null;
  return Math.ceil(new Date(user.sessionsRevokedAt).getTime() / 1000);
}

/** Pure: was this (decoded) token issued before the account's sessions were revoked? */
function isSessionRevoked(decoded, user) {
  const cutoff = revokedAtSecond(user);
  if (cutoff == null || !decoded || typeof decoded.iat !== 'number') return false;
  return decoded.iat < cutoff;
}

/** Pure: may this account sign in / keep using a session? */
function isAccountDisabled(user) {
  return Boolean(user && (user.status === 'suspended' || user.status === 'deleted'));
}

/**
 * Revoke every existing session for `user` and return the iat to sign the
 * caller's replacement tokens with (so the device doing the revoking stays
 * signed in). Persists via updateOne — callers needn't save().
 */
async function revokeSessions(user, now = Date.now()) {
  const at = new Date(now);
  await user.constructor.updateOne({ _id: user._id }, { $set: { sessionsRevokedAt: at } });
  user.sessionsRevokedAt = at;
  return revokedAtSecond(user);
}

// ── Lockout ──────────────────────────────────────────────────────────────────

/** Pure: minutes left on a lock, or 0 when the account isn't locked. */
function lockMinutesLeft(user, now = Date.now()) {
  if (!user || !user.lockUntil) return 0;
  const ms = new Date(user.lockUntil).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

/** Record a failed attempt; locks the account for LOCK_MINUTES on the MAX_FAILED_ATTEMPTS-th. */
async function recordFailedAttempt(user, now = Date.now()) {
  const Model = user.constructor;
  const expired = user.lockUntil && new Date(user.lockUntil).getTime() <= now;
  const attempts = expired ? 1 : (user.loginAttempts || 0) + 1;
  const update = { $set: { loginAttempts: attempts } };
  if (expired) update.$unset = { lockUntil: 1 };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    update.$set.lockUntil = new Date(now + LOCK_MINUTES * 60000);
    delete update.$unset;
  }
  await Model.updateOne({ _id: user._id }, update);
  return { attempts, locked: attempts >= MAX_FAILED_ATTEMPTS };
}

async function recordSuccessfulLogin(user, now = Date.now()) {
  await user.constructor.updateOne(
    { _id: user._id },
    { $set: { loginAttempts: 0, lastLogin: new Date(now) }, $unset: { lockUntil: 1 } },
  );
}

// ── Two-factor (TOTP) ────────────────────────────────────────────────────────

function issueTwoFactorPendingToken(user) {
  return jwt.sign({ userId: String(user._id), type: '2fa_pending' }, getJwtSecret(), { expiresIn: TWO_FACTOR_PENDING_TTL });
}

/** The pending-2FA token's userId, or null when it's invalid/expired/the wrong type. */
function readTwoFactorPendingToken(tempToken) {
  try {
    const decoded = jwt.verify(String(tempToken || ''), getJwtSecret(), { algorithms: ['HS256'] });
    return decoded && decoded.type === '2fa_pending' ? decoded.userId : null;
  } catch (_) {
    return null;
  }
}

/**
 * TOTP secrets are encrypted at rest with ENCRYPTION_KEY (utils/dataEncryption).
 * In production that key is required; without it, refuse to enable 2FA rather
 * than store a plaintext secret.
 */
function secretEncryptionAvailable() {
  try {
    const { encryptToken, isEncryptedToken } = require('../utils/dataEncryption');
    return isEncryptedToken(encryptToken('probe'));
  } catch (_) {
    return false;
  }
}

function encryptSecret(base32) {
  return require('../utils/dataEncryption').encryptToken(base32);
}

function decryptSecret(stored) {
  return require('../utils/dataEncryption').decryptToken(stored);
}

async function createTotpSetup(email) {
  const speakeasy = require('speakeasy');
  const qrcode = require('qrcode');
  const secret = speakeasy.generateSecret({ name: `Click (${email})`, issuer: 'Click', length: 20 });
  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrCodeDataUrl: await qrcode.toDataURL(secret.otpauth_url),
  };
}

const normalizeCode = (code) => String(code || '').replace(/[\s-]/g, '').toLowerCase();

/** Pure-ish: verify a 6-digit TOTP code (±30s drift). */
function verifyTotp(base32, code) {
  const digits = normalizeCode(code);
  if (!/^\d{6}$/.test(digits) || !base32) return false;
  return require('speakeasy').totp.verify({ secret: base32, encoding: 'base32', token: digits, window: 1 });
}

const hashBackupCode = (code) => crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');

/** Pure: fresh one-time backup codes (shown once) and the hashes to store. */
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes = Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashBackupCode) };
}

/** Pure: does `code` match an unused backup code? Returns the remaining hashes. */
function consumeBackupCode(hashes, code) {
  const list = Array.isArray(hashes) ? hashes : [];
  const h = hashBackupCode(code);
  const i = normalizeCode(code).length === 10 ? list.indexOf(h) : -1;
  if (i === -1) return { ok: false, remaining: list };
  return { ok: true, remaining: list.filter((_, j) => j !== i) };
}

/** Check a login/disable code: a TOTP code, or else a one-time backup code. */
function checkSecondFactor(user, code) {
  if (verifyTotp(decryptSecret(user.twoFactorSecret), code)) return { ok: true, usedBackupCode: false, remaining: user.twoFactorBackupCodes || [] };
  const backup = consumeBackupCode(user.twoFactorBackupCodes, code);
  return { ok: backup.ok, usedBackupCode: backup.ok, remaining: backup.remaining };
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  equalizeMissTiming,
  passwordFingerprint,
  issueResetToken,
  resetTokenMatches,
  isSessionRevoked,
  isAccountDisabled,
  revokeSessions,
  lockMinutesLeft,
  recordFailedAttempt,
  recordSuccessfulLogin,
  issueTwoFactorPendingToken,
  readTwoFactorPendingToken,
  secretEncryptionAvailable,
  encryptSecret,
  decryptSecret,
  createTotpSetup,
  verifyTotp,
  generateBackupCodes,
  consumeBackupCode,
  checkSecondFactor,
};
