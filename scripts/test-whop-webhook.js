#!/usr/bin/env node

/**
 * Whop Webhook Testing & Simulation Utility
 * 
 * Generates valid HMAC-SHA256 signatures using the production/local 
 * WHOP_WEBHOOK_SECRET and sends mock payment events (creation or cancellation) 
 * to verify database integration works seamlessly.
 * 
 * Usage:
 *   node scripts/test-whop-webhook.js --email=user@example.com --plan=pro --action=succeeded
 *   node scripts/test-whop-webhook.js --email=user@example.com --plan=creator --action=cancelled
 * 
 * Options:
 *   --email=<email>    The user's registered email to upgrade/downgrade (Required)
 *   --plan=<tier>      Plan tier: 'creator', 'pro', 'agency' (Default: 'creator')
 *   --action=<action>  Action type: 'succeeded' (upgrade) or 'cancelled' (downgrade) (Default: 'succeeded')
 *   --url=<url>        Destination endpoint (Default: http://localhost:5001/api/webhooks/whop)
 *   --live             Shortcut to target NEXT_PUBLIC_APP_URL/api/webhooks/whop
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Helper to load env files
function loadEnv(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  const env = {};
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[match[1].trim()] = val;
    }
  });
  return env;
}

// 1. Gather configuration
const localEnv = loadEnv('.env');
const prodEnv = loadEnv('.env.production');
const env = { ...localEnv, ...prodEnv, ...process.env };

// Parse args
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    args[key] = value || true;
  }
});

const email = args.email;
const planTier = args.plan || 'creator';
const action = args.action || 'succeeded';
const isLive = args.live || false;

if (!email) {
  console.error('\x1b[31mError: --email option is required.\x1b[0m');
  console.log('Example: node scripts/test-whop-webhook.js --email=user@example.com --plan=pro --action=succeeded');
  process.exit(1);
}

// Map plans to Whop Product IDs from env
const planToProductKey = `WHOP_PRODUCT_ID_${planTier.toUpperCase()}_MONTHLY`;
const productId = env[planToProductKey] || `prod_${planTier}_monthly`;
const secret = env.WHOP_WEBHOOK_SECRET;

if (!secret) {
  console.error('\x1b[31mError: WHOP_WEBHOOK_SECRET not found in environment or env files.\x1b[0m');
  process.exit(1);
}

// Determine destination URL
let targetUrl = args.url || 'http://localhost:5001/api/webhooks/whop';
if (isLive) {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || env.APP_URL || 'https://sovereign-platform.onrender.com';
  targetUrl = `${baseUrl}/api/webhooks/whop`;
}

console.log(`\x1b[36m⚙️ Testing Whop Webhook with settings:\x1b[0m`);
console.log(`  Target Email:  ${email}`);
console.log(`  Target Plan:   ${planTier} (Product ID: ${productId})`);
console.log(`  Action Type:   ${action}`);
console.log(`  Destination:   ${targetUrl}`);
console.log(`  Secret Key:    ${secret.slice(0, 10)}...`);

// 2. Build mock Whop event payload
const eventId = `evt_test_${crypto.randomBytes(6).toString('hex')}`;
const subId = `sub_test_${crypto.randomBytes(6).toString('hex')}`;
const actionString = action === 'succeeded' ? 'payment.succeeded' : 'subscription.cancelled';

const payload = {
  id: eventId,
  action: actionString,
  type: actionString,
  created_at: Math.floor(Date.now() / 1000),
  data: {
    id: subId,
    product_id: productId,
    plan_id: productId,
    user_id: `usr_test_${crypto.randomBytes(6).toString('hex')}`,
    email: email.toLowerCase().trim(),
    status: action === 'succeeded' ? 'active' : 'cancelled',
    expires_at: action === 'succeeded' ? null : Math.floor((Date.now() + 30 * 24 * 3600 * 1000) / 1000)
  }
};

const payloadString = JSON.stringify(payload);

// 3. Generate SHA-256 HMAC signature
const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

// 4. Send request
const parsedUrl = new URL(targetUrl);
const protocol = parsedUrl.protocol === 'https:' ? https : http;

const options = {
  hostname: parsedUrl.hostname,
  port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'x-whop-signature': signature
  }
};

console.log(`\x1b[34m📤 Sending payload to webhook endpoint...\x1b[0m`);

const req = protocol.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`\x1b[35m📥 Response status code: ${res.statusCode}\x1b[0m`);
    try {
      const parsedBody = JSON.parse(body);
      if (res.statusCode === 200) {
        console.log(`\x1b[32m✅ Success! Webhook processed correctly:\x1b[0m`);
        console.log(JSON.stringify(parsedBody, null, 2));
      } else {
        console.error(`\x1b[31m❌ Webhook server returned an error:\x1b[0m`);
        console.error(body);
      }
    } catch {
      console.log(`\x1b[33mRaw Response:\x1b[0m\n${body}`);
    }
  });
});

req.on('error', (err) => {
  console.error(`\x1b[31m❌ Connection failed: ${err.message}\x1b[0m`);
  console.log('   Ensure the local server is running at port 5001 or pass a valid target URL.');
});

req.write(payloadString);
req.end();
