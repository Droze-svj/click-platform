// A/B Testing Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  createABTest,
  getABTestResults,
  listABTests,
} = require('../../services/abTestingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/productive/ab-testing:
 *   post:
 *     summary: Create A/B test
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, variantA, variantB, platform, targetMetric, duration } = req.body;

  if (!name || !variantA || !variantB || !platform) {
    return sendError(res, 'Name, variantA, variantB, and platform are required', 400);
  }

  try {
    const test = await createABTest(req.user._id, {
      name,
      variantA,
      variantB,
      platform,
      targetMetric: targetMetric || 'engagement',
      duration: duration || 7,
    });
    sendSuccess(res, 'A/B test created', 200, test);
  } catch (error) {
    logger.error('Create A/B test error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/ab-testing/:testId:
 *   get:
 *     summary: Get A/B test results
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:testId', auth, asyncHandler(async (req, res) => {
  const { testId } = req.params;

  try {
    const results = await getABTestResults(testId, req.user._id);
    sendSuccess(res, 'A/B test results fetched', 200, results);
  } catch (error) {
    logger.error('Get A/B test results error', { error: error.message, testId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/ab-testing:
 *   get:
 *     summary: List A/B tests
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const { status, platform } = req.query;

  try {
    const tests = await listABTests(req.user._id, {
      status: status || null,
      platform: platform || null,
    });
    sendSuccess(res, 'A/B tests fetched', 200, tests);
  } catch (error) {
    logger.error('List A/B tests error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

// Import advanced A/B testing routes
const {
  createMultiVariantTest,
  getAdvancedAnalytics,
} = require('../../services/advancedABTestingService');

/**
 * @swagger
 * /api/productive/ab-testing/multi-variant:
 *   post:
 *     summary: Create multi-variant test
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.post('/multi-variant', auth, asyncHandler(async (req, res) => {
  const { name, variants, platform, targetMetric, duration } = req.body;

  if (!name || !variants || !Array.isArray(variants) || variants.length < 2 || !platform) {
    return sendError(res, 'Name, variants array (min 2), and platform are required', 400);
  }

  try {
    const test = await createMultiVariantTest(req.user._id, {
      name,
      variants,
      platform,
      targetMetric: targetMetric || 'engagement',
      duration: duration || 7,
    });
    sendSuccess(res, 'Multi-variant test created', 200, test);
  } catch (error) {
    logger.error('Create multi-variant test error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/productive/ab-testing/:testId/advanced:
 *   get:
 *     summary: Get advanced analytics
 *     tags: [Productive]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:testId/advanced', auth, asyncHandler(async (req, res) => {
  const { testId } = req.params;

  try {
    const analytics = await getAdvancedAnalytics(testId, req.user._id);
    sendSuccess(res, 'Advanced analytics fetched', 200, analytics);
  } catch (error) {
    logger.error('Get advanced analytics error', { error: error.message, testId });
    sendError(res, error.message, 500);
  }
}));

// ── Hook/CTA A/B auto-generation (curiosity / authority / FOMO) ──
const {
  generateHookExperiment,
  evaluateHookExperiment,
} = require('../../services/hookExperimentService');

// POST /api/productive/ab-testing/hook-experiment
// Body: { text, spacingHours?, windows? } → 3 angle variants ready to schedule.
router.post('/hook-experiment', auth, asyncHandler(async (req, res) => {
  const { text, spacingHours, windows } = req.body || {};
  if (!text || !String(text).trim()) return sendError(res, 'text is required', 400);
  const result = await generateHookExperiment(String(text), {
    userId: req.user._id, spacingHours, windows,
  });
  sendSuccess(res, 'Hook experiment generated', 200, result);
}));

// POST /api/productive/ab-testing/hook-experiment/evaluate
// Body: { variantResults: [{ id|angle, impressions, engagement }] } → winner.
router.post('/hook-experiment/evaluate', auth, asyncHandler(async (req, res) => {
  const { variantResults, minImpressions, minLiftPct } = req.body || {};
  const result = evaluateHookExperiment(variantResults, { minImpressions, minLiftPct });
  sendSuccess(res, 'Hook experiment evaluated', 200, result);
}));

module.exports = router;

