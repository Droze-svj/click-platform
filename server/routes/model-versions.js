// Model Version Management API Routes
// Endpoints for managing AI model versions and upgrades

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');

const {
  checkForModelUpgrades,
  getVersionHistory,
  compareVersions,
  getUpgradeRecommendations,
  autoUpgradeModel,
  getCurrentVersion,
  getVersionAnalytics,
  abTestVersions,
  validateVersionBeforeUpgrade,
  rollbackVersion,
  checkRollbackNeeded,
  getRollbackCandidates,
  startGradualRollout,
  getRolloutStatus,
  pauseRollout,
  cancelRollout,
} = require('../services/modelVersionManager');

/**
 * GET /api/model-versions/:provider/:model/current
 * Get current version of a model
 */
router.get('/:provider/:model/current', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;

  const version = await getCurrentVersion(provider, model);

  if (!version) {
    return sendError(res, 'Version not found', 404);
  }

  return sendSuccess(res, { version });
}));

/**
 * GET /api/model-versions/:provider/:model/history
 * Get version history for a model
 */
router.get('/:provider/:model/history', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;

  const history = await getVersionHistory(provider, model);

  return sendSuccess(res, { provider, model, history });
}));

/**
 * GET /api/model-versions/:provider/:model/upgrades
 * Check for available upgrades
 */
router.get('/:provider/:model/upgrades', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;

  const upgrades = await checkForModelUpgrades(provider, model);

  if (!upgrades) {
    return sendError(res, 'Could not check for upgrades', 500);
  }

  return sendSuccess(res, { upgrades });
}));

/**
 * GET /api/model-versions/upgrade-recommendations
 * Get upgrade recommendations based on learning
 */
router.get('/upgrade-recommendations', auth, asyncHandler(async (req, res) => {
  const { provider } = req.query;

  const recommendations = await getUpgradeRecommendations(provider || null);

  return sendSuccess(res, { recommendations });
}));

/**
 * POST /api/model-versions/:provider/:model/upgrade
 * Record a model upgrade
 */
router.post('/:provider/:model/upgrade', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const {
    oldVersion,
    newVersion,
    improvements = [],
    breakingChanges = [],
    migrationNotes = '',
  } = req.body;

  if (!oldVersion || !newVersion) {
    return sendError(res, 'oldVersion and newVersion are required', 400);
  }

  const upgrade = await recordModelUpgrade(provider, model, {
    oldVersion,
    newVersion,
    improvements,
    breakingChanges,
    migrationNotes,
  });

  return sendSuccess(res, { upgrade }, 'Model upgraded successfully');
}));

/**
 * POST /api/model-versions/:provider/:model/auto-upgrade
 * Auto-upgrade model if recommended
 */
router.post('/:provider/:model/auto-upgrade', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const {
    autoUpgrade = true,
    minQualityImprovement = 0.1,
  } = req.body;

  const result = await autoUpgradeModel(provider, model, {
    autoUpgrade,
    minQualityImprovement,
  });

  return sendSuccess(res, { result });
}));

/**
 * GET /api/model-versions/:provider/:model/compare
 * Compare two versions
 */
router.get('/:provider/:model/compare', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'version1 and version2 query parameters are required', 400);
  }

  const comparison = await compareVersions(provider, model, version1, version2);

  if (!comparison) {
    return sendError(res, 'Could not compare versions', 404);
  }

  return sendSuccess(res, { comparison });
}));

/**
 * GET /api/model-versions/:provider/:model/analytics
 * Get version analytics and insights
 */
router.get('/:provider/:model/analytics', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { days = 30 } = req.query;

  const analytics = await getVersionAnalytics(provider, model, parseInt(days));

  if (!analytics) {
    return sendError(res, 'Could not get analytics', 500);
  }

  return sendSuccess(res, { analytics });
}));

/**
 * POST /api/model-versions/:provider/:model/ab-test
 * A/B test two versions
 */
router.post('/:provider/:model/ab-test', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { version1, version2, testPrompts = [] } = req.body;

  if (!version1 || !version2) {
    return sendError(res, 'version1 and version2 are required', 400);
  }

  const results = await abTestVersions(provider, model, version1, version2, testPrompts);

  return sendSuccess(res, { results });
}));

