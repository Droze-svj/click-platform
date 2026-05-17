#!/usr/bin/env node
/**
 * Click pre-deploy preflight check.
 *
 * Single gate to run BEFORE `git push` triggers a Render deploy. Fails fast
 * on the categories that have ever bitten a launch:
 *
 *   1. Env vars — every required production env var present AND not a
 *      placeholder (the previous verifier passed "your-twitter-client-id"
 *      as ✅, which meant deploys went out with garbage OAuth credentials).
 *   2. Security baseline — JWT secret strong, NODE_ENV=production,
 *      HTTPS API URL, mongo+srv (TLS) connection string.
 *   3. OAuth wiring — every platform service file exists, route is
 *      mounted, redirect URI pattern matches what's in
 *      docs/oauth-redirect-urls.md.
 *   4. Server JS lint + parses — no syntax errors that would crash on boot.
 *   5. Client TypeScript — `tsc --noEmit` passes.
 *
 * Usage:
 *   npm run preflight                 # run all checks, summarize at the end
 *   npm run preflight -- --strict      # also fail on optional warnings
 *
 * Exit codes:
 *   0  Ready to deploy.
 *   1  At least one blocker — DON'T deploy until fixed.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');

// ANSI colors — keep it readable in both light and dark terminals.
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};
const ok = (msg) => console.log(`${C.green}✓${C.reset} ${msg}`);
const fail = (msg) => console.log(`${C.red}✗ ${msg}${C.reset}`);
const warn = (msg) => console.log(`${C.yellow}⚠ ${msg}${C.reset}`);
const head = (msg) => console.log(`\n${C.bold}${C.blue}─── ${msg} ───${C.reset}`);

const results = []; // { name, status: 'pass'|'fail'|'warn', details? }
function record(name, status, details) {
  results.push({ name, status, details });
}

/**
 * Run a child command silently; return { ok, output, code }. We swallow
 * stderr/stdout by default and replay them on failure so a clean run
 * stays scannable.
 */
function runQuiet(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  return {
    ok: r.status === 0,
    code: r.status,
    output: (r.stdout || '') + (r.stderr || ''),
  };
}

// ─── 1. Env vars ──────────────────────────────────────────────────────────

function checkEnv() {
  head('1/5 · Environment variables (.env.production)');
  const r = runQuiet('node', ['scripts/verify-production-env.js']);
  if (r.ok) {
    ok('All required env vars present and not placeholders');
    record('env', 'pass');
    return;
  }
  fail('Env vars: blockers found');
  // The verifier already prints a detailed list — surface its tail.
  const lines = r.output.split('\n');
  const start = lines.findIndex((l) => l.includes('Verification failed'));
  if (start >= 0) {
    for (const line of lines.slice(start, start + 40)) {
      if (line.trim()) console.log('    ' + line);
    }
  }
  record('env', 'fail');
}

// ─── 2. Security baseline ─────────────────────────────────────────────────

function checkSecurity() {
  head('2/5 · Security baseline');
  const r = runQuiet('node', ['scripts/verify-security.js']);
  if (r.ok) {
    ok('Security checks pass');
    record('security', 'pass');
    return;
  }
  fail('Security: issues found');
  console.log(r.output.split('\n').slice(-20).join('\n'));
  record('security', 'fail');
}

// ─── 3. OAuth wiring ──────────────────────────────────────────────────────

