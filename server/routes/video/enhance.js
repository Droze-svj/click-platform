// Advanced video enhancement routes
//
// NOTE: these two endpoints were wired to enhanceVideoQuality / generatePreview
// imports that the videoEnhancer module never exported (it only provides
// getEnhancementFilters / getHighFidelityOptions), so every call threw
// "X is not a function" → 500. Until a real enhance/preview render is built on
// top of the main render pipeline, they return an honest 501 instead of
// crashing. The ownership lookup is kept so an unauthorized/unknown content id
// still gets the correct 404, not a misleading 501.

const express = require('express');
const Content = require('../../models/Content');
const auth = require('../../middleware/auth');
const logger = require('../../utils/logger');
const router = express.Router();

async function findOwnedContent(req, res) {
  const content = await Content.findOne({
    _id: req.params.contentId,
    userId: req.user._id,
  });
  if (!content || !content.originalFile?.url) {
    res.status(404).json({ success: false, error: 'Content or video file not found' });
    return null;
  }
  return content;
}

/**
 * @swagger
 * /api/video/enhance/{contentId}:
 *   post:
 *     summary: Enhance video quality
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/enhance/:contentId', auth, async (req, res) => {
  try {
    const content = await findOwnedContent(req, res);
    if (!content) return;
    return res.status(501).json({
      success: false,
      error: 'Video quality enhancement is not available yet.',
    });
  } catch (error) {
    logger.error('Video enhancement error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/video/preview/{contentId}:
 *   post:
 *     summary: Generate video preview
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/preview/:contentId', auth, async (req, res) => {
  try {
    const content = await findOwnedContent(req, res);
    if (!content) return;
    return res.status(501).json({
      success: false,
      error: 'Video preview generation is not available yet.',
    });
  } catch (error) {
    logger.error('Preview generation error', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
