// Advanced video processing routes

const express = require('express');
const auth = require('../../middleware/auth');

const {
  compressVideo,
  generateThumbnail,
  getVideoMetadata,
  convertVideoFormat,
  trimVideo,
  extractAudio,
} = require('../../services/advancedVideoProcessingService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const progressTracker = require('../../services/videoProgressService');
const router = express.Router();

/**
 * Helper for consistent logging of video editing operations.
 * @param {string} event - The event name
 * @param {object} data - Additional data for the log
 */
const logVideoEditServer = (event, data = {}) => {
  const { userId, videoId, jobId, ...rest } = data;
  logger.info(`[VIDEO_EDIT] ${event}`, {
    userId: userId || 'anonymous',
    videoId: videoId || 'unknown',
    jobId: jobId || 'none',
    ...rest,
    timestamp: new Date().toISOString()
  });
};

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

function getUploadsRoot() {
  return path.join(__dirname, '../../../uploads');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toUploadsUrl(filePath) {
  const uploadsRoot = getUploadsRoot();
  const rel = path.relative(uploadsRoot, filePath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

async function downloadToUploadsTemp(videoUrl) {
  const uploadsRoot = getUploadsRoot();
  const tmpDir = path.join(uploadsRoot, 'tmp');
  ensureDir(tmpDir);

  const url = String(videoUrl || '').trim();
  if (!url) throw new Error('videoUrl is required');
  if (typeof fetch !== 'function') {
    throw new Error('Server fetch() is not available. Please upgrade Node to v18+ or add a fetch polyfill.');
  }

  // Fast-path: local uploads file already on disk
  if (url.startsWith('/uploads/')) {
    const localPath = path.join(uploadsRoot, url.replace('/uploads/', ''));
    if (fs.existsSync(localPath)) {
      return localPath;
    }
  }

  // Allow relative URLs like "/uploads/clips/xxx.mp4"
  const resolved = url.startsWith('http')
    ? url
    : `http://127.0.0.1:${process.env.PORT || 5001}${url.startsWith('/') ? '' : '/'}${url}`;

  const resp = await fetch(resolved);
  if (!resp.ok) {
    throw new Error(`Failed to download video (${resp.status})`);
  }

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('video') && !contentType.includes('application/octet-stream')) {
    // Don’t hard fail, but warn — some servers use octet-stream for mp4
    logger.warn('downloadToUploadsTemp unexpected content-type', { contentType, resolved });
  }

  const ext = path.extname(new URL(resolved).pathname) || '.mp4';
  const tmpPath = path.join(tmpDir, `video-src-${Date.now()}${ext}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(tmpPath, buf);
  return tmpPath;
}

function runInBackground({ videoId, operation, handler }) {
  progressTracker.startTracking(videoId, operation);
  progressTracker.updateProgress(videoId, operation, 1, 'Queued');

  setImmediate(async () => {
    try {
      progressTracker.updateProgress(videoId, operation, 5, 'Starting');
      const result = await handler((pct, msg) => {
        if (typeof pct === 'number') {
          progressTracker.updateProgress(videoId, operation, pct, msg || 'Processing');
        } else {
          progressTracker.updateProgress(videoId, operation, 50, msg || 'Processing');
        }
      });
      progressTracker.complete(videoId, operation, result);
    } catch (err) {
      progressTracker.fail(videoId, operation, err);
    }
  });
}

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
  const { quality, format, resolution, bitrate, videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'compress';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  logVideoEditServer('compress_request_received', {
    userId: req.user._id,
    videoId,
    hasFile: !!req.file,
    hasVideoUrl: !!videoUrl,
    quality,
    format,
    resolution,
    bitrate
  });

  const uploadsRoot = getUploadsRoot();
  const processedDir = path.join(uploadsRoot, 'processed');
  ensureDir(processedDir);

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);

  logVideoEditServer('compress_input_processed', {
    userId: req.user._id,
    videoId,
    hasInputPath: !!inputPath,
    inputPathType: req.file ? 'uploaded' : 'downloaded'
  });

  if (!inputPath) {
    logVideoEditServer('compress_error_no_input', {
      userId: req.user._id,
      videoId
    });
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  const outputPath = path.join(processedDir, `compressed-${videoId}-${Date.now()}.${format || 'mp4'}`);

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      const resultPath = await compressVideo(inputPath, outputPath, {
        quality,
        format,
        resolution,
        bitrate,
        onProgress: (pct) => onProgress(Math.max(5, Math.min(99, pct || 0)), 'Compressing'),
      });

      // Cleanup downloaded temp input (keep uploaded file for now; user might want it)
      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return {
        videoId,
        operation,
        resultUrl: toUploadsUrl(resultPath),
        size: fs.statSync(resultPath).size,
      };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Compression started', 202);
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
  const { time, width, height, quality, videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'thumbnail';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  const uploadsRoot = getUploadsRoot();
  const processedDir = path.join(uploadsRoot, 'processed');
  ensureDir(processedDir);

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);
  if (!inputPath) {
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  const outputPath = path.join(processedDir, `thumbnail-${videoId}-${Date.now()}.jpg`);

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      onProgress(20, 'Extracting frame');
      const resultPath = await generateThumbnail(inputPath, outputPath, {
        time,
        width: parseInt(width) || 1280,
        height: parseInt(height) || 720,
        quality: parseInt(quality) || 90,
      });
      onProgress(95, 'Finalizing');

      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return {
        videoId,
        operation,
        thumbnailUrl: toUploadsUrl(resultPath),
      };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Thumbnail started', 202);
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
  const { videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'metadata';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);
  if (!inputPath) {
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      onProgress(30, 'Reading metadata');
      const metadata = await getVideoMetadata(inputPath);
      onProgress(100, 'Done');

      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return { videoId, operation, metadata };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Metadata started', 202);
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
  const { format, videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'convert';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  if (!format) {
    return sendError(res, 'Target format is required', 400);
  }

  const uploadsRoot = getUploadsRoot();
  const processedDir = path.join(uploadsRoot, 'processed');
  ensureDir(processedDir);

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);
  if (!inputPath) {
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  const outputPath = path.join(processedDir, `converted-${videoId}-${Date.now()}.${format}`);

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      const resultPath = await convertVideoFormat(inputPath, outputPath, format, {
        onProgress: (pct) => onProgress(Math.max(5, Math.min(99, pct || 0)), `Converting to ${format}`),
      });

      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return { videoId, operation, format, resultUrl: toUploadsUrl(resultPath) };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Conversion started', 202);
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
  const { startTime, duration, videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'trim';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  if (!startTime || !duration) {
    return sendError(res, 'Start time and duration are required', 400);
  }

  const uploadsRoot = getUploadsRoot();
  const processedDir = path.join(uploadsRoot, 'processed');
  ensureDir(processedDir);

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);
  if (!inputPath) {
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  const outputPath = path.join(processedDir, `trimmed-${videoId}-${Date.now()}.mp4`);

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      const resultPath = await trimVideo(inputPath, outputPath, startTime, duration, {
        onProgress: (pct) => onProgress(Math.max(5, Math.min(99, pct || 0)), 'Trimming'),
      });

      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return { videoId, operation, startTime, duration, resultUrl: toUploadsUrl(resultPath) };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Trim started', 202);
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
  const { format, videoUrl, videoId: bodyVideoId } = req.body;
  const operation = 'extract-audio';
  const videoId = bodyVideoId || `video-${Date.now()}`;

  const uploadsRoot = getUploadsRoot();
  const processedDir = path.join(uploadsRoot, 'processed');
  ensureDir(processedDir);

  const inputPath = req.file?.path || (videoUrl ? await downloadToUploadsTemp(videoUrl) : null);
  if (!inputPath) {
    return sendError(res, 'Video file or videoUrl is required', 400);
  }

  const outFormat = format || 'mp3';
  const outputPath = path.join(processedDir, `audio-${videoId}-${Date.now()}.${outFormat}`);

  runInBackground({
    videoId,
    operation,
    handler: async (onProgress) => {
      const resultPath = await extractAudio(inputPath, outputPath, outFormat, {
        onProgress: (pct) => onProgress(Math.max(5, Math.min(99, pct || 0)), 'Extracting audio'),
      });

      if (!req.file && inputPath && inputPath.includes(`${path.sep}uploads${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath); } catch (_) { /* ignore deletion error */ }
      }

      return { videoId, operation, format: outFormat, resultUrl: toUploadsUrl(resultPath) };
    },
  });

  sendSuccess(res, { videoId, operation }, 'Audio extraction started', 202);
}));

