const express = require('express');
const router = express.Router();

// AI cost/fan-out guard: neural routes call paid LLMs (incl. Claude web search)
// — rate-limit per user + attach the per-tier budget guard.
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const { costGuard } = require('../../middleware/costGuard');
router.use((req, res, next) => (['POST', 'PUT'].includes(req.method) ? aiLimiter(req, res, next) : next()));
router.use(costGuard());

const liveTrendService = require('../../services/liveTrendService');
const successIntelligenceService = require('../../services/successIntelligenceService');
const neuralQualityService = require('../../services/neuralQualityService');
const aiVoiceService = require('../../services/aiVoiceService');
const generativeAssetService = require('../../services/generativeAssetService');
const logger = require('../../utils/logger');
const auth = require('../../middleware/auth');
const { resolveTier } = require('../../config/entitlements');
const { guardOwnership } = require('../../utils/ownership');

/**
 * GET /api/video/neural/trends
 * Fetch live trends for strategic ideation
 */
router.get('/trends', auth, async (req, res) => {
  try {
    const platform = req.query.platform || 'tiktok';
    const tier = resolveTier(req.user);
    const trends = await liveTrendService.getLatestTrends(platform, { tier });
    const strategy = await liveTrendService.getTrendStrategy(trends, { tier });

    res.json({
      success: true,
      trends,
      strategy
    });
  } catch (error) {
    logger.error('Neural trends route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video/neural/predict-success
 * Predict viral potential of a script/concept
 */
router.post('/predict-success', auth, async (req, res) => {
  try {
    const { topic, hook, pacing } = req.body;
    const prediction = await successIntelligenceService.predictViralSuccess(
      { topic, hook, pacing },
      req.user.id
    );

    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    logger.error('Neural prediction route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video/neural/audit
 * Run Neural Quality Audit on a project
 */
router.post('/audit', auth, async (req, res) => {
  try {
    const { projectData } = req.body;
    if (!projectData) {
      return res.status(400).json({ success: false, error: 'projectData is required' });
    }
    const audit = await neuralQualityService.auditProject(projectData);

    res.json({
      success: true,
      audit
    });
  } catch (error) {
    logger.error('Neural audit route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video/neural/dub
 * Trigger generative voice cloning dubbing
 */
router.post('/dub', auth, async (req, res) => {
  try {
    const { contentId, targetLanguage } = req.body;
    // IDOR: the dub service does a bare Content.findById(contentId) → gate ownership.
    const owned = await guardOwnership(req, res, contentId);
    if (!owned) return;
    const dubbing = await aiVoiceService.generateDubbedContent(contentId, targetLanguage);

    res.json({
      success: true,
      dubbing
    });
  } catch (error) {
    logger.error('Neural dub route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video/neural/auto-foley
 * Suggest sound effects for a timeline
 */
router.post('/auto-foley', auth, async (req, res) => {
  try {
    const { timeline } = req.body;
    const suggestions = await generativeAssetService.autoSoundDesign(timeline);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('Neural foley route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video/neural/magic-b-roll
 * Generate AI B-roll based on prompt
 */
router.post('/magic-b-roll', auth, async (req, res) => {
  try {
    const { prompt, duration = 3 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const result = await generativeAssetService.magicBRollFill(prompt, duration);

    // Async providers may return a job still rendering — surface that honestly
    // (202) with the jobId so the client can poll, rather than a 503.
    if (result && result.status === 'processing') {
      return res.status(202).json({
        success: true,
        status: 'processing',
        jobId: result.jobId || null,
        data: result,
      });
    }

    // Honest surfacing: when text-to-video isn't configured the service returns
    // status 'unavailable' (no fabricated clip). Report that truthfully (503)
    // instead of dressing a non-result up as a successful generation. A real
    // success is status 'ready' with a provider-returned url.
    if (!result || result.status !== 'ready' || !result.url) {
      return res.status(503).json({
        success: false,
        status: result?.status || 'unavailable',
        error: result?.error || 'B-roll generation is unavailable.',
        data: result || null,
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Neural b-roll route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /magic-b-roll/status/:jobId — poll an async B-roll job started above.
// Returns the real url only once the provider reports it ready (never a fake).
router.get('/magic-b-roll/status/:jobId', auth, async (req, res) => {
  try {
    const { getBRollStatus } = require('../../services/textToVideoService');
    const result = await getBRollStatus(req.params.jobId);
    if (result.status === 'ready' && result.url) {
      return res.json({ success: true, status: 'ready', data: result });
    }
    if (result.status === 'processing') {
      return res.status(202).json({ success: true, status: 'processing', jobId: result.jobId, data: result });
    }
    return res.status(503).json({ success: false, status: result.status, error: result.error || 'unavailable', data: result });
  } catch (error) {
    logger.error('Neural b-roll status route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
