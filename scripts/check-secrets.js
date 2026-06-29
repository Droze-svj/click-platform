#!/usr/bin/env node
/**
 * check-secrets.js — fail CI (and pre-commit) if secrets are about to be committed.
 *
 * The single highest-leverage guardrail against a credential leak: a TRACKED
 * `.env` (the real one holds the prod Atlas URI, JWT secret, Gemini key, OAuth
 * secrets, Supabase service-role key, OAUTH_ENCRYPTION_KEY). `.env` is gitignored
 * today, but a `git add -f` or a future `.gitignore` edit could slip it in. This
 * scans only TRACKED files (git ls-files / git grep — fast, no node_modules) and
 * exits non-zero on:
 *   1. any tracked `.env*` that isn't an obvious template (.example/.sample/.template)
 *   2. private-key blocks or AWS access-key IDs in tracked files
 *
 * Usage: `node scripts/check-secrets.js`  (wired into CI's security job; also
 * usable as a git pre-commit hook — see scripts/git-hooks/pre-commit).
 */
const { execSync } = require('child_process');

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return (e.stdout || '').toString(); } // git grep exits 1 when no match
}

const problems = [];

// 1) Tracked .env files that aren't templates.
const tracked = sh('git ls-files').split('\n').filter(Boolean);
const TEMPLATE = /\.(example|sample|template)$/i;
for (const f of tracked) {
  const base = f.split('/').pop();
  if (/^\.env($|\.)/.test(base) && !TEMPLATE.test(base)) {
    problems.push(`Tracked env file: ${f} — env files must never be committed (only .env.example).`);
  }
}

// 2) Private keys / cloud keys in tracked files. Line-level so we can ignore
// well-known DOC PLACEHOLDERS (e.g. AWS's reserved AKIAIOSFODNN7EXAMPLE) that
// legitimately appear in setup guides.
const PLACEHOLDERS = [/AKIAIOSFODNN7EXAMPLE/, /EXAMPLE/i, /xxxx|your[-_]?key|placeholder|<[^>]+>/i];
const PATTERNS = [
  ['-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----', 'private key block'],
  ['AKIA[0-9A-Z]{16}', 'AWS access key id'],
];
for (const [pat, label] of PATTERNS) {
  const lines = sh(`git grep -nE '${pat}' -- . ':(exclude)scripts/check-secrets.js'`).split('\n').filter(Boolean);
  for (const line of lines) {
    // line = "path:lineno:content"
    const m = line.match(/^([^:]+):\d+:(.*)$/);
    const content = m ? m[2] : line;
    if (PLACEHOLDERS.some((p) => p.test(content))) continue; // doc placeholder, not a real secret
    problems.push(`Possible ${label}: ${m ? m[1] : line}`);
  }
}

if (problems.length) {
  console.error('\n❌ check-secrets FAILED — do not commit secrets:\n');
  problems.forEach((p) => console.error('  • ' + p));
  console.error('\nIf a real secret was committed, ROTATE it (see docs/secrets-rotation-runbook.md) and purge it from history.\n');
  process.exit(1);
}
console.log('✅ check-secrets: no tracked env files or key material found.');
