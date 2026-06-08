/**
 * Entitlements routes — the canonical, client-facing view of Click's
 * subscription tiers, features and limits. Backed entirely by
 * server/config/entitlements.js (single source of truth).
 *
 * Endpoints:
 *   GET /api/plans            (public)  → publicCatalog() for landing/billing
 *   GET /api/me/entitlements  (auth)    → the current user's resolved tier view
 *
 * Foundation only: these are read-only. No enforcement happens here.
 */

const express = require('express');
const auth = require('../middleware/auth');
const entitlements = require('../config/entitlements');
const { publicAiProfile } = require('../config/aiProfiles');

const router = express.Router();

/**
 * GET /api/plans — public catalog. No auth. One canonical source for the
 * landing page, billing page and membership UI. JSON-safe (no Infinity).
 */
router.get('/plans', (req, res) => {
  res.json(entitlements.publicCatalog());
});

/**
 * GET /api/me/entitlements — the authenticated user's resolved entitlements.
 * Returns their tier, the unlocked feature map, JSON-safe limits, current
 * usage, and the early-access feature list.
 */
router.get('/me/entitlements', auth, (req, res) => {
  const user = req.user || {};
  const tier = entitlements.resolveTier(user);

  // Feature map { id: true } for unlocked features (easy client lookups),
  // plus the flat list for convenience.
  const featureList = entitlements.featuresForTier(tier);
  const features = featureList.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {});

  res.json({
    tier,
    features,
    featureList,
    limits: entitlements.serializeLimits(tier),
    usage: user.usage || {},
    earlyAccess: entitlements
      .earlyAccessFeatures()
      .filter((id) => entitlements.hasFeature(tier, id)),
    // Honest, derived view of the AI intelligence level this tier ACTUALLY runs
    // (effort/output/live-web depth) — no invented benchmarks. Powers the real
    // Agency AI-edge indicator on the client.
    aiProfile: publicAiProfile(tier),
  });
});

module.exports = router;