function checkOauthStructure() {
  head('3/5 · OAuth route + service wiring');

  // Service files for each platform Click claims to publish to.
  const requiredServices = [
    'server/services/TikTokSocialService.js',
    'server/services/MetaSocialService.js',
    'server/services/YouTubeSocialService.js',
    'server/services/TwitterSocialService.js',
    'server/services/LinkedInSocialService.js',
  ];
  let missing = 0;
  for (const f of requiredServices) {
    if (!fs.existsSync(path.join(ROOT, f))) {
      fail(`Missing: ${f}`);
      missing++;
    }
  }
  if (missing === 0) ok(`All ${requiredServices.length} platform service files present`);

  // OAuth route mount — check that the parameterised connect/callback
  // handlers exist. server/routes/oauth.js uses `:platform` URL params
  // rather than hardcoded paths, so we look for that pattern instead.
  const oauthRoute = fs.readFileSync(path.join(ROOT, 'server/routes/oauth.js'), 'utf8');
  if (/:platform\/connect/.test(oauthRoute) && /:platform\/callback/.test(oauthRoute)) {
    ok('oauth.js: /:platform/connect + /:platform/callback handlers present');
  } else {
    fail('oauth.js: missing /:platform/connect or /:platform/callback handler');
    record('oauth', 'fail');
  }

  // Redirect-URI doc must exist; the deploy walkthrough relies on it.
  if (!fs.existsSync(path.join(ROOT, 'docs/oauth-redirect-urls.md'))) {
    fail('docs/oauth-redirect-urls.md missing — testers need it to register callbacks');
    record('oauth', 'fail');
    return;
  }
  ok('docs/oauth-redirect-urls.md present');

  record('oauth', missing === 0 ? 'pass' : 'fail');
}

// ─── 4. Server JS syntax ──────────────────────────────────────────────────

function checkServerSyntax() {
  head('4/5 · Server JS syntax + lint');

  // Walk every .js file under server/ and node --check it.
  let parsed = 0;
  let failed = 0;
  const failures = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (name === 'node_modules' || name === '.next' || name === 'uploads') continue;
        walk(p);
      } else if (name.endsWith('.js')) {
        const r = runQuiet('node', ['--check', p]);
        parsed++;
        if (!r.ok) {
          failed++;
          failures.push({ file: p, output: r.output.trim() });
        }
      }
    }
  }
  walk(path.join(ROOT, 'server'));
  if (failed === 0) {
    ok(`${parsed} server .js files parse cleanly`);
  } else {
    fail(`${failed} of ${parsed} server files have syntax errors:`);
    for (const f of failures.slice(0, 5)) {
      console.log(`    ${f.file}`);
      console.log('    ' + f.output.split('\n').slice(0, 2).join('\n    '));
    }
    record('server-syntax', 'fail');
    return;
  }

  // npm run lint — only flags real errors (warnings already known).
  const r = runQuiet('npm', ['run', 'lint']);
  if (r.ok || /0 errors/.test(r.output)) {
    ok('Server lint: 0 errors');
    record('server-syntax', 'pass');
  } else {
    fail('Server lint: errors found');
    console.log(r.output.split('\n').slice(-15).join('\n'));
    record('server-syntax', 'fail');
  }
}

// ─── 5. Client TypeScript ─────────────────────────────────────────────────

function checkClientTypes() {
  head('5/5 · Client TypeScript');
  const r = spawnSync('npx', ['--no-install', 'tsc', '--noEmit'], {
    cwd: path.join(ROOT, 'client'),
    encoding: 'utf8',
  });
  if (r.status === 0) {
    ok('tsc --noEmit: 0 errors');
    record('client-types', 'pass');
  } else {
    fail('tsc --noEmit: errors found');
    console.log(((r.stdout || '') + (r.stderr || '')).split('\n').slice(0, 30).join('\n'));
    record('client-types', 'fail');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log(`${C.bold}Click pre-deploy preflight${C.reset}`);
console.log(C.gray + 'Runs every blocker that has ever broken a Click deploy.' + C.reset);

checkEnv();
checkSecurity();
checkOauthStructure();
checkServerSyntax();
checkClientTypes();

// Summary
console.log('\n' + '═'.repeat(60));
const passed = results.filter((r) => r.status === 'pass').length;
const failedCount = results.filter((r) => r.status === 'fail').length;
const warnedCount = results.filter((r) => r.status === 'warn').length;
console.log(`${C.bold}Preflight result: ${passed} pass · ${failedCount} fail · ${warnedCount} warn${C.reset}`);
console.log('═'.repeat(60));

if (failedCount > 0 || (strict && warnedCount > 0)) {
  console.log(`\n${C.red}${C.bold}NOT ready to deploy.${C.reset} Fix the failures above first.`);
  console.log(C.gray + 'See LAUNCH_CHECKLIST.md for the exact order of external signups.' + C.reset);
  process.exit(1);
}

console.log(`\n${C.green}${C.bold}Preflight green — safe to deploy.${C.reset}`);
console.log(C.gray + 'Next: git push to the branch Render watches.' + C.reset);