/**
 * @swagger
 * /api/video/advanced/add-text:
 *   post:
 *     summary: Add text overlays to video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/add-text', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('add_text_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, textOverlays } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'add-text', { videoId })

  // Process asynchronously
  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').addTextOverlays(
        videoUrl || videoPath,
        JSON.parse(textOverlays || '[]'),
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('add_text_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Add text processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('add_text_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Text overlay processing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/apply-filters:
 *   post:
 *     summary: Apply visual filters to video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/apply-filters', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('apply_filters_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, filters } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'apply-filters', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').applyVideoFilters(
        videoUrl || videoPath,
        JSON.parse(filters || '{}'),
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('apply_filters_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Apply filters processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('apply_filters_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Filter processing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/add-audio:
 *   post:
 *     summary: Add audio track to video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/add-audio', auth, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  logVideoEditServer('add_audio_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, audioUrl, audioVolume } = req.body
  const videoPath = req.files?.video?.[0]?.path || null
  const audioPath = req.files?.audio?.[0]?.path || null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'add-audio', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').addAudioToVideo(
        videoUrl || videoPath,
        audioUrl || audioPath,
        { volume: parseInt(audioVolume) || 50, jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('add_audio_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Add audio processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('add_audio_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Audio mixing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/crop:
 *   post:
 *     summary: Crop and resize video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/crop', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('crop_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, cropArea } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'crop', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').cropVideo(
        videoUrl || videoPath,
        JSON.parse(cropArea || '{}'),
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('crop_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Crop processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('crop_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Crop processing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/split-merge:
 *   post:
 *     summary: Split video into segments and merge
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/split-merge', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('split_merge_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, segments } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'split-merge', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').splitAndMergeVideo(
        videoUrl || videoPath,
        JSON.parse(segments || '[]'),
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('split_merge_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Split merge processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('split_merge_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Split and merge processing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/transitions:
 *   post:
 *     summary: Add transitions between video segments
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/transitions', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('transitions_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, transitionType } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'transitions', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').addTransitions(
        videoUrl || videoPath,
        transitionType || 'fade',
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('transitions_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Transitions processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('transitions_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Transition processing started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/voiceover:
 *   post:
 *     summary: Generate AI voiceover for video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/voiceover', auth, asyncHandler(async (req, res) => {
  logVideoEditServer('voiceover_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, text, voice } = req.body

  if (!text || !text.trim()) {
    return sendError(res, 'Voiceover text is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'voiceover', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').generateVoiceover(
        videoUrl,
        text.trim(),
        { voice: voice || 'alloy', jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('voiceover_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Voiceover processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('voiceover_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Voiceover generation started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/stabilize:
 *   post:
 *     summary: Stabilize shaky video footage
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/stabilize', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('stabilize_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'stabilize', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').stabilizeVideo(
        videoUrl || videoPath,
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('stabilize_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Stabilize processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('stabilize_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Video stabilization started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/analyze:
 *   post:
 *     summary: AI-powered video content analysis
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze', auth, asyncHandler(async (req, res) => {
  logVideoEditServer('ai_analyze_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl, analysisTypes } = req.body

  if (!videoUrl) {
    return sendError(res, 'Video URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'ai-analyze', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/aiVideoAnalysisService').analyzeVideoContent(
        videoUrl,
        { analysisTypes: analysisTypes || ['highlights', 'pacing', 'engagement', 'technical', 'content'], jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('ai_analyze_completed', { userId: req.user._id, jobId, analysisTypes: analysisTypes?.length })
    } catch (error) {
      logger.error('AI analysis failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('ai_analyze_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'AI analysis started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/color-correct:
 *   post:
 *     summary: Apply professional color correction
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/color-correct', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('color_correct_start', { userId: req.user._id, videoId: req.body.videoId })

  const { videoId, videoUrl } = req.body
  const videoPath = req.file ? req.file.path : null

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or URL is required', 400)
  }

  const jobId = await progressTracker.createJob(req.user._id, 'color-correct', { videoId })

  setImmediate(async () => {
    try {
      const result = await require('../../services/enhancedVideoProcessingService').colorCorrectVideo(
        videoUrl || videoPath,
        { jobId, userId: req.user._id }
      )

      await progressTracker.updateJob(jobId, 'completed', result)
      logVideoEditServer('color_correct_completed', { userId: req.user._id, jobId, resultUrl: result.resultUrl })
    } catch (error) {
      logger.error('Color correction processing failed', { error: error.message, jobId })
      await progressTracker.updateJob(jobId, 'failed', null, error.message)
      logVideoEditServer('color_correct_failed', { userId: req.user._id, jobId, error: error.message })
    }
  })

  sendSuccess(res, 'Color correction started', 202, { jobId })
}))

/**
 * @swagger
 * /api/video/advanced/remove-silence:
 *   post:
 *     summary: Detect and remove silent segments from video
 *     tags: [Video]
 *     security:
 *       - bearerAuth: []
 */
