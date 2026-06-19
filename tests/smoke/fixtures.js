// Shared fixtures for the endpoint smoke tests.
//
// Seeds a verified user and a piece of content they own, and signs an access
// token. The mongoose connection + ISOLATED in-memory DB are owned by
// tests/setup.js, and the hard DB-safety guard in tests/setup-env.js keeps this
// off any real database — these helpers must only ever run under jest.

const jwt = require('jsonwebtoken');
const User = require('../../server/models/User');
const Content = require('../../server/models/Content');

/** Sign a bare `{ userId }` access token (the shape issueTokenPair uses; the
 *  auth middleware accepts an absent/`access` type). */
function signToken(userId) {
  return jwt.sign(
    { userId: String(userId) },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

/**
 * Create a verified user + one owned video Content (with a transcript so AI
 * endpoints have something to work on) and return them plus a signed token.
 */
async function seedSmokeFixtures() {
  const user = await new User({
    email: 'smoke-user@example.com',
    password: 'password123',
    name: 'Smoke User',
    emailVerified: true, // auth middleware 403s unverified users
  }).save();

  const content = await new Content({
    userId: user._id,
    title: 'Smoke Content',
    type: 'video',
    status: 'completed',
    transcript:
      'This is a sample transcript used by the smoke tests to exercise the AI ' +
      'endpoints end to end without needing a real media file.',
  }).save();

  return { user, content, userToken: signToken(user._id) };
}

async function cleanupSmokeFixtures() {
  await Content.deleteMany({});
  await User.deleteMany({});
}

module.exports = { seedSmokeFixtures, cleanupSmokeFixtures, signToken };
