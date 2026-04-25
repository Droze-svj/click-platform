const express = require('express');
const router = express.Router();
const socialMediaService = require('../../services/socialMediaService');
const socialAiService = require('../../services/socialAiService');
const shadowSchedulerService = require('../../services/shadowSchedulerService');
const logger = require('../../utils/logger');

/**
 * POST /api/social/generate-metadata
 * Generate platform-specific metadata based on transcript
 */
router.post('/generate-metadata', async (req, res) => {
  try {
    const { transcript, niche, tone } = req.body;
    if (!transcript) return res.status(400).json({ error: 'Transcript missing for neural synthesis' });

    const metadata = await socialAiService.generateUniversalMetadata(transcript, niche, tone);
    res.json({ success: true, metadata });
  } catch (error) {
    logger.error('Social Metadata Generation Failure', { error: error.message });
    res.status(500).json({ error: 'Internal Neural Synthesis Error' });
  }
});

/**
 * POST /api/social/publish
 * Unified publishing endpoint
 */
router.post('/publish', async (req, res) => {
  try {
    const { platforms, contentData, recursiveReach = false } = req.body;
    const userId = req.user?.id || 'dev-user';

    logger.info('Unified Publishing Initiated', { userId, platforms, recursiveReach });

    const results = [];
    for (const platform of platforms) {
      try {
        const result = await socialMediaService.postToSocial(userId, platform, contentData);
        results.push({ platform, ...result });
      } catch (err) {
        results.push({ platform, success: false, error: err.message });
      }
    }

    // Handle Recursive Reach
    if (recursiveReach) {
      await shadowSchedulerService.scheduleRecursiveReach(userId, contentData, platforms);
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error('Unified Publishing Critical Failure', { error: error.message });
    res.status(500).json({ error: 'Internal Social Integration Error' });
  }
});

module.exports = router;
