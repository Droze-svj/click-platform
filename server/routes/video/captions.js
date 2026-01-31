// Video Caption Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const videoCaptionService = require('../../services/videoCaptionService');
const Content = require('../../models/Content');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for video uploads
const upload = multer({
  dest: 'uploads/videos/',
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

/**
 * POST /api/video/captions/generate
 * Generate captions for a video content
 */
router.post('/generate', authenticate, upload.single('video'), async (req, res) => {
  try {
    const { contentId, language } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    // Get video file path
    let videoFilePath;
    if (req.file) {
      videoFilePath = req.file.path;
    } else if (content.originalFile?.url) {
      // Use existing video file
      videoFilePath = content.originalFile.url;
    } else {
      return sendError(res, 'Video file is required', 400);
    }

    // Generate captions
    const result = await videoCaptionService.generateCaptionsForContent(
      contentId,
      videoFilePath,
      { language }
    );

    // Clean up uploaded file if it was just uploaded
    if (req.file) {
      await fs.unlink(videoFilePath).catch(() => {});
    }

    return sendSuccess(res, result, 'Captions generated successfully');
  } catch (error) {
    logger.error('Error generating captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/video/captions/:contentId
 * Get captions for content
 */
router.get('/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { format = 'srt' } = req.query;
    const userId = req.user.id;

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    // Get captions
    const captions = await videoCaptionService.getCaptions(contentId, format);

    return sendSuccess(res, captions);
  } catch (error) {
    logger.error('Error getting captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/captions/:contentId/translate
 * Translate captions to another language
 */
router.post('/:contentId/translate', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const { targetLanguage } = req.body;
    const userId = req.user.id;

    if (!targetLanguage) {
      return sendError(res, 'Target language is required', 400);
    }

    // Verify content belongs to user
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    if (!content.captions || !content.captions.text) {
      return sendError(res, 'Captions not found. Generate captions first.', 400);
    }

    // Translate captions
    const translatedText = await videoCaptionService.translateCaptions(
      content.captions.text,
      targetLanguage
    );

    // Update content with translated captions
    content.captions.translations = content.captions.translations || {};
    content.captions.translations[targetLanguage] = translatedText;
    await content.save();

    return sendSuccess(res, {
      originalLanguage: content.captions.language,
      targetLanguage,
      translatedText,
    }, 'Captions translated successfully');
  } catch (error) {
    logger.error('Error translating captions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

const logger = require('../../utils/logger');

module.exports = router;
