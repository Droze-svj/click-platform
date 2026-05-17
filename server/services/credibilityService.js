/**
 * credibilityService — aggregates lightweight signals into a 0-100
 * credibility score on User. Designed to be cheap to compute and refreshed
 * lazily (on profile view, on publish). No heavy joins.
 *
 * Signals (all additive, capped per category):
 *   account-age:        +0..20  (1 month = 5, 6 months = 15, 12+ = 20)
 *   email-verified:     +10
 *   profile-completed:  +10     (display name + niche + brand color)
 *   published-content:  +0..30  (linear up to 50 posts)
 *   compliance-avg:     +0..30  (mean compliance score / 100 * 30)
 */

const logger = require('../utils/logger');

function score({ accountAgeMs, emailVerified, profileCompleted, publishedCount, avgComplianceScore }) {
  let s = 0;

  const ageMonths = accountAgeMs / (1000 * 60 * 60 * 24 * 30);
  if (ageMonths >= 12) s += 20;
  else if (ageMonths >= 6) s += 15;
  else if (ageMonths >= 1) s += 5;

  if (emailVerified) s += 10;
  if (profileCompleted) s += 10;

  s += Math.min(30, Math.round((publishedCount || 0) / 50 * 30));
  s += Math.round(((avgComplianceScore || 0) / 100) * 30);

  return Math.max(0, Math.min(100, s));
}

async function computeAndPersist(userId) {
  let User = null, Content = null, ComplianceCheck = null;
  try { User = require('../models/User'); } catch (_) { /* model optional */ }
  try { Content = require('../models/Content'); } catch (_) { /* model optional */ }
  try { ComplianceCheck = require('../models/ComplianceCheck'); } catch (_) { /* model optional */ }

  if (!User) return { score: 0, reason: 'User model unavailable' };

  const user = await User.findById(userId).lean();
  if (!user) return { score: 0, reason: 'user-not-found' };

  const accountAgeMs = Date.now() - new Date(user.createdAt || Date.now()).getTime();
  const emailVerified = !!user.emailVerified;
  const profileCompleted = !!(user.displayName && user.niche && user.brandSettings?.primaryColor);

  let publishedCount = 0;
  if (Content) {
    try { publishedCount = await Content.countDocuments({ ownerId: userId, status: 'published' }); }
    catch (_) { publishedCount = 0; }
  }

  let avgComplianceScore = 0;
  if (ComplianceCheck) {
    try {
      const recent = await ComplianceCheck.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
      if (recent.length > 0) {
        avgComplianceScore = recent.reduce((acc, c) => acc + (c.score || 0), 0) / recent.length;
      }
    } catch (_) { /* optional */ }
  }

  const computed = score({
    accountAgeMs,
    emailVerified,
    profileCompleted,
    publishedCount,
    avgComplianceScore,
  });

  try {
    await User.updateOne({ _id: userId }, { $set: { credibilityScore: computed } });
  } catch (e) {
    logger.warn('[credibility] persist failed', { error: e.message });
  }

  return {
    score: computed,
    breakdown: {
      accountAgeMs,
      emailVerified,
      profileCompleted,
      publishedCount,
      avgComplianceScore,
    },
  };
}

module.exports = {
  score,
  computeAndPersist,
};
