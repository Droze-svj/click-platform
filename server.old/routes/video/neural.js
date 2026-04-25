const express = require('express');
const router = express.Router();
const liveTrendService = require('../../services/liveTrendService');
const successIntelligenceService = require('../../services/successIntelligenceService');
const neuralQualityService = require('../../services/neuralQualityService');
const aiVoiceService = require('../../services/aiVoiceService');
const generativeAssetService = require('../../services/generativeAssetService');
const logger = require('../../utils/logger');
const auth = require('../../middleware/auth');

/**
 * GET /api/video/neural/trends
 * Fetch live trends for strategic ideation
 */
router.get('/trends', auth, async (req, res) => {
  try {
    const platform = req.query.platform || 'tiktok';
    const trends = await liveTrendService.getLatestTrends(platform);
    const strategy = await liveTrendService.getTrendStrategy(trends);

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

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Neural b-roll route error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
