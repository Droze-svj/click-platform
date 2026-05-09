const express = require('express');
const router = express.Router();
const openShortsService = require('../../services/openShortsService');
const { authenticate } = require('../../middleware/auth');
const logger = require('../../utils/logger');

/**
 * POST /api/video/openshorts/generate
 * The Sovereign AI Video Pipeline (OpenShorts V6)
 */
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { topic, niche, baseVideoUrl } = req.body;
    const userId = req.user.id;

    logger.info('Sovereign Pipeline Triggered', { userId, topic, niche });

    // 1. Synthesize Manifest via OpenShorts (Gemini-2.0-Flash)
    const manifest = await openShortsService.generateShortContent(userId, topic, niche);
    
    // 2. Process Kinetic Rendering
    const content = await openShortsService.processSovereignShort(userId, manifest, baseVideoUrl);

    res.status(200).json({
      success: true,
      message: 'Sovereign content synthesized and rendered successfully.',
      data: {
        contentId: content._id,
        url: content.originalFile.url,
        manifest: manifest
      }
    });
  } catch (error) {
    logger.error('OpenShorts Pipeline Error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Autonomous synthesis failed. Please try again.',
      details: error.message
    });
  }
});

module.exports = router;
