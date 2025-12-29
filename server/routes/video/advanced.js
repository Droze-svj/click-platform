// Advanced video processing routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  compressVideo,
  generateThumbnail,
  getVideoMetadata,
  convertVideoFormat,
  trimVideo,
  mergeVideos,
  extractAudio,
  batchProcessVideos,
} = require('../../services/advancedVideoProcessingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB

/**
 * @swagger
 * /api/video/advanced/compress:
 *   post:
 *     summary: Compress video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/compress', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const { quality, format, resolution, bitrate } = req.body;
    const outputPath = path.join(
      path.dirname(req.file.path),
      `compressed-${Date.now()}.${format || 'mp4'}`
    );

    const result = await compressVideo(req.file.path, outputPath, {
      quality,
      format,
      resolution,
      bitrate,
    });

    sendSuccess(res, 'Video compressed successfully', 200, {
      originalPath: req.file.path,
      compressedPath: result,
      size: fs.statSync(result).size,
    });
  } catch (error) {
    logger.error('Compress video error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/advanced/thumbnail:
 *   post:
 *     summary: Generate video thumbnail
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/thumbnail', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const { time, width, height, quality } = req.body;
    const outputPath = path.join(
      path.dirname(req.file.path),
      `thumbnail-${Date.now()}.jpg`
    );

    const result = await generateThumbnail(req.file.path, outputPath, {
      time,
      width: parseInt(width) || 1280,
      height: parseInt(height) || 720,
      quality: parseInt(quality) || 90,
    });

    sendSuccess(res, 'Thumbnail generated successfully', 200, {
      thumbnailPath: result,
    });
  } catch (error) {
    logger.error('Generate thumbnail error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/advanced/metadata:
 *   post:
 *     summary: Get video metadata
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/metadata', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const metadata = await getVideoMetadata(req.file.path);
    sendSuccess(res, 'Video metadata fetched', 200, metadata);
  } catch (error) {
    logger.error('Get metadata error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/advanced/convert:
 *   post:
 *     summary: Convert video format
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/convert', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const { format } = req.body;
    if (!format) {
      return sendError(res, 'Target format is required', 400);
    }

    const outputPath = path.join(
      path.dirname(req.file.path),
      `converted-${Date.now()}.${format}`
    );

    const result = await convertVideoFormat(req.file.path, outputPath, format);

    sendSuccess(res, 'Video converted successfully', 200, {
      convertedPath: result,
      format,
    });
  } catch (error) {
    logger.error('Convert video error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/advanced/trim:
 *   post:
 *     summary: Trim video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/trim', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const { startTime, duration } = req.body;
    if (!startTime || !duration) {
      return sendError(res, 'Start time and duration are required', 400);
    }

    const outputPath = path.join(
      path.dirname(req.file.path),
      `trimmed-${Date.now()}.mp4`
    );

    const result = await trimVideo(req.file.path, outputPath, startTime, duration);

    sendSuccess(res, 'Video trimmed successfully', 200, {
      trimmedPath: result,
    });
  } catch (error) {
    logger.error('Trim video error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/video/advanced/extract-audio:
 *   post:
 *     summary: Extract audio from video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/extract-audio', auth, upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return sendError(res, 'Video file is required', 400);
  }

  try {
    const { format } = req.body;
    const outputPath = path.join(
      path.dirname(req.file.path),
      `audio-${Date.now()}.${format || 'mp3'}`
    );

    const result = await extractAudio(req.file.path, outputPath, format || 'mp3');

    sendSuccess(res, 'Audio extracted successfully', 200, {
      audioPath: result,
    });
  } catch (error) {
    logger.error('Extract audio error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