router.post('/remove-silence', auth, upload.single('video'), asyncHandler(async (req, res) => {
  logVideoEditServer('remove_silence_start', { userId: req.user._id, videoId: req.body.videoId })

  const {
    videoId: bodyVideoId,
    videoUrl,
    silenceThreshold = '-35dB',  // audio level below which is considered silence
    minSilenceDuration = 0.5,    // minimum silence gap in seconds to cut
    padding = 0.1,               // keep N seconds around cuts for natural feel
  } = req.body
  const videoPath = req.file ? req.file.path : null
  const videoId = bodyVideoId || `video-${Date.now()}`

  if (!videoUrl && !videoPath) {
    return sendError(res, 'Video file or videoUrl is required', 400)
  }

  const uploadsRoot = getUploadsRoot()
  const processedDir = path.join(uploadsRoot, 'processed')
  ensureDir(processedDir)

  runInBackground({
    videoId,
    operation: 'remove-silence',
    handler: async (onProgress) => {
      const inputPath = videoPath || await downloadToUploadsTemp(videoUrl)
      onProgress(10, 'Analysing audio waveform')

      // Step 1: Use ffmpeg silencedetect to find silence intervals
      const { execFile } = require('child_process')
      const { promisify } = require('util')
      const execFileAsync = promisify(execFile)

      let silenceLog = ''
      try {
        const { stderr } = await execFileAsync('ffmpeg', [
          '-i', inputPath,
          '-af', `silencedetect=noise=${silenceThreshold}:d=${minSilenceDuration}`,
          '-f', 'null', '-'
        ], { maxBuffer: 10 * 1024 * 1024 })
        silenceLog = stderr
      } catch (e) {
        // ffmpeg writes to stderr; non-zero exit from -f null is expected
        silenceLog = e.stderr || ''
      }

      onProgress(40, 'Calculating cut points')

      // Parse silence intervals
      const silenceStartRe = /silence_start:\s*([\d.]+)/g
      const silenceEndRe = /silence_end:\s*([\d.]+)/g
      const starts = [], ends = []
      let m
      while ((m = silenceStartRe.exec(silenceLog)) !== null) starts.push(parseFloat(m[1]))
      while ((m = silenceEndRe.exec(silenceLog)) !== null) ends.push(parseFloat(m[1]))

      // Build keep intervals (non-silent segments)
      const keepSegments = []
      let cursor = 0
      for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
        const silStart = Math.max(0, starts[i] - padding)
        const silEnd = ends[i] + padding
        if (silStart > cursor) {
          keepSegments.push({ start: cursor, end: silStart })
        }
        cursor = silEnd
      }
      // Always keep whatever remains after the last silence
      keepSegments.push({ start: cursor, end: null })

      if (keepSegments.length <= 1 && keepSegments[0]?.start === 0) {
        // No silence found — return original
        return {
          videoId,
          operation: 'remove-silence',
          resultUrl: videoUrl || toUploadsUrl(inputPath),
          cutPoints: [],
          segmentsKept: 1,
          message: 'No significant silence detected',
        }
      }

      onProgress(60, 'Concatenating non-silent segments')

      // Build ffmpeg concat filter
      const tmpDir = path.join(uploadsRoot, 'tmp')
      ensureDir(tmpDir)
      const filterParts = []
      const trimParts = []
      keepSegments.forEach((seg, idx) => {
        const endStr = seg.end !== null ? `:end=${seg.end}` : ''
        filterParts.push(`[0:v]trim=start=${seg.start}${endStr},setpts=PTS-STARTPTS[v${idx}]`)
        filterParts.push(`[0:a]atrim=start=${seg.start}${endStr},asetpts=PTS-STARTPTS[a${idx}]`)
        trimParts.push(`[v${idx}][a${idx}]`)
      })
      const n = keepSegments.length
      const filterComplex = [
        ...filterParts,
        `${trimParts.join('')}concat=n=${n}:v=1:a=1[outv][outa]`
      ].join(';')

      const outputPath = path.join(processedDir, `no-silence-${videoId}-${Date.now()}.mp4`)
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-filter_complex', filterComplex,
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-y', outputPath
      ], { maxBuffer: 50 * 1024 * 1024 })

      onProgress(95, 'Finalising')

      if (videoPath && inputPath !== videoPath && inputPath.includes(`${path.sep}tmp${path.sep}`)) {
        try { fs.unlinkSync(inputPath) } catch (_) { /* ignore deletion error */ }
      }

      return {
        videoId,
        operation: 'remove-silence',
        resultUrl: toUploadsUrl(outputPath),
        cutPoints: starts.map((s, i) => ({ start: s, end: ends[i] })),
        segmentsKept: keepSegments.length,
        silenceRemoved: starts.length,
      }
    },
  })

  sendSuccess(res, { videoId, operation: 'remove-silence' }, 'Silence removal started', 202)
}))