/**
 * POST /api/model-versions/:provider/:model/validate-upgrade
 * Validate version before upgrading
 */
router.post('/:provider/:model/validate-upgrade', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { newVersion, testPrompts = [], minQualityImprovement = 0.1 } = req.body;

  if (!newVersion) {
    return sendError(res, 'newVersion is required', 400);
  }

  const validation = await validateVersionBeforeUpgrade(provider, model, newVersion, {
    testPrompts,
    minQualityImprovement,
  });

  return sendSuccess(res, { validation });
}));

/**
 * POST /api/model-versions/:provider/:model/rollback
 * Rollback to previous version
 */
router.post('/:provider/:model/rollback', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { targetVersion, reason = '' } = req.body;

  if (!targetVersion) {
    return sendError(res, 'targetVersion is required', 400);
  }

  const result = await rollbackVersion(provider, model, targetVersion, reason);

  return sendSuccess(res, { result }, 'Version rolled back successfully');
}));

/**
 * GET /api/model-versions/:provider/:model/rollback-check
 * Check if rollback is needed
 */
router.get('/:provider/:model/rollback-check', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { minQualityThreshold, minUsageCount, daysSinceUpgrade } = req.query;

  const check = await checkRollbackNeeded(provider, model, {
    minQualityThreshold: minQualityThreshold ? parseFloat(minQualityThreshold) : 0.6,
    minUsageCount: minUsageCount ? parseInt(minUsageCount) : 20,
    daysSinceUpgrade: daysSinceUpgrade ? parseInt(daysSinceUpgrade) : 7,
  });

  return sendSuccess(res, { check });
}));

/**
 * GET /api/model-versions/:provider/:model/rollback-candidates
 * Get rollback candidate versions
 */
router.get('/:provider/:model/rollback-candidates', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;

  const candidates = await getRollbackCandidates(provider, model);

  return sendSuccess(res, { candidates });
}));

/**
 * POST /api/model-versions/:provider/:model/gradual-rollout
 * Start gradual rollout of new version
 */
router.post('/:provider/:model/gradual-rollout', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const {
    newVersion,
    initialPercentage = 10,
    incrementPercentage = 10,
    maxPercentage = 100,
    minDaysBetweenIncrements = 1,
    successThreshold = 0.7,
  } = req.body;

  if (!newVersion) {
    return sendError(res, 'newVersion is required', 400);
  }

  const rollout = await startGradualRollout(provider, model, newVersion, {
    initialPercentage,
    incrementPercentage,
    maxPercentage,
    minDaysBetweenIncrements,
    successThreshold,
  });

  return sendSuccess(res, { rollout }, 'Gradual rollout started');
}));

/**
 * GET /api/model-versions/:provider/:model/rollout-status
 * Get rollout status
 */
router.get('/:provider/:model/rollout-status', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { newVersion } = req.query;

  if (!newVersion) {
    return sendError(res, 'newVersion query parameter is required', 400);
  }

  const status = getRolloutStatus(provider, model, newVersion);

  if (!status) {
    return sendError(res, 'Rollout not found', 404);
  }

  return sendSuccess(res, { rollout: status });
}));

/**
 * POST /api/model-versions/:provider/:model/pause-rollout
 * Pause gradual rollout
 */
router.post('/:provider/:model/pause-rollout', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { newVersion, reason = '' } = req.body;

  if (!newVersion) {
    return sendError(res, 'newVersion is required', 400);
  }

  const rollout = pauseRollout(provider, model, newVersion, reason);

  if (!rollout) {
    return sendError(res, 'Rollout not found', 404);
  }

  return sendSuccess(res, { rollout }, 'Rollout paused');
}));

/**
 * POST /api/model-versions/:provider/:model/cancel-rollout
 * Cancel gradual rollout
 */
router.post('/:provider/:model/cancel-rollout', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.params;
  const { newVersion, reason = '' } = req.body;

  if (!newVersion) {
    return sendError(res, 'newVersion is required', 400);
  }

  const rollout = await cancelRollout(provider, model, newVersion, reason);

  if (!rollout) {
    return sendError(res, 'Rollout not found', 404);
  }

  return sendSuccess(res, { rollout }, 'Rollout cancelled');
}));

module.exports = router;

