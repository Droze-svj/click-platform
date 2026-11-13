#!/usr/bin/env node
/**
 * verify-admin-email.js — mark the owner account(s) listed in ADMIN_EMAILS as
 * email-verified.
 *
 * Admin access needs a verified email (unverified accounts can sign in, so an
 * allowlisted address registered by someone else must not become admin). With
 * no email provider configured, the owner can't receive a verification link,
 * so the owner signs up, then this marks exactly those addresses verified.
 *
 *   node scripts/verify-admin-email.js                                   # dry-run (local)
 *   NODE_ENV=production node scripts/verify-admin-email.js --prod        # dry-run vs prod
 *   NODE_ENV=production node scripts/verify-admin-email.js --prod --apply
 *
 * Only addresses in ADMIN_EMAILS (comma-separated) are touched.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');

const APPLY = process.argv.includes('--apply');
const ALLOW_PROD = process.argv.includes('--prod');

async function main() {
  const emails = String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) throw new Error('ADMIN_EMAILS is empty');
  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, { allowProd: ALLOW_PROD, scriptName: 'verify-admin-email' });
  await mongoose.connect(uri);
  console.log(`[verify-admin-email] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const users = mongoose.connection.db.collection('users');
  for (const email of emails) {
    const u = await users.findOne({ email }, { projection: { emailVerified: 1, createdAt: 1 } });
    if (!u) { console.log(`  ${email}: no account yet — sign up first`); continue; }
    if (u.emailVerified === true) { console.log(`  ${email}: already verified`); continue; }
    if (APPLY) await users.updateOne({ _id: u._id }, { $set: { emailVerified: true } });
    console.log(`  ${email}: ${APPLY ? 'verified' : 'would be verified'} (account created ${u.createdAt ? new Date(u.createdAt).toISOString() : '?'})`);
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error('[verify-admin-email] failed:', err.message); process.exit(1); });
}
