#!/usr/bin/env node
/**
 * Comp beta testers: grant a list of email addresses full, long-lived access so
 * they can evaluate every Click feature without hitting a paywall, quota, or
 * trial expiry. Idempotent — safe to re-run.
 *
 * Sets, for each existing user matching an email:
 *   subscription.status = 'active'
 *   subscription.plan   = 'agency'   (maps to the top 'elite' feature tier)
 *   subscription.endDate = now + 1 year
 *   (role is left untouched so testers experience the normal, non-admin product)
 *
 * Usage:
 *   node scripts/comp-beta-testers.js a@x.com b@y.com c@z.com ...
 *   BETA_TESTERS="a@x.com,b@y.com" node scripts/comp-beta-testers.js
 *
 * Notes:
 *   - The user must already exist (have them register first, then run this).
 *   - Requires MONGODB_URI in the environment (.env is loaded).
 *   - This targets the MongoDB store (the beta auth store). If you run Supabase
 *     auth, comp via the Supabase users table instead.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../server/models/User');

async function main() {
  const fromArgs = process.argv.slice(2);
  const fromEnv = (process.env.BETA_TESTERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const emails = [...new Set([...fromArgs, ...fromEnv])].map((e) => e.toLowerCase());

  if (emails.length === 0) {
    console.error('Usage: node scripts/comp-beta-testers.js <email> [email...]');
    console.error('   or: BETA_TESTERS="a@x.com,b@y.com" node scripts/comp-beta-testers.js');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set. Add it to your environment / .env.');
    process.exit(1);
  }

  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await mongoose.connect(require('../server/utils/dbSafety').assertSafeScriptDbUri(process.env.MONGODB_URI, { allowProd: process.argv.includes('--prod'), scriptName: 'comp-beta-testers' }));
  console.log('✅ Connected to MongoDB\n');

  let comped = 0;
  const missing = [];
  for (const email of emails) {
    const user = await User.findOne({ email });
    if (!user) {
      missing.push(email);
      console.log(`⚠️  ${email} — not found (have them register first, then re-run)`);
      continue;
    }
    user.subscription = {
      ...(user.subscription || {}),
      status: 'active',
      plan: 'agency',
      startDate: user.subscription?.startDate || new Date(),
      endDate: oneYear,
    };
    if (user.emailVerified === false) user.emailVerified = true;
    await user.save();
    comped++;
    console.log(`✅ ${email} — comped: active / agency (elite tier) until ${oneYear.toISOString().slice(0, 10)}`);
  }

  console.log(`\nDone. Comped ${comped}/${emails.length}.`);
  if (missing.length) {
    console.log(`Not found (register first): ${missing.join(', ')}`);
  }
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