const { predictContentROI } = require('../../services/aiROIPredictorService');

/**
 * @swagger
 * /api/video/advanced/roi-prediction:
 *   post:
 *     summary: Predict content ROI and Sales Score
 *     tags: [Video]
 */
router.post('/roi-prediction', auth, asyncHandler(async (req, res) => {
  const { videoId, timelineData, audiencePersona } = req.body;
  const result = await predictContentROI(videoId, timelineData, audiencePersona);
  sendSuccess(res, 'ROI prediction complete', 200, result);
}));

/**
 * @route   POST /api/video/advanced/monetization-plan
 * @desc    Generate and persist a monetization plan with Whop/Shopify products
 * @access  Private
 */
const monetizationService = require('../../services/monetizationService');
router.post('/monetization-plan', auth, asyncHandler(async (req, res) => {
  const { transcript, videoId, provider = 'whop' } = req.body;
  if (!transcript) {
    return res.status(400).json({ success: false, message: 'Transcript is required for monetization planning' });
  }

  // Use the refined unified bridge with persistence
  const result = await monetizationService.generateAndPersistPlan(
    req.user._id,
    videoId || null, // videoId maps to contentId
    transcript,
    { provider }
  );

  sendSuccess(res, 'Monetization plan generated and persisted', 200, result);
}));

