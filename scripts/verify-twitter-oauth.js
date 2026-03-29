#!/usr/bin/env node
/**
 * Verify X (Twitter) OAuth configuration and connectivity.
 * Run: node scripts/verify-twitter-oauth.js
 * With API: BASE_URL=http://localhost:5001 node scripts/verify-twitter-oauth.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || process.env.API_URL || 'http://localhost:5001';

function redact(str) {
  if (!str || typeof str !== 'string') return '(not set)';
  if (str.length <= 8) return '****';
  return str.slice(0, 4) + '****' + str.slice(-4);
}

async function main() {
  console.log('\n🔐 X (Twitter) OAuth Verification');
  console.log('================================\n');

  // 1. Env vars
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const callbackUrl = process.env.TWITTER_CALLBACK_URL || process.env.TWITTER_REDIRECT_URI;

  console.log('1. Environment variables');
  console.log('   TWITTER_CLIENT_ID:    ', clientId ? redact(clientId) : '❌ NOT SET');
  console.log('   TWITTER_CLIENT_SECRET:', clientSecret ? redact(clientSecret) : '❌ NOT SET');
  console.log('   TWITTER_CALLBACK_URL: ', callbackUrl || '(will use API host + /api/oauth/twitter/callback)');
  const envOk = !!(clientId && clientSecret);
  if (!envOk) {
    console.log('\n❌ Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env (from Twitter Developer Portal).');
    process.exit(1);
  }
  console.log('   ✅ Credentials set\n');

  // 2. Service config (load the service and check isConfigured)
  console.log('2. Service configuration');
  let serviceConfigured = false;
  try {
    const twitterOAuth = require('../server/services/twitterOAuthService');
    serviceConfigured = twitterOAuth.isConfigured();
    console.log('   isConfigured():', serviceConfigured ? '✅ true' : '❌ false');
  } catch (e) {
    console.log('   ❌ Failed to load service:', e.message);
  }
  if (!serviceConfigured) {
    console.log('\n❌ Twitter OAuth service not configured. Check .env and restart.');
    process.exit(1);
  }
  console.log('');

  // 3. API health (twitter oauth status)
  console.log('3. API health (Twitter OAuth status)');
  try {
    const res = await axios.get(`${BASE_URL}/api/health`, { timeout: 8000, validateStatus: () => true });
    if (res.status !== 200) {
      console.log('   ⚠️ API returned', res.status, '- is the server running?');
      console.log('   Start with: npm run dev:server');
    } else {
      const twitter = res.data?.integrations?.oauth?.twitter;
      if (twitter) {
        console.log('   enabled:   ', twitter.enabled ? '✅ true' : '❌ false');
        console.log('   configured:', twitter.configured ? '✅ true' : '❌ false');
      } else {
        console.log('   ⚠️ No twitter block in health response');
      }
    }
  } catch (err) {
    console.log('   ⚠️ API unreachable:', err.message);
    console.log('   Start server: npm run dev:server');
  }
  console.log('');

  // 4. Optional: GET /api/oauth/twitter/status (requires auth)
  console.log('4. Connection status endpoint');
  console.log('   GET /api/oauth/twitter/status (requires Authorization: Bearer <JWT>)');
  console.log('   Log in via the app, then use the token to check if X is connected.');
  console.log('');

  console.log('================================');
  console.log('✅ X OAuth verification complete');
  console.log('');
  console.log('Next steps:');
  console.log('  • In Twitter Developer Portal: ensure callback URL includes:', callbackUrl || `${BASE_URL}/api/oauth/twitter/callback`);
  console.log('  • In app: Connect X from Dashboard → Social to complete OAuth flow.');
  console.log('  • Test posting: use POST /api/oauth/twitter/post with Bearer token and { "text": "Hello from Click!" }.');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
