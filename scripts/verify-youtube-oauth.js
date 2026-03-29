#!/usr/bin/env node
/**
 * Verify YouTube (Google) OAuth configuration and connectivity.
 * Run: node scripts/verify-youtube-oauth.js
 * With API: BASE_URL=http://localhost:5001 node scripts/verify-youtube-oauth.js
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
  console.log('\n🔐 YouTube OAuth Verification');
  console.log('============================\n');

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUriEnv = process.env.YOUTUBE_REDIRECT_URI || process.env.YOUTUBE_CALLBACK_URL;

  console.log('1. Environment variables');
  console.log('   YOUTUBE_CLIENT_ID:     ', clientId ? redact(clientId) : '❌ NOT SET');
  console.log('   YOUTUBE_CLIENT_SECRET:', clientSecret ? redact(clientSecret) : '❌ NOT SET');
  console.log('   YOUTUBE_REDIRECT_URI:  ', redirectUriEnv || '(not set — app will use FRONTEND_URL + /dashboard/social/connect/youtube/callback)');
  const envOk = !!(clientId && clientSecret);
  if (!envOk) {
    console.log('\n❌ Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env.');
    console.log('   See OAUTH_SETUP_GUIDE.md → YouTube OAuth Setup.');
    process.exit(1);
  }
  console.log('   ✅ Credentials set\n');

  console.log('2. Service configuration (redirect URI sent to Google)');
  let serviceConfigured = false;
  let redirectUriUsed = redirectUriEnv || null;
  try {
    const youtubeOAuth = require('../server/services/youtubeOAuthService');
    serviceConfigured = youtubeOAuth.isConfigured();
    if (youtubeOAuth.redirectUri) redirectUriUsed = youtubeOAuth.redirectUri;
    console.log('   isConfigured():', serviceConfigured ? '✅ true' : '❌ false');
    console.log('   redirect_uri (exact):', redirectUriUsed || '(none)');
    if (serviceConfigured && (!redirectUriUsed || redirectUriUsed.includes('/dashboard/social/connect/youtube/callback'))) {
      console.log('   ⚠️ Set YOUTUBE_REDIRECT_URI=http://localhost:5001/api/oauth/youtube/callback so Google redirects to your API.');
    }
  } catch (e) {
    console.log('   ❌ Failed to load service:', e.message);
  }
  if (!serviceConfigured) {
    console.log('\n❌ YouTube OAuth service not configured. Check .env and restart.');
    process.exit(1);
  }
  console.log('');

  console.log('3. API health (YouTube in OAuth status)');
  try {
    const res = await axios.get(`${BASE_URL}/api/health`, { timeout: 8000, validateStatus: () => true });
    if (res.status !== 200) {
      console.log('   ⚠️ API returned', res.status, '— is the server running? Start with: npm run dev:server');
    } else {
      const youtube = res.data?.integrations?.oauth?.youtube;
      if (youtube) {
        console.log('   enabled:', youtube.enabled ? '✅ true' : '❌ false');
      } else {
        console.log('   ⚠️ No youtube block in health response');
      }
    }
  } catch (err) {
    console.log('   ⚠️ API unreachable:', err.message);
    console.log('   Start server: npm run dev:server');
  }
  console.log('');

  console.log('============================');
  console.log('✅ YouTube OAuth verification complete');
  console.log('');
  const finalRedirect = redirectUriUsed || 'http://localhost:5001/api/oauth/youtube/callback';
  console.log('Next steps:');
  console.log('  • In Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs');
  console.log('    Add this EXACT value (no trailing slash):');
  console.log('    ', finalRedirect);
  console.log('  • If you get "invalid request": redirect_uri must match character-for-character.');
  console.log('  • In Click: Dashboard → Social → Connect YouTube');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
