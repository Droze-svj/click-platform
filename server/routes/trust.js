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

    res.json({
      success: true,
      data: {
        contentId,
        signed: true,
        manifestHash: block.manifestHash || block.hash || null,
        signer: block.signer || block.issuer || 'click-platform',
        signedAt: block.signedAt || doc.updatedAt || null,
        actions: Array.isArray(block.actions) ? block.actions.slice(0, 8) : [],
        trainingMining: block.trainingMining || 'not-allowed',
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
    let User = null, Content = null;
    try { User = require('../models/User'); } catch (_) { /* optional */ }
    try { Content = require('../models/Content'); } catch (_) { /* optional */ }

    const [creators, posts] = await Promise.all([
      User ? User.estimatedDocumentCount() : Promise.resolve(0),
      Content ? Content.estimatedDocumentCount() : Promise.resolve(0),
    ]);

    const MIN_TO_SHOW = 25;
    if ((creators || 0) < MIN_TO_SHOW) {
      return res.json({ success: true, data: { available: false } });
    }

    res.json({
      success: true,
      data: {
        available: true,
        creators,
        publishedPosts: posts || 0,
        verifiedC2PA: true,
        soc2: 'in-progress',
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
