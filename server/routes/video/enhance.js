// Advanced video enhancement routes

const express = require('express');
const Content = require('../../models/Content');
const auth = require('../../middleware/auth');
const {
  enhanceVideoQuality,
  addSubtitles,
  createMontage,
  generatePreview,
  extractBestMoments
} = require('../../utils/videoEnhancer');
const logger = require('../../utils/logger');
const router = express.Router();

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
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content || !content.originalFile?.url) {
      return res.status(404).json({
        success: false,
        error: 'Content or video file not found'
      });
    }

    const videoPath = path.join(__dirname, '../../../', content.originalFile.url);
    const outputPath = videoPath.replace('.mp4', '-enhanced.mp4');

    await enhanceVideoQuality(videoPath, outputPath, req.body.options || {});

    res.json({
      success: true,
      message: 'Video enhanced successfully',
      data: {
        enhancedUrl: outputPath.replace(path.join(__dirname, '../../../'), '')
      }
    });
  } catch (error) {
    logger.error('Video enhancement error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content || !content.originalFile?.url) {
      return res.status(404).json({
        success: false,
        error: 'Content or video file not found'
      });
    }

    const videoPath = path.join(__dirname, '../../../', content.originalFile.url);
    const outputPath = videoPath.replace('.mp4', '-preview.mp4');
    const speed = req.body.speed || 2;

    await generatePreview(videoPath, outputPath, speed);

    res.json({
      success: true,
      message: 'Preview generated successfully',
      data: {
        previewUrl: outputPath.replace(path.join(__dirname, '../../../'), '')
      }
    });
  } catch (error) {
    logger.error('Preview generation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;







