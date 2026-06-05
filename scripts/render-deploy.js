#!/usr/bin/env node
/**
 * One-shot Render deploy for Click via the Render REST API (api.render.com/v1).
 *
 * Requires RENDER_API_KEY in the environment. Reads env values from
 * .env.production (secrets) and merges any CLOUDINARY_* passed in the
 * environment. Finds or creates the `click-platform` web service, sets its env
 * vars, and triggers a deploy. Never prints secret values.
 *
 *   RENDER_API_KEY=xxx CLOUDINARY_CLOUD_NAME=.. CLOUDINARY_API_KEY=.. \
 *   CLOUDINARY_API_SECRET=.. node scripts/render-deploy.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const KEY = process.env.RENDER_API_KEY;
if (!KEY) { console.error('❌ Set RENDER_API_KEY'); process.exit(1); }

const REPO = 'https://github.com/Droze-svj/click-platform';
const BRANCH = 'main';
const SERVICE_NAME = 'click-platform';

function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request('https://api.render.com/v1' + p, {
      method,
      headers: {
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let j; try { j = d ? JSON.parse(d) : null; } catch { j = d; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else reject(new Error(`HTTP ${res.statusCode} ${method} ${p}: ${(typeof j === 'string' ? j : JSON.stringify(j)).slice(0, 400)}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// Env vars Click needs in production. We pull values from .env.production and
// process.env (for Cloudinary). Anything missing is simply skipped (logged).
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'OAUTH_ENCRYPTION_KEY', 'GOOGLE_AI_API_KEY', 'REDIS_URL'];
const OPTIONAL = [
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL', 'EMAIL_FROM', 'EMAIL_FROM_NAME',
  'BETA_ALLOWED_EMAILS', 'BETA_INVITE_CODE', 'SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN',
];
// Plain (non-secret) values we always set.
const PLAIN = {
  NODE_ENV: 'production',
  PORT: '5001',
  NEXT_TELEMETRY_DISABLED: '1',
  AUTO_VERIFY_EMAIL: 'true',
};

(async () => {
  const root = process.cwd();
  const envFile = { ...parseEnvFile(path.join(root, '.env.production')), ...parseEnvFile(path.join(root, '.env')) };
  const pick = (k) => process.env[k] || envFile[k];

  // Build env-var list.
  const vars = { ...PLAIN };
  const missingRequired = [];
  for (const k of REQUIRED) { const v = pick(k); if (v) vars[k] = v; else missingRequired.push(k); }
  for (const k of OPTIONAL) { const v = pick(k); if (v) vars[k] = v; }
  // Storage sanity: if S3 creds + bucket exist, fine; else Cloudinary needed.
  const hasCloudinary = vars.CLOUDINARY_CLOUD_NAME && vars.CLOUDINARY_API_KEY && vars.CLOUDINARY_API_SECRET;
  if (!hasCloudinary) console.warn('⚠️  No Cloudinary vars — uploads will use ephemeral disk until you add them.');
  if (missingRequired.length) {
    console.error('❌ Missing REQUIRED vars (add to .env.production or pass via env):', missingRequired.join(', '));
    process.exit(1);
  }

  console.log('🔎 Looking up Render owner…');
  const owners = await api('GET', '/owners?limit=20');
  const ownerId = owners[0] && (owners[0].owner ? owners[0].owner.id : owners[0].id);
  if (!ownerId) throw new Error('Could not resolve a Render owner for this API key');
  console.log('   owner:', owners[0].owner ? owners[0].owner.name : ownerId);

  console.log(`🔎 Looking for existing "${SERVICE_NAME}" service…`);
  const found = await api('GET', `/services?name=${SERVICE_NAME}&limit=20`);
  let svc = (found || []).map((x) => x.service || x).find((s) => s.name === SERVICE_NAME);

  const envVarsArray = Object.entries(vars).map(([key, value]) => ({ key, value: String(value) }));

  if (!svc) {
    console.log('🆕 Creating service (Docker web service from repo)…');
    const created = await api('POST', '/services', {
      type: 'web_service',
      name: SERVICE_NAME,
      ownerId,
      repo: REPO,
      branch: BRANCH,
      autoDeploy: 'yes',
      serviceDetails: {
        env: 'docker',
        region: 'oregon',
        plan: 'starter',
        healthCheckPath: '/api/health/light',
        dockerfilePath: './Dockerfile',
        envSpecificDetails: { dockerfilePath: './Dockerfile' },
      },
      envVars: envVarsArray,
    });
    svc = created.service || created;
    console.log('   ✅ created service id:', svc.id);
  } else {
    console.log('   ✅ found service id:', svc.id, '— updating env vars…');
    await api('PUT', `/services/${svc.id}/env-vars`, envVarsArray);
    console.log('   ✅ env vars set (', envVarsArray.length, 'keys )');
  }

  // Update the FRONTEND_URL/APP_URL to the real service URL once known.
  const dash = svc.serviceDetails && svc.serviceDetails.url;
  if (dash) {
    const extra = [...envVarsArray, { key: 'FRONTEND_URL', value: dash }, { key: 'APP_URL', value: dash }];
    await api('PUT', `/services/${svc.id}/env-vars`, extra).catch(() => {});
    console.log('   🌐 service URL:', dash);
  }

  console.log('🚀 Triggering deploy…');
  const deploy = await api('POST', `/services/${svc.id}/deploys`, { clearCache: 'do_not_clear' });
  console.log('   deploy id:', deploy.id, '| status:', deploy.status);
  console.log('\n✅ Done. Service:', svc.id);
  console.log('   Watch build logs in the Render dashboard. URL:', dash || '(assigned on first deploy)');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
