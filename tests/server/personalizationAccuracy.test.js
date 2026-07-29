// Personalization ACCURACY — a preference a user sets must actually reach the AI,
// and never leak across users. Guards the identity-key/store-split bugs the
// write-sweep audit surfaced (UserPreferences Mixed key + dual Settings/Prefs
// stores where only one fed the AI).

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../server/index');
const User = require('../../server/models/User');
const UserSettings = require('../../server/models/UserSettings');
const UserPreferences = require('../../server/models/UserPreferences');
const personalization = require('../../server/services/personalizationService');

function tokenFor(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}
async function makeUser(email) {
  return new User({ email, password: 'password123', name: email, emailVerified: true }).save();
}

describe('personalization accuracy', () => {
  // Each test uses fresh users (unique emails + new ObjectIds), so the 60s
  // persona TTL cache can't bleed across tests; just clear the data.
  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}), UserSettings.deleteMany({}), UserPreferences.deleteMany({}),
    ]);
  });

  it('a voice tone set via /api/user/settings reaches the AI persona (Settings→AI bridge)', async () => {
    const a = await makeUser('accuracy-a@example.com');
    const res = await request(app)
      .put('/api/user/settings')
      .set('Authorization', `Bearer ${tokenFor(a)}`)
      .send({ videoEditing: { preferredVoiceTone: 'Deadpan Sarcastic' } });
    expect(res.status).toBe(200);

    const persona = await personalization.getPersona(a._id);
    expect(persona.voice.tone).toBe('Deadpan Sarcastic');

    // …and it lands in the built system prompt the generators use.
    const prompt = await personalization.buildPersonalizedSystemPrompt({ userId: a._id });
    expect(prompt).toContain('Deadpan Sarcastic');
  });

  it('a preference set under the hex-STRING key is still read (Mixed-key legacy fallback)', async () => {
    const a = await makeUser('accuracy-legacy@example.com');
    // Simulate a legacy writer that keyed UserPreferences by the hex string
    // (the old creatorDna/digitalTwin id-first behavior).
    await UserPreferences.create({
      userId: a._id.toString(),
      videoEditing: { preferredHookStyle: 'pattern-interrupt' },
    });
    const persona = await personalization.getPersona(a._id); // read with ObjectId
    expect(persona.voice.hookStyle).toBe('pattern-interrupt');
  });

  it('UserPreferences (richer store) wins over UserSettings on a conflicting field', async () => {
    const a = await makeUser('accuracy-precedence@example.com');
    await UserSettings.create({ userId: a._id.toString(), videoEditing: { preferredVoiceTone: 'Hype' } });
    await UserPreferences.create({ userId: a._id, videoEditing: { preferredVoiceTone: 'Calm Authority' } });
    const persona = await personalization.getPersona(a._id);
    expect(persona.voice.tone).toBe('Calm Authority');
  });

  it('preferences never leak across users', async () => {
    const a = await makeUser('accuracy-iso-a@example.com');
    const b = await makeUser('accuracy-iso-b@example.com');
    await request(app).put('/api/user/settings')
      .set('Authorization', `Bearer ${tokenFor(a)}`)
      .send({ videoEditing: { preferredVoiceTone: 'A-Only Tone' } });

    const personaB = await personalization.getPersona(b._id);
    expect(personaB.voice.tone).not.toBe('A-Only Tone');

    // B's /api/me/ai-preferences must not reflect A's settings either.
    const resB = await request(app).get('/api/me/ai-preferences')
      .set('Authorization', `Bearer ${tokenFor(b)}`);
    expect(resB.status).toBe(200);
    expect(JSON.stringify(resB.body)).not.toContain('A-Only Tone');
  });

  it('the same user maps to ONE preferences doc regardless of id form passed to getPersona', async () => {
    const a = await makeUser('accuracy-onekey@example.com');
    await request(app).put('/api/user/settings')
      .set('Authorization', `Bearer ${tokenFor(a)}`)
      .send({ videoEditing: { preferredVoiceTone: 'Single Source' } });
    // Read with both the ObjectId and its hex string — both must resolve the tone.
    const byObj = await personalization.getPersona(a._id);
    const byStr = await personalization.getPersona(a._id.toString());
    expect(byObj.voice.tone).toBe('Single Source');
    expect(byStr.voice.tone).toBe('Single Source');
  });
});
