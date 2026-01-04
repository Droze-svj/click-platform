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
const progressTracker = require('../../services/videoProgressService');
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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
        try { fs.unlinkSync(inputPath); } catch (_) {}
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

module.exports = router;