/**
 * @route   POST /api/video/advanced/source-assets
 * @desc    Extract visual keywords and source autonomous B-roll assets
 * @access  Private
 */
const { sourceAutonomousAssets } = require('../../services/stockSourcingService');
router.post('/source-assets', auth, asyncHandler(async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) {
    return res.status(400).json({ success: false, message: 'Transcript is required for sourcing' });
  }
  const result = await sourceAutonomousAssets(transcript);
  sendSuccess(res, 'Autonomous sourcing complete', 200, result);
}));

/**
 * @route   POST /api/video/advanced/launch-test-ad
 * @desc    Launch a low-budget test ad for high-potential video
 * @access  Private
 */
const { launchTestAd } = require('../../services/adsIntegrationService');
router.post('/launch-test-ad', auth, asyncHandler(async (req, res) => {
  const { videoId, platform, budget } = req.body;
  if (!videoId) {
    return res.status(400).json({ success: false, message: 'Video ID is required' });
  }
  const result = await launchTestAd(videoId, platform, budget);
  sendSuccess(res, 'Test ad launched and monitoring active', 200, result);
}));

/**
 * @route   POST /api/video/advanced/ingest-metrics
 * @desc    Task 9.1: Ingest actual performance metrics from platforms
 * @access  Private
 */
const { ingestPostMetrics } = require('../../services/oracleMetricIngestionService');
router.post('/ingest-metrics', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.body;
  const result = await ingestPostMetrics(workspaceId || req.user.workspaceId);
  sendSuccess(res, 'Oracle metrics ingestion complete', 200, result);
}));

/**
 * @route   POST /api/video/advanced/analyze-pivots
 * @desc    Task 9.2: Analyze winning styles and suggest strategic pivots
 * @access  Private
 */
const { analyzeStrategicPivots } = require('../../services/cognitiveLoopService');
router.post('/analyze-pivots', auth, asyncHandler(async (req, res) => {
  const { workspaceId, niche } = req.body;
  const result = await analyzeStrategicPivots(workspaceId || req.user.workspaceId, niche);
  sendSuccess(res, 'Cognitive loop analysis complete', 200, result);
}));

/**
 * @route   GET /api/video/advanced/ledger
 * @desc    Retrieve the Click Ledger audit trail
 * @access  Private
 */
