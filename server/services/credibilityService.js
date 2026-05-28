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

function score({ accountAgeMs, emailVerified, profileCompleted, publishedCount, avgComplianceScore, c2paSigningRatio = 0, aeoEnabled = false }) {
  let s = 0;

  const ageMonths = accountAgeMs / (1000 * 60 * 60 * 24 * 30);
  if (ageMonths >= 12) s += 15;
  else if (ageMonths >= 6) s += 10;
  else if (ageMonths >= 1) s += 5;

  if (emailVerified) s += 5;
  if (profileCompleted) s += 5;

  s += Math.min(20, Math.round((publishedCount || 0) / 50 * 20));
  s += Math.round(((avgComplianceScore || 0) / 100) * 20);

  // Cryptographic Provenance & Search Transparency Bonuses
  s += Math.round((c2paSigningRatio || 0) * 20);
  if (aeoEnabled) s += 15;

  return Math.max(0, Math.min(100, s));
}

async function computeAndPersist(userId) {
  let User = null, Content = null, ComplianceCheck = null, AuditMetadata = null;
  try { User = require('../models/User'); } catch (_) { /* model optional */ }
  try { Content = require('../models/Content'); } catch (_) { /* model optional */ }
  try { ComplianceCheck = require('../models/ComplianceCheck'); } catch (_) { /* model optional */ }
  try { AuditMetadata = require('../models/AuditMetadata'); } catch (_) { /* model optional */ }

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

  // Cryptographic Provenance & Search Transparency checks
  let c2paSigningRatio = 0;
  let aeoEnabled = false;
  
  if (AuditMetadata && publishedCount > 0) {
    try {
      const signedCount = await AuditMetadata.countDocuments({
        userId: String(userId),
        'authenticity.c2paBlock.signed': true
      });
      c2paSigningRatio = Math.min(1.0, signedCount / publishedCount);

      const aeoDoc = await AuditMetadata.findOne({
        userId: String(userId),
        'aeo.schemaMarkup': { $exists: true }
      }).lean();
      aeoEnabled = !!aeoDoc;
    } catch (_) {
      c2paSigningRatio = 0;
      aeoEnabled = false;
    }
  }

  const ageMonths = accountAgeMs / (1000 * 60 * 60 * 24 * 30);
  const agePoints = ageMonths >= 12 ? 15 : ageMonths >= 6 ? 10 : ageMonths >= 1 ? 5 : 0;
  const contentPoints = Math.min(20, Math.round((publishedCount || 0) / 50 * 20));
  const compliancePoints = Math.round(((avgComplianceScore || 0) / 100) * 20);
  const c2paPoints = Math.round((c2paSigningRatio || 0) * 20);

  const computed = score({
    accountAgeMs, emailVerified, profileCompleted,
    publishedCount, avgComplianceScore, c2paSigningRatio, aeoEnabled,
  });

  // Level thresholds
  let level = 'Rising';
  let levelColor = 'amber';
  if (computed >= 80) { level = 'Elite'; levelColor = 'violet'; }
  else if (computed >= 60) { level = 'Trusted'; levelColor = 'emerald'; }
  else if (computed >= 35) { level = 'Established'; levelColor = 'sky'; }

  // Itemised breakdown with action hints
  const breakdown = [
    { signal: 'account_age',        label: 'Account Age',           points: agePoints,        maxPoints: 15, achieved: agePoints >= 15, actionHint: agePoints < 15 ? 'Account trust grows with time. Keep creating.' : null },
    { signal: 'email_verified',     label: 'Email Verified',        points: emailVerified ? 5 : 0,  maxPoints: 5,  achieved: emailVerified, actionHint: emailVerified ? null : 'Verify your email to add +5 Trust Points.' },
    { signal: 'profile_completed',  label: 'Profile Completed',     points: profileCompleted ? 5 : 0, maxPoints: 5, achieved: profileCompleted, actionHint: profileCompleted ? null : 'Add your niche, display name, and brand color for +5 points.' },
    { signal: 'content_published',  label: 'Content Published',     points: contentPoints,    maxPoints: 20, achieved: contentPoints >= 20, actionHint: contentPoints < 20 ? `Publish ${50 - (publishedCount || 0)} more posts for full score.` : null },
    { signal: 'compliance',         label: 'Content Compliance',    points: compliancePoints, maxPoints: 20, achieved: compliancePoints >= 20, actionHint: compliancePoints < 20 ? 'Enable compliance checks on your posts for higher scores.' : null },
    { signal: 'c2pa_signing',       label: 'C2PA Provenance',       points: c2paPoints,       maxPoints: 20, achieved: c2paPoints >= 18, actionHint: c2paPoints < 18 ? 'Sign your content with C2PA for cryptographic authenticity.' : null },
    { signal: 'aeo_enabled',        label: 'Search Transparency',   points: aeoEnabled ? 15 : 0, maxPoints: 15, achieved: aeoEnabled, actionHint: aeoEnabled ? null : 'Enable AEO schema markup so your content is verifiable in search.' },
  ];

  // Top 3 unachieved next steps
  const nextSteps = breakdown
    .filter(b => !b.achieved && b.actionHint)
    .sort((a, b) => b.maxPoints - a.maxPoints)
    .slice(0, 3)
    .map(b => ({ signal: b.signal, label: b.label, hint: b.actionHint, potentialGain: b.maxPoints - b.points }));

  try {
    await User.updateOne({ _id: userId }, { $set: { credibilityScore: computed } });
  } catch (e) {
    logger.warn('[credibility] persist failed', { error: e.message });
  }

  return { score: computed, level, levelColor, breakdown, nextSteps };
}

module.exports = {
  score,
  computeAndPersist,
};
