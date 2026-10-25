/**
 * One place that keeps a creator's niche in sync between the two stores that
 * hold it:
 *
 *   - User.niche                                   (enum; product-wide)
 *   - UserPreferences.marketingIntelligence.niche  (what the AI reads — the
 *     marketing brain, personalization, recommendations, learning loop)
 *
 * Before this, Settings → Profile and the niche picker wrote only User.niche,
 * and the onboarding wizard / editor wrote only marketingIntelligence.niche. As
 * marketingIntelligence.niche defaults to 'General', the AI never saw a niche
 * changed anywhere but the signup screen.
 *
 * UserPreferences.userId is Mixed: the same user can be keyed by an ObjectId
 * (writers using req.user._id) or its hex string. Both forms are matched.
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { normaliseNiche } = require('./marketingKnowledge');

function userIdVariants(userId) {
  if (userId === null || userId === undefined) return [];
  const str = String(userId);
  const variants = [str];
  if (/^[a-f0-9]{24}$/i.test(str)) {
    try { variants.push(new mongoose.Types.ObjectId(str)); } catch { /* not castable */ }
  }
  return variants;
}

/**
 * Resolve a niche as typed / picked into
 *   canonical — the playbook key (always one of the User.niche enum values)
 *   label     — what marketingIntelligence.niche stores: the canonical key when
 *               one matched, otherwise the creator's own words (so a niche we
 *               have no playbook for still reaches the prompt verbatim).
 * Returns null for an empty value.
 */
function resolveNiche(raw) {
  const text = typeof raw === 'string' ? raw.trim().slice(0, 40) : '';
  if (!text) return null;
  const canonical = normaliseNiche(text);
  return { canonical, label: canonical !== 'other' ? canonical : text };
}

/**
 * $set fields on the user's UserPreferences document, whichever id form it is
 * keyed by; creates it (keyed by `userId` as given) when none exists.
 */
async function setPreferenceFields(userId, fields) {
  const UserPreferences = require('../models/UserPreferences');
  const variants = userIdVariants(userId);
  if (!variants.length || !fields || !Object.keys(fields).length) return;
  const res = await UserPreferences.updateMany({ userId: { $in: variants } }, { $set: fields });
  if (!res || !res.matchedCount) {
    try {
      await UserPreferences.create({ userId, ...expandDotted(fields) });
    } catch (err) {
      // Lost a race with another writer creating it — apply to that one.
      if (err && err.code === 11000) {
        await UserPreferences.updateMany({ userId: { $in: variants } }, { $set: fields });
      } else {
        throw err;
      }
    }
  }
}

function expandDotted(fields) {
  const out = {};
  for (const [path, value] of Object.entries(fields)) {
    const parts = path.split('.');
    let node = out;
    parts.slice(0, -1).forEach((p) => { node[p] = node[p] || {}; node = node[p]; });
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

function invalidate(userId) {
  try {
    require('./personalizationService').invalidatePersona(userId);
  } catch { /* cache is best-effort */ }
}

/**
 * Write a niche change to BOTH stores.
 * @param {*} userId
 * @param {string} rawNiche
 * @param {{ updateUser?: boolean, updatePreferences?: boolean }} [opts]
 *   updateUser=false when the caller already saved User.niche itself.
 * @returns {Promise<{canonical: string, label: string} | null>}
 */
async function syncNiche(userId, rawNiche, { updateUser = true, updatePreferences = true } = {}) {
  const resolved = resolveNiche(rawNiche) || { canonical: 'other', label: 'other' };
  if (!userId) return resolved;

  if (updateUser && mongoose.Types.ObjectId.isValid(String(userId))) {
    try {
      const User = require('../models/User');
      await User.updateOne({ _id: String(userId) }, { $set: { niche: resolved.canonical } });
    } catch (err) {
      logger.warn('[nicheSync] User.niche update failed', { userId: String(userId), error: err.message });
    }
  }
  if (updatePreferences) {
    await setPreferenceFields(userId, { 'marketingIntelligence.niche': resolved.label });
  }
  invalidate(userId);
  return resolved;
}

module.exports = { syncNiche, resolveNiche, setPreferenceFields, userIdVariants };
