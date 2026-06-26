// "Unique for each user" — the durable proof.
//
// Two users (A, B) on the SAME in-memory DB. We assert the three things that make
// a multi-tenant creator app trustworthy:
//   1. Read isolation   — A never sees B's content (list excludes it; by-id → 404, no leak).
//   2. Write isolation   — content A creates does NOT appear in B's list.
//   3. Personalization uniqueness — each user's learned style profile + the AI system
//      prompt built from it reflect THEIR OWN choices and differ from the other user's
//      (no shared/generic persona served to everyone).
//
// DB is the isolated in-memory Mongo owned by tests/setup.js (the setup-env guard
// forbids any remote/Atlas URI). Connection lifecycle is global — we only manage our data.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server/index');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');
const UserStyleProfile = require('../../server/models/UserStyleProfile');
const personalization = require('../../server/services/personalizationService');

function tokenFor(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

async function makeUser(email) {
  return new User({ email, password: 'password123', name: email, emailVerified: true }).save();
}

describe('per-user isolation & uniqueness', () => {
  let userA, userB, tokenA, tokenB;

  beforeEach(async () => {
    userA = await makeUser('isolation-a@example.com');
    userB = await makeUser('isolation-b@example.com');
    tokenA = tokenFor(userA);
    tokenB = tokenFor(userB);
  });

  afterEach(async () => {
    await Promise.all([
      Content.deleteMany({}),
      User.deleteMany({}),
      UserStyleProfile.deleteMany({}),
    ]);
    personalization.invalidatePersona(userA?._id);
    personalization.invalidatePersona(userB?._id);
  });

  describe('data isolation (read + write)', () => {
    it("A's content list never contains B's content, and vice-versa", async () => {
      const aDoc = await new Content({ userId: userA._id, title: 'A-only clip', type: 'video', status: 'completed' }).save();
      const bDoc = await new Content({ userId: userB._id, title: 'B-only clip', type: 'video', status: 'completed' }).save();

      const aList = (await request(app).get('/api/content').set('Authorization', `Bearer ${tokenA}`).expect(200)).body.data;
      const bList = (await request(app).get('/api/content').set('Authorization', `Bearer ${tokenB}`).expect(200)).body.data;

      // Compare by the unique title (a plain projected string) — robust to _id serialization.
      const titles = (list) => list.map((c) => c.title);
      expect(titles(aList)).toContain('A-only clip');
      expect(titles(aList)).not.toContain('B-only clip'); // A cannot see B's
      expect(titles(bList)).toContain('B-only clip');
      expect(titles(bList)).not.toContain('A-only clip'); // B cannot see A's
      // A and B genuinely got different lists.
      expect(titles(aList)).not.toEqual(titles(bList));
      void aDoc; void bDoc;
    });

    it("A fetching B's content by id → 404 (no existence leak, not 403)", async () => {
      const bDoc = await new Content({ userId: userB._id, title: 'B private', type: 'video' }).save();
      await request(app).get(`/api/content/${bDoc._id}`).set('Authorization', `Bearer ${tokenA}`).expect(404);
    });

    it('write isolation: content A creates afterwards still never appears in B\'s list', async () => {
      // baseline: B's list empty of A
      const before = (await request(app).get('/api/content').set('Authorization', `Bearer ${tokenB}`).expect(200)).body.data;
      const newDoc = await new Content({ userId: userA._id, title: 'A fresh write', type: 'video', status: 'completed' }).save();
      const after = (await request(app).get('/api/content').set('Authorization', `Bearer ${tokenB}`).expect(200)).body.data;

      expect(after.map((c) => c.title)).not.toContain('A fresh write');
      // B's list didn't grow because of A's write
      expect(after.length).toBe(before.length);
      void newDoc;
    });
  });

  describe('personalization uniqueness', () => {
    const aPicks = [
      { facet: 'fonts', key: 'Impact' },
      { facet: 'captionStyles', key: 'hormozi-bold' },
      { facet: 'presets', key: 'mrbeast-energy' },
    ];
    const bPicks = [
      { facet: 'fonts', key: 'Georgia' },
      { facet: 'captionStyles', key: 'minimal-white' },
      { facet: 'presets', key: 'cinematic-doc' },
    ];

    const fontsOf = (persona) => (persona.styleProfile?.fonts || []).map((f) => f.key);

    it("each user's learned style profile reflects their OWN picks, not the other's", async () => {
      await personalization.recordChoices(userA._id, aPicks);
      await personalization.recordChoices(userB._id, bPicks);

      const personaA = await personalization.getPersona(userA._id);
      const personaB = await personalization.getPersona(userB._id);

      expect(fontsOf(personaA)).toContain('Impact');
      expect(fontsOf(personaA)).not.toContain('Georgia');
      expect(fontsOf(personaB)).toContain('Georgia');
      expect(fontsOf(personaB)).not.toContain('Impact');
      // the two personas are genuinely different objects
      expect(fontsOf(personaA)).not.toEqual(fontsOf(personaB));
    });

    it('the AI system prompt built per user is unique (different learned style → different prompt)', async () => {
      await personalization.recordChoices(userA._id, aPicks);
      await personalization.recordChoices(userB._id, bPicks);

      const promptA = await personalization.buildPersonalizedSystemPrompt({ userId: userA._id, niche: 'fitness', platform: 'tiktok' });
      const promptB = await personalization.buildPersonalizedSystemPrompt({ userId: userB._id, niche: 'fitness', platform: 'tiktok' });
      const promptCold = await personalization.buildPersonalizedSystemPrompt({ userId: null, niche: 'fitness', platform: 'tiktok' });

      expect(typeof promptA).toBe('string');
      expect(promptA.length).toBeGreaterThan(0);
      // personalization actually changes the prompt (not the generic cold-start one)…
      expect(promptA).not.toBe(promptCold);
      expect(promptB).not.toBe(promptCold);
      // …and the two users do NOT get the same prompt.
      expect(promptA).not.toBe(promptB);
    });
  });
});