const clickLedger = require('../../services/clickLedgerService');
router.get('/ledger', auth, asyncHandler(async (req, res) => {
  const audits = clickLedger.getRecentAudits(20);
  const state = clickLedger.getLedgerState();
  sendSuccess(res, 'Click Ledger audit trail retrieved', 200, { audits, state });
}));

/**
 * @route   GET /api/video/advanced/synthesis-status
 * @desc    Scale/Status for Visual Synthesis Engine
 * @access  Private
 */
const visualSynthesis = require('../../services/visualSynthesisService');
router.get('/synthesis-status', auth, asyncHandler(async (req, res) => {
  const jobs = visualSynthesis.getAllJobs();
  const seed = visualSynthesis.getNeuralSeed();
  sendSuccess(res, 'Visual Synthesis status retrieved', 200, { jobs, seed });
}));

/**
 * @route   POST /api/video/advanced/style-bridge
 * @desc    Apply regional stylistic DNA to the Visual Synthesis Engine
 * @access  Private
 */
router.post('/style-bridge', auth, asyncHandler(async (req, res) => {
  const { regionId } = req.body;
  const config = await visualSynthesis.applyStyleBridge(regionId);
  sendSuccess(res, 'Style-Bridge activated', 200, config);
}));

/**
 * @route   POST /api/video/advanced/style-fix
 * @desc    Apply Style-Fix automation to low-retention segments
 * @access  Private
 */
router.post('/style-fix', auth, asyncHandler(async (req, res) => {
  const { jobId, heatmap } = req.body;
  const result = await visualSynthesis.applyStyleFix(jobId, heatmap);
  sendSuccess(res, 'Style-Fix automation applied', 200, result);
}));

/**
 * @route   POST /api/video/advanced/community-feedback
 * @desc    Feed Whop engagement back into Style-DNA engine
 * @access  Private
 */
router.post('/community-feedback', auth, asyncHandler(async (req, res) => {
  const { regionId, engagementMetrics } = req.body;
  const result = await visualSynthesis.processCommunityFeedback(regionId, engagementMetrics);
  sendSuccess(res, 'Community Feedback Loop: Style-DNA evolved', 200, result);
}));

/**
 * @route   POST /api/video/advanced/export-whop
 * @desc    Render and export visual content to Whop distribution
 * @access  Private
 */
router.post('/export-whop', auth, asyncHandler(async (req, res) => {
  const { jobId, regionId } = req.body;
  const result = await visualSynthesis.exportToWhop(jobId, regionId);
  sendSuccess(res, 'Global Render Bridge: Export successful', 200, result);
}));

/**
 * @route   GET /api/video/advanced/surge-ledger
 * @desc    Fetch history of autonomous Style-DNA shifts and ROI
 * @access  Private
 */
router.get('/surge-ledger', auth, asyncHandler(async (req, res) => {
  const ledger = await visualSynthesis.getSurgeLedger();
  sendSuccess(res, 'Surge Ledger: History retrieved', 200, ledger);
}));

/**
 * @route   POST /api/video/advanced/auto-surge-bridge
 * @desc    Execute autonomous Style-DNA shifts for high-probability surges
 * @access  Private
 */
router.post('/auto-surge-bridge', auth, asyncHandler(async (req, res) => {
  const bridged = await visualSynthesis.executeAutoSurgeBridge();
  sendSuccess(res, `Auto-Surge Bridge: ${bridged.length} nodes shifted`, 200, bridged);
}));

/**
 * @route   GET /api/video/advanced/evolution-forecast
 * @desc    Fetch predictive Style-DNA surge forecasts
 * @access  Private
 */
router.get('/evolution-forecast', auth, asyncHandler(async (req, res) => {
  const forecast = await visualSynthesis.getPredictiveSurgeForecast();
  sendSuccess(res, 'Predictive Evolution: Forecast retrieved', 200, forecast);
}));

/**
 * @route   GET /api/video/advanced/financial-bridge
 * @desc    Retrieve Payout Bridge and Fiscal Summary
 * @access  Private
 */
const payoutBridge = require('../../services/payoutBridgeService');
router.get('/financial-bridge', auth, asyncHandler(async (req, res) => {
  const summary = payoutBridge.getFinancialSummary();
  const bridges = payoutBridge.getBridgeStatus();
  sendSuccess(res, 'Financial bridge summary retrieved', 200, { summary, bridges });
}));

module.exports = router;







