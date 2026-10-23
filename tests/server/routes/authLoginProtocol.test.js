/**
 * The login protocol on the MongoDB store — the store production runs on.
 * Real auth router + real auth middleware + real User model (in-memory Mongo);
 * only rate limiting and email sending are stubbed.
 *
 * Before this, the Mongo path had: no lockout, no 2FA (every 2FA route was
 * Supabase-only), reset links reusable for an hour, a change-password route
 * that crashed, and a "revoke sessions" route that revoked nothing.
 */

const mockSentResets = [];
jest.mock('../../../server/middleware/security', () => {
  const actual = jest.requireActual('../../../server/middleware/security');
  return { ...actual, authRateLimiter: (req, res, next) => next() };
});
jest.mock('../../../server/services/emailService', () => {
  const actual = jest.requireActual('../../../server/services/emailService');
  return {
    ...actual,
    sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: jest.fn(async (to, token) => { mockSentResets.push({ to, token }); return { success: true }; }),
  };
});

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const speakeasy = require('speakeasy');
const User = require('../../../server/models/User');
const authRouter = require('../../../server/routes/auth');
const auth = require('../../../server/middleware/auth');
const { decryptSecret } = require('../../../server/services/authSecurityService');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.get('/api/probe', auth, (req, res) => res.json({ ok: true, userId: String(req.user._id) }));

const PASSWORD = 'Correct-Horse-9';
const NEW_PASSWORD = 'Battery-Staple-77';
const tag = new mongoose.Types.ObjectId().toString().slice(-6);
const emailFor = (name) => `${name}-${tag}@protocol.test`;

