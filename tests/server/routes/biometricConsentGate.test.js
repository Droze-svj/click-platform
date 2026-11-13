// The privacy policy promises recorded consent before any voice or face data is
// processed. Voice cloning and the digital twin now refuse without it.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const UserSettings = require('../../../server/models/UserSettings');
const requireBiometricConsent = require('../../../server/middleware/requireBiometricConsent');

describe('biometric consent gate', () => {
  const userId = new mongoose.Types.ObjectId();
  const app = express();
  app.use((req, res, next) => { req.user = { _id: userId }; next(); });
  app.post('/clone', requireBiometricConsent, (req, res) => res.json({ ok: true }));

  afterEach(() => UserSettings.deleteMany({ userId }));

  it('refuses without recorded consent', async () => {
    const res = await request(app).post('/clone');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BIOMETRIC_CONSENT_REQUIRED');
  });

  it('allows once consent is recorded, and refuses again when it is withdrawn', async () => {
    await UserSettings.findOneAndUpdate({ userId }, { $set: { 'agentic.biometricConsent': true } }, { upsert: true });
    expect((await request(app).post('/clone')).status).toBe(200);
    await UserSettings.updateOne({ userId }, { $set: { 'agentic.biometricConsent': false } });
    expect((await request(app).post('/clone')).status).toBe(403);
  });
});
