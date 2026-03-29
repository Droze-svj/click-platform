#!/usr/bin/env node
/**
 * Ecosystem check: validate env, optional client build, optional health ping.
 * Usage:
 *   node scripts/ecosystem-check.js           # env only
 *   node scripts/ecosystem-check.js --build   # env + client build
 *   node scripts/ecosystem-check.js --health  # env + ping API health (server must be running)
 *   node scripts/ecosystem-check.js --all     # env + build + health
 */

const path = require('path');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

// Load .env so validate-env sees it
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const args = process.argv.slice(2);
const doBuild = args.includes('--build') || args.includes('--all');
const doHealth = args.includes('--health') || args.includes('--all');

function run(name, fn) {
  console.log(`\n▶ ${name}\n`);
  try {
    fn();
    console.log(`✅ ${name} passed.\n`);
    return true;
  } catch (e) {
    console.error(`❌ ${name} failed:`, e.message || e);
    return false;
  }
}

let ok = true;

// 1) Env validation (reuse validate-env.js)
ok = run('Environment validation', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'validate-env.js')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('validate-env exited with ' + r.status);
}) && ok;

// 2) Optional: client build
if (doBuild) {
  ok = run('Client build', () => {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  }) && ok;
}

// 3) Optional: health ping (non-fatal if server not running)
// Always ping local server (localhost:PORT) so we don't hit production when API_URL is set to prod
if (doHealth) {
  const healthOk = run('API health ping', () => {
    const port = process.env.PORT || '5001';
    const url = process.env.HEALTH_CHECK_URL || `http://127.0.0.1:${port}/api/health`;
    const r = spawnSync('curl', ['-sf', '--max-time', '5', url], {
      encoding: 'utf8',
      cwd: root,
    });
    if (r.status !== 0) throw new Error(`Server not reachable at ${url} (is it running? Try: npm run dev:server)`);
    const body = r.stdout || '';
    if (body && !body.includes('"status"') && !body.includes('"healthy"')) throw new Error('Unexpected health response');
  });
  if (!healthOk) {
    console.log('ℹ️  Health ping failed (server may not be running). Start with: npm run dev:server\n');
  }
  // Health failure does not change ok — only env and build determine exit code
}

process.exit(ok ? 0 : 1);