async function makeUser(name, extra = {}) {
  return User.create({ email: emailFor(name), password: PASSWORD, name, emailVerified: true, ...extra });
}
const login = (email, password = PASSWORD) => request(app).post('/api/auth/login').send({ email, password });
const probe = (token) => request(app).get('/api/probe').set('Authorization', `Bearer ${token}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

afterAll(async () => {
  if (mongoose.connection.readyState === 1) await User.deleteMany({ email: { $regex: `-${tag}@protocol\\.test$` } });
});

describe('login: lockout, timing-safe misses, disabled accounts', () => {
  test('5 wrong passwords lock the account for 15 minutes, even against the right password; expiry unlocks', async () => {
    const user = await makeUser('lock');
    for (let i = 0; i < 4; i += 1) {
      const res = await login(user.email, 'Wrong-pass-1');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    }
    const fifth = await login(user.email, 'Wrong-pass-1');
    expect(fifth.status).toBe(423);
    expect(fifth.body.retryAfter).toBe(15 * 60);

    const rightButLocked = await login(user.email);
    expect(rightButLocked.status).toBe(423);
    expect(rightButLocked.body.error).toMatch(/Try again in 1[45] minutes/);

    await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() - 1000) } });
    const after = await login(user.email);
    expect(after.status).toBe(200);
    expect(after.body.data.token).toBeTruthy();
    const fresh = await User.findById(user._id).lean();
    expect(fresh.loginAttempts).toBe(0);
    expect(fresh.lockUntil).toBeUndefined();
    expect(fresh.lastLogin).toBeInstanceOf(Date);
  });

  test('an unknown email gets exactly the wrong-password answer', async () => {
    const res = await login(emailFor('nobody'), 'Whatever-123');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Invalid email or password' });
  });

  test('a suspended account is refused only after a correct password (no status probing)', async () => {
    const user = await makeUser('suspended', { status: 'suspended' });
    expect((await login(user.email, 'Wrong-pass-1')).status).toBe(401);
    const res = await login(user.email);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/);
  });

  test('an existing session stops working when the account is suspended', async () => {
    const user = await makeUser('susp-session');
    const { token } = (await login(user.email)).body.data;
    expect((await probe(token)).status).toBe(200);
    await User.updateOne({ _id: user._id }, { $set: { status: 'suspended' } });
    const res = await probe(token);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('two-factor authentication on MongoDB accounts', () => {
  test('setup → enable → login needs a code → TOTP or a one-time backup code → disable needs password + code', async () => {
    const user = await makeUser('twofa');
    const first = (await login(user.email)).body.data.token;
    const authz = { Authorization: `Bearer ${first}` };

    const setup = await request(app).post('/api/auth/2fa/setup').set(authz).send({});
    expect(setup.status).toBe(200);
    expect(setup.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.data.secret;
    const stored = await User.findById(user._id).lean();
    expect(stored.twoFactorTempSecret).not.toContain(secret); // encrypted at rest
    expect(decryptSecret(stored.twoFactorTempSecret)).toBe(secret);

    expect((await request(app).post('/api/auth/2fa/enable').set(authz).send({ token: '000000' })).status).toBe(400);
    const enable = await request(app).post('/api/auth/2fa/enable').set(authz)
      .send({ token: speakeasy.totp({ secret, encoding: 'base32' }) });
    expect(enable.status).toBe(200);
    const backupCodes = enable.body.data.backupCodes;
    expect(backupCodes).toHaveLength(10);
    const afterEnable = await User.findById(user._id).lean();
    expect(afterEnable.twoFactorEnabled).toBe(true);
    expect(afterEnable.twoFactorBackupCodes).not.toContain(backupCodes[0]); // hashes only

    const status = await request(app).get('/api/auth/2fa/status').set(authz);
    expect(status.body.data).toMatchObject({ enabled: true, backupCodesRemaining: 10, available: true });

    // Password alone no longer signs in.
    const step1 = await login(user.email);
    expect(step1.status).toBe(200);
    expect(step1.body.data.requiresTwoFactor).toBe(true);
    expect(step1.body.data.token).toBeUndefined();
    const { tempToken } = step1.body.data;
    // The pending token is not an access token.
    expect((await probe(tempToken)).status).toBe(401);

    const wrong = await request(app).post('/api/auth/2fa/verify').send({ tempToken, token: '000000' });
    expect(wrong.status).toBe(401);

    const ok = await request(app).post('/api/auth/2fa/verify')
      .send({ tempToken, token: speakeasy.totp({ secret, encoding: 'base32' }) });
    expect(ok.status).toBe(200);
    expect((await probe(ok.body.data.token)).status).toBe(200);
    expect((await User.findById(user._id).lean()).loginAttempts).toBe(0); // success clears the wrong code

    // Backup code works once.
    const tmp2 = (await login(user.email)).body.data.tempToken;
    const viaBackup = await request(app).post('/api/auth/2fa/verify').send({ tempToken: tmp2, token: backupCodes[0] });
    expect(viaBackup.status).toBe(200);
    expect(viaBackup.body.data.backupCodesRemaining).toBe(9);
    const tmp3 = (await login(user.email)).body.data.tempToken;
    expect((await request(app).post('/api/auth/2fa/verify').send({ tempToken: tmp3, token: backupCodes[0] })).status).toBe(401);

    // Disabling needs both the password and a code.
    expect((await request(app).post('/api/auth/2fa/disable').set(authz).send({ token: backupCodes[1] })).status).toBe(400);
    expect((await request(app).post('/api/auth/2fa/disable').set(authz).send({ password: 'Wrong-pass-1', token: backupCodes[1] })).status).toBe(401);
    const off = await request(app).post('/api/auth/2fa/disable').set(authz).send({ password: PASSWORD, token: backupCodes[1] });
    expect(off.status).toBe(200);
    const afterOff = await User.findById(user._id).lean();
    expect(afterOff.twoFactorEnabled).toBe(false);
    expect(afterOff.twoFactorSecret).toBeUndefined();
    expect((await login(user.email)).body.data.token).toBeTruthy();
  });

  test('wrong 2FA codes count toward the lockout', async () => {
    const user = await makeUser('twofa-lock');
    const authz = { Authorization: `Bearer ${(await login(user.email)).body.data.token}` };
    const secret = (await request(app).post('/api/auth/2fa/setup').set(authz).send({})).body.data.secret;
    await request(app).post('/api/auth/2fa/enable').set(authz).send({ token: speakeasy.totp({ secret, encoding: 'base32' }) });
    const { tempToken } = (await login(user.email)).body.data;
    let last;
    for (let i = 0; i < 5; i += 1) last = await request(app).post('/api/auth/2fa/verify').send({ tempToken, token: '000000' });
    expect(last.status).toBe(423);
    const blocked = await request(app).post('/api/auth/2fa/verify').send({ tempToken, token: speakeasy.totp({ secret, encoding: 'base32' }) });
    expect(blocked.status).toBe(423);
  });
});

describe('password reset, change, and session revocation', () => {
  test('reset links work once, sign out every session, and unlock the account', async () => {
    const user = await makeUser('reset', { loginAttempts: 5, lockUntil: new Date(Date.now() + 10 * 60000) });
    await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    const oldSession = (await login(user.email)).body.data;
    await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 5, lockUntil: new Date(Date.now() + 10 * 60000) } });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(forgot.body.message).toMatch(/If the email exists/);
    const { token } = mockSentResets.find((m) => m.to === user.email);
    expect((await request(app).get(`/api/auth/validate-reset-token/${token}`)).body.valid).toBe(true);

    expect((await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'short' })).status).toBe(400);

    await sleep(1100); // cross a JWT-second boundary so "before the reset" is unambiguous
    const reset = await request(app).post('/api/auth/reset-password').send({ token, newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    // Single use.
    const again = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Another-pass-5' });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already been used/);
    expect((await request(app).get(`/api/auth/validate-reset-token/${token}`)).body.valid).toBe(false);

    // Everything issued before the reset is dead.
    const old = await probe(oldSession.token);
    expect(old.status).toBe(401);
    expect(old.body.code).toBe('SESSION_REVOKED');
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: oldSession.refreshToken })).status).toBe(401);

    // New password works, and the reset lifted the lock.
    expect((await login(user.email)).status).toBe(401);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  test('an unknown email gets the same forgot-password answer and no email', async () => {
    const before = mockSentResets.length;
    const res = await request(app).post('/api/auth/forgot-password').send({ email: emailFor('ghost') });
    expect(res.body).toMatchObject({ success: true, message: 'If the email exists, a reset link has been sent.' });
    expect(mockSentResets.length).toBe(before);
  });

  test('change-password works on Mongo, keeps this device signed in and signs out the others', async () => {
    const user = await makeUser('change');
    const other = (await login(user.email)).body.data;
    const mine = (await login(user.email)).body.data;
    await sleep(1100);

    expect((await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${mine.token}`)
      .send({ currentPassword: 'Wrong-pass-1', newPassword: NEW_PASSWORD })).status).toBe(401);

    const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${mine.token}`)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect((await probe(res.body.data.token)).status).toBe(200);
    expect((await probe(other.token)).status).toBe(401);
    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  test('deactivate works on Mongo: wrong password refused, then the account is disabled and signed out', async () => {
    const user = await makeUser('deactivate');
    const { token } = (await login(user.email)).body.data;
    const authz = { Authorization: `Bearer ${token}` };
    expect((await request(app).post('/api/auth/deactivate').set(authz).send({ password: 'Wrong-pass-1' })).status).toBe(401);
    await sleep(1100);
    const res = await request(app).post('/api/auth/deactivate').set(authz).send({ password: PASSWORD, reason: 'test' });
    expect(res.status).toBe(200);
    expect((await probe(token)).status).toBe(401);
    expect((await login(user.email)).status).toBe(403);
    expect(await User.findById(user._id).lean()).toMatchObject({ status: 'suspended', deactivationReason: 'test' });
  });

  test('"sign out of all devices" actually revokes sessions and refresh tokens', async () => {
    const user = await makeUser('revoke');
    const other = (await login(user.email)).body.data;
    const mine = (await login(user.email)).body.data;
    await sleep(1100);

    const res = await request(app).post('/api/auth/revoke-sessions').set('Authorization', `Bearer ${mine.token}`).send({});
    expect(res.status).toBe(200);
    expect((await probe(other.token)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: other.refreshToken })).status).toBe(401);
    expect((await probe(res.body.data.token)).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: res.body.data.refreshToken })).status).toBe(200);
  });
});
