#!/usr/bin/env node
/**
 * Create (or refresh) the account that platform reviewers (Meta / Google /
 * TikTok App Review) sign in with: email verified, Pro access for a year.
 *
 *   REVIEW_EMAIL=app-review@… REVIEW_PASSWORD=… NODE_ENV=production \
 *     node scripts/create-review-account.js --prod --apply
 *
 * The password is read from the environment and never printed. Without
 * --apply it only reports what it would do. Re-running updates the password
 * and extends the access instead of creating a second account.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { assertSafeScriptDbUri, redactUri } = require('../server/utils/dbSafety');

const APPLY = process.argv.includes('--apply');
const ALLOW_PROD = process.argv.includes('--prod');

async function main() {
  const email = String(process.env.REVIEW_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.REVIEW_PASSWORD || '');
  if (!email) throw new Error('REVIEW_EMAIL is empty');
  if (password.length < 12) throw new Error('REVIEW_PASSWORD must be at least 12 characters');

  const uri = assertSafeScriptDbUri(process.env.MONGODB_URI || process.env.MONGO_URI, { allowProd: ALLOW_PROD, scriptName: 'create-review-account' });
  await mongoose.connect(uri);
  console.log(`[create-review-account] db=${redactUri(uri)} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const User = require('../server/models/User');
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  let user = await User.findOne({ email });

  if (!APPLY) {
    console.log(`  ${email}: would be ${user ? 'updated' : 'created'} (verified, Pro until ${endDate.toISOString().slice(0, 10)})`);
    await mongoose.disconnect();
    return;
  }

  if (!user) user = new User({ email, name: 'App Review' });
  user.password = password; // hashed by the model's pre-save hook
  user.emailVerified = true;
  user.subscription = { ...(user.subscription?.toObject?.() || user.subscription || {}), plan: 'pro', status: 'active', startDate: new Date(), endDate };
  await user.save();

  const saved = await User.findById(user._id).select('+password').lean();
  if (!saved.password || saved.password === password) throw new Error('password was not hashed — aborting');
  console.log(`  ${email}: ready (id ${user._id}, verified, Pro until ${endDate.toISOString().slice(0, 10)})`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => { console.error('[create-review-account] failed:', err.message); process.exit(1); });
}
