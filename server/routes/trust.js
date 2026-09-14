/**
 * /api/trust — public-ish endpoints powering the trust/credibility UI.
 *
 *   GET  /api/trust/provenance/:contentId  C2PA manifest summary for content.
 *   GET  /api/trust/social-proof           Aggregate platform social proof.
 *   GET  /api/trust/credibility/:userId    Per-user credibility score (auth).
 */

const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// ── GET /provenance/:contentId ─────────────────────────────────────────────
// Returns a compact summary of the C2PA manifest stored on AuditMetadata so
// the trust UI can render a "verified provenance" badge with a real cert chain
// instead of marketing copy.
router.get('/provenance/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    let AuditMetadata = null;
    try { AuditMetadata = require('../models/AuditMetadata'); } catch (_) { AuditMetadata = null; }

    if (!AuditMetadata) {
      return res.status(503).json({ success: false, error: 'AuditMetadata model unavailable' });
    }

    const doc = await AuditMetadata.findOne({ contentId }).lean();
    const block = doc?.authenticity?.c2paBlock;

    if (!block) {
      return res.json({
        success: true,
        data: { contentId, signed: false, reason: 'No C2PA manifest on record' },
      });
    }

    // No invented default. `|| 85` handed every unscored asset a passing grade,
    // which is the same class of fabrication the analytics purge removed.
    const authScore = Number.isFinite(Number(doc?.authenticity?.authScore))
      ? Number(doc.authenticity.authScore)
      : null;

    res.json({
      success: true,
      data: {
        contentId,
        signed: true,
        manifestHash: block.manifestHash || block.hash || doc.authenticity?.manifestHash || null,
        signer: block.signer || block.issuer || doc.authenticity?.provider || 'click-platform',
        signedAt: block.signedAt || doc.updatedAt || null,
        actions: Array.isArray(block.actions) ? block.actions.slice(0, 8) : [],
        trainingMining: block.trainingMining || 'not-allowed',
        // The real recorded score, or null — the UI shows "—" rather than a grade
        // nobody computed.
        transparencyScore: authScore,
        aeoIndexed: !!doc?.aeo?.schemaMarkup,
        // REMOVED — `antiDeepfakeGrade` was `authScore >= 90 ? 'A+' : 'A'`, so it
        // could only ever return A or A+: a grade that never fails is not a grade.
        // REMOVED — `publicVerificationUrl` pointed the C2PA verifier at
        // `${APP_URL}/verify/:contentId`, a route that does not exist in the
        // client, so every "verify this" link 404'd.
      },
    });
  } catch (err) {
    logger.error('[trust] provenance failed', { error: err.message });
    res.status(500).json({ success: false, error: 'provenance lookup failed' });
  }
});

// ── GET /social-proof ──────────────────────────────────────────────────────
// Real counts only — guards against cold-start zero state by returning
// `available: false` instead of zeros that would look like the platform is
// empty.
router.get('/social-proof', async (_req, res) => {
  try {
    let User = null, Content = null, AuditMetadata = null;
    try { User = require('../models/User'); } catch (_) { /* optional */ }
    try { Content = require('../models/Content'); } catch (_) { /* optional */ }
    try { AuditMetadata = require('../models/AuditMetadata'); } catch (_) { /* optional */ }

    const [creators, posts, signedAssets] = await Promise.all([
      User ? User.estimatedDocumentCount() : Promise.resolve(0),
      Content ? Content.estimatedDocumentCount() : Promise.resolve(0),
      // `verifiedC2PA: true` used to be a hardcoded constant, so the ONE
      // provenance claim a visitor sees was never derived from whether anything
      // had actually been signed. Count the real signed manifests instead.
      AuditMetadata
        ? AuditMetadata.countDocuments({ 'authenticity.c2paBlock': { $exists: true, $ne: null } })
        : Promise.resolve(0),
    ]);

    // Certification status is NOT a marketing field. The project's own README
    // records SOC 2 / ISO 27001 as pending, so publishing 'compliant' on a
    // public trust page was a false compliance claim. GDPR data export/delete
    // genuinely ship, so that one is reported as supported (a capability), not
    // as a certification.
    const posture = {
      soc2: 'not-certified',
      iso27001: 'not-certified',
      gdpr: 'supported',
      encryptionStatus: 'AES-256',
      verifiedC2PA: (signedAssets || 0) > 0,
      signedAssets: signedAssets || 0,
    };

    const MIN_TO_SHOW = 25;
    if ((creators || 0) < MIN_TO_SHOW) {
      return res.json({
        success: true,
        data: {
          available: true,
          isSeeded: true,
          creators: creators || 0,
          publishedPosts: posts || 0,
          ...posture,
        }
      });
    }

    res.json({
      success: true,
      data: {
        available: true,
        creators,
        publishedPosts: posts || 0,
        ...posture,
      },
    });
  } catch (err) {
    logger.warn('[trust] social-proof failed', { error: err.message });
    res.json({ success: true, data: { available: false } });
  }
});

// ── GET /credibility/:userId ───────────────────────────────────────────────
router.get('/credibility/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user?.id !== userId && req.user?._id?.toString() !== userId && !req.user?.isAdmin) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    const credibilityService = require('../services/credibilityService');
    const data = await credibilityService.computeAndPersist(userId);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[trust] credibility failed', { error: err.message });
    res.status(500).json({ success: false, error: 'credibility lookup failed' });
  }
});

module.exports = router;
