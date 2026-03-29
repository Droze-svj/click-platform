#!/usr/bin/env node
/**
 * Verify LinkedIn OAuth configuration and connectivity.
 * Run: node scripts/verify-linkedin-oauth.js
 * With API: BASE_URL=http://localhost:5001 node scripts/verify-linkedin-oauth.js
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
  console.log('\n🔐 LinkedIn OAuth Verification');
  console.log('=============================\n');

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const callbackUrl = process.env.LINKEDIN_CALLBACK_URL;

  console.log('1. Environment variables');
  console.log('   LINKEDIN_CLIENT_ID:    ', clientId ? redact(clientId) : '❌ NOT SET');
  console.log('   LINKEDIN_CLIENT_SECRET:', clientSecret ? redact(clientSecret) : '❌ NOT SET');
  console.log('   LINKEDIN_CALLBACK_URL: ', callbackUrl || '(will use API host + /api/oauth/linkedin/callback)');
  const envOk = !!(clientId && clientSecret);
  if (!envOk) {
    console.log('\n❌ Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env.');
    console.log('   See OAUTH_SETUP_GUIDE.md → LinkedIn OAuth Setup.');
    process.exit(1);
  }
  console.log('   ✅ Credentials set\n');

  console.log('2. Service configuration');
  let serviceConfigured = false;
  let health = null;
  try {
    const linkedinOAuth = require('../server/services/linkedinOAuthService');
    serviceConfigured = linkedinOAuth.isConfigured();
    if (linkedinOAuth.healthCheck) {
      health = linkedinOAuth.healthCheck();
    }
    console.log('   isConfigured():', serviceConfigured ? '✅ true' : '❌ false');
    if (health && typeof health === 'object') {
      if (health.supabaseConfigured === false) console.log('   ⚠️ Supabase not configured (connection status may not persist)');
      if (health.warnings && health.warnings.length) health.warnings.forEach((w) => console.log('   ⚠️', w));
    }
  } catch (e) {
    console.log('   ❌ Failed to load service:', e.message);
  }
  if (!serviceConfigured) {
    console.log('\n❌ LinkedIn OAuth service not configured. Check .env and restart.');
    process.exit(1);
  }
  console.log('');

  console.log('3. API health (LinkedIn in OAuth status)');
  try {
    const res = await axios.get(`${BASE_URL}/api/health`, { timeout: 8000, validateStatus: () => true });
    if (res.status !== 200) {
      console.log('   ⚠️ API returned', res.status, '— is the server running? Start with: npm run dev:server');
    } else {
      const linkedin = res.data?.integrations?.oauth?.linkedin;
      if (linkedin) {
        console.log('   enabled:', linkedin.enabled ? '✅ true' : '❌ false');
      } else {
        console.log('   ⚠️ No linkedin block in health response');
      }
    }
  } catch (err) {
    console.log('   ⚠️ API unreachable:', err.message);
    console.log('   Start server: npm run dev:server');
  }
  console.log('');

  console.log('=============================');
  console.log('✅ LinkedIn OAuth verification complete');
  console.log('');
  console.log('Next steps:');
  console.log('  • In LinkedIn app Auth tab: add this exact redirect URL:');
  console.log('    ', callbackUrl || `${BASE_URL}/api/oauth/linkedin/callback`);
  console.log('  • In Click: Dashboard → Social → Connect LinkedIn');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
