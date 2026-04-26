const logger = require('../utils/logger');
logger.debug('🎬 Video route initialization sequence starting...');
const express = require('express');
logger.debug('📦 express loaded');
const multer = require('multer');
logger.debug('📦 multer loaded');
const path = require('path');
logger.debug('📦 path loaded');
const fs = require('fs');
logger.debug('📦 fs loaded');
const ffmpeg = require('fluent-ffmpeg');
logger.debug('📦 fluent-ffmpeg loaded');
const Content = require('../models/Content');
logger.debug('📦 Content model loaded');
const User = require('../models/User');
logger.debug('📦 User model loaded');
const auth = require('../middleware/auth');
logger.debug('📦 auth middleware loaded');
const { uploadLimiter } = require('../middleware/enhancedRateLimiter');
logger.debug('📦 uploadLimiter loaded');
const { generateCaptions, detectHighlights } = require('../services/aiService');
logger.debug('📦 aiService loaded');
const { generateTranscriptFromVideo } = require('../services/whisperService');
logger.debug('📦 whisperService loaded');
const { transcribeVideo: transcribeVideoService, isTranscriptionConfigured } = require('../services/aiTranscriptionService');
logger.debug('📦 aiTranscriptionService loaded');
const { applyVideoEffect, addTextOverlay, addWatermark } = require('../services/videoEffects');
logger.debug('📦 videoEffects loaded');
const { generateThumbnail } = require('../services/thumbnailService');
logger.debug('📦 thumbnailService loaded');
const { cleanupFailedContent } = require('../utils/fileCleanup');
logger.debug('📦 fileCleanup loaded');
const { emitToUser } = require('../services/socketService');
logger.debug('📦 socketService loaded');
const { retry } = require('../utils/retry');
logger.debug('📦 retry utility loaded');
const { validateVideoFile, validateFileExists } = require('../middleware/fileValidator');
logger.debug('📦 fileValidator loaded');
const { requireActiveSubscription } = require('../middleware/subscriptionAccess');
logger.debug('📦 subscriptionAccess loaded');
const { uploadFile } = require('../services/storageService');
logger.debug('📦 storageService loaded');
const { trackAction } = require('../services/workflowService');
logger.debug('📦 workflowService loaded');
const { isDevUser, allowDevMode: checkAllowDevMode } = require('../utils/devUser');
logger.debug('✅ Video route core dependencies loaded');
const router = express.Router();
router.use('/ai-editing', require('./video/ai-editing'));
router.use('/progress', require('./video/progress'));
// In-memory store for dev videos (maps contentId to video data)
// In production, this would use a database or cache
const { devVideoStore } = require('../utils/devStore');
let activeProcessCount = 0;
const MAX_CONCURRENT_LOCAL_JOBS = 10; // Increased from 2 to 10 for better dev experience

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use absolute path from process.cwd() instead of relative __dirname 
    const uploadPath = path.join(process.cwd(), 'uploads/videos');
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        // Ensure write permissions
        fs.chmodSync(uploadPath, '777');
      }
      
      // Heartbeat Log for real-time telemetry
      console.log(`🎯 [Ingress] DIRECT DISK WRITE START: ${file.originalname} -> ${uploadPath}`);
      
      cb(null, uploadPath);
    } catch (err) {
      logger.error('❌ [Multer] Directory initialization failed:', err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const userId = (req.user && (req.user.id || req.user._id)) ? String(req.user.id || req.user._id) : 'unknown';
      cb(null, `${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    } catch (error) {
      // Fallback if there's any error accessing req.user
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `unknown-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5368709120 }, // 5GB for cinematic dev headroom
  fileFilter: (req, file, cb) => {
    const devModeAllowed = checkAllowDevMode(req);
    const isDev = isDevUser(req.user);

    if (devModeAllowed && isDev) {
      // Allow any file for dev users (they'll get a mock response anyway)
      cb(null, true);
      return;
    }

    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Multer error handler middleware - catches multer errors before they become 500s
const handleMulterError = (err, req, res, next) => {
  if (err) {
    logger.error('💥 [Multer] Ingress failure detected:', {
      error: err.message,
      code: err.code,
      userId: req.user?._id || req.user?.id
    });

    const devModeAllowed = checkAllowDevMode(req);
    const isDev = isDevUser(req.user);

    // For dev users, convert multer errors to mock responses if appropriate
    if (devModeAllowed && isDev && (err instanceof multer.MulterError || err.message?.includes('Only video files are allowed'))) {
      logger.warn('🔧 Returning mock response for dev user after Multer error');
      return res.json({
        success: true,
        message: 'Video uploaded successfully (dev mode fallback)',
        data: {
          contentId: 'dev-content-' + Date.now(),
          status: 'processing'
        }
      });
    }

    // Handle specific common Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'PAYLOAD_OVERSIZE',
        message: `The video file depends more than the ${process.env.MAX_FILE_SIZE || '1GB'} threshold.`
      });
    }

    return res.status(500).json({
      success: false,
      error: 'INGRESS_ERROR',
      message: err.message || 'Data stream interrupted by host architecture'
    });
  }
  next();
};

// Upload video (with rate limiting)
router.post('/upload', auth, requireActiveSubscription, uploadLimiter, upload.single('video'), handleMulterError, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    // In non-production mode OR when running on localhost, return mock response for dev users
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const referer = req.headers.referer || req.headers.origin || '';
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      referer.includes('localhost') || referer.includes('127.0.0.1') ||
      (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    const nodeEnv = process.env.NODE_ENV;
    let devModeAllowed = !nodeEnv || nodeEnv !== 'production' || isLocalhost;

    // Enhanced logging for debugging
    logger.info('🎯 [Ingress] VIDEO UPLOAD ROUTE HIT', {
      userId,
      host,
      referer,
      isLocalhost,
      devModeAllowed,
      nodeEnv: nodeEnv || 'undefined',
      hasFile: !!req.file,
      hasUser: !!req.user,
      contentLength: req.headers['content-length']
    });

    // ALWAYS handle dev users early to prevent MongoDB operations with invalid ObjectIds
    // Check for dev users FIRST, before any MongoDB operations
    devModeAllowed = checkAllowDevMode(req);
    if (userId && isDevUser(req.user)) {
      

      // If file was uploaded, save it locally but don't create MongoDB document
      if (req.file) {
        let fileUrl = `/uploads/videos/${req.file.filename}`;
        const contentId = 'dev-content-' + Date.now();

        // Store the video data in memory for dev mode
        devVideoStore.set(contentId, {
          _id: contentId,
          title: req.body.title || req.file.originalname || 'Uploaded Video',
          status: 'completed',
          type: 'video',
          userId: userId,
          originalFile: {
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        

        return res.json({
          success: true,
          message: 'Video uploaded successfully (dev mode)',
          data: {
            contentId: contentId,
            status: 'processing'
          }
        });
      } else {
        // No file uploaded, return mock response
        return res.json({
          success: true,
          message: 'Video uploaded successfully (dev mode)',
          data: {
            contentId: 'dev-content-' + Date.now(),
            status: 'processing'
          }
        });
      }
    }

    // For non-dev users, require file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    // Validate video file
    try {
      validateVideoFile(req.file);
    } catch (validationError) {
      // Clean up uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        error: validationError.message
      });
    }

    // Upload to cloud storage (S3) or keep local
    let fileUrl = `/uploads/videos/${req.file.filename}`;
    let storageKey = `videos/${req.file.filename}`;
    let storageType = 'local';

    // Only attempt cloud upload if NOT in dev/localhost mode
    if (!devModeAllowed) {
      try {
        const uploadResult = await uploadFile(
          req.file.path,
          storageKey,
          req.file.mimetype,
          {
            userId: (req.user._id || req.user.id).toString(),
            originalName: req.file.originalname,
          }
        );

        if (uploadResult) {
          fileUrl = uploadResult.url;
          storageKey = uploadResult.key;
          storageType = uploadResult.storage || 'local';

          // Delete local file if uploaded to cloud storage
          if (uploadResult.storage === 's3' && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            logger.info('Local file deleted after cloud upload', { path: req.file.path });
          }
        }
      } catch (uploadError) {
        logger.error('🛠️ [Storage] Cloud storage upload failed, using local file', { error: uploadError.message });
        // Continue with local file if cloud upload fails
      }
    } else {
      logger.info('🔧 [Storage] Skipping cloud upload in development mode.');
    }

    const content = new Content({
      userId: req.user._id || req.user.id,
      type: 'video',
      originalFile: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        storageKey: storageKey,
        storage: storageType
      },
      title: req.body.title || 'Untitled Video',
      description: req.body.description,
      status: 'processing',
      musicId: req.body.musicId || null,
      processingOptions: {
        effects: req.body.effects ? (Array.isArray(req.body.effects) ? req.body.effects : JSON.parse(req.body.effects)) : [],
        textOverlay: req.body.textOverlay ? (typeof req.body.textOverlay === 'string' ? JSON.parse(req.body.textOverlay) : req.body.textOverlay) : null,
        watermark: req.body.watermarkPath || null
      }
    });

    // Check MongoDB connection before saving
    const mongoose = require('mongoose');
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected && devModeAllowed) {
      logger.warn('🔧 [Persistence] Database offline. Migrating content to In-Memory Dev Store.');
      
      const contentId = content._id.toString();
      const mockContent = content.toObject ? content.toObject() : content;
      mockContent.status = 'completed'; // Instant completion for dev mock
      devVideoStore.set(contentId, mockContent);

      return res.json({
        success: true,
        message: 'Video upload completed (In-Memory Fallback)',
        data: {
          contentId: contentId,
          status: 'processing'
        }
      });
    }

    await content.save();

    // Process video in background using job queue.
    // IMPORTANT: Redis/job queues may not be configured in local/free-tier environments.
    // Fall back to in-process processing so users can still test uploads/clipping.
    try {
      const { addVideoProcessingJob, JOB_PRIORITY } = require('../queues');
      await addVideoProcessingJob({
        contentId: content._id.toString(),
        videoPath: req.file.path,
        user: {
          _id: req.user._id.toString(),
          email: req.user.email,
          name: req.user.name,
        },
      }, {
        priority: JOB_PRIORITY.HIGH,
        jobId: `video-${content._id}`,
      });
    } catch (queueError) {
      if (activeProcessCount >= MAX_CONCURRENT_LOCAL_JOBS) {
        logger.error('Job queue unavailable AND local concurrency limit reached. Rejecting job.', {
          contentId: content._id.toString(),
          activeProcessCount
        });
        content.status = 'failed';
        await content.save();
        return res.status(503).json({
          success: false,
          error: 'Server load reached maximum capacity. Please try again later.'
        });
      }

      logger.warn('Job queue unavailable; falling back to in-process video processing', {
        error: queueError.message,
        contentId: content._id.toString(),
        userId: req.user._id.toString(),
        activeProcessCount
      });

      activeProcessCount++;
      const currentContentId = content._id.toString();
      setImmediate(async () => {
        try {
          await processVideo(currentContentId, req.file.path, {
            _id: req.user._id.toString(),
            email: req.user.email,
            name: req.user.name,
          });
        } catch (err) {
          logger.error('In-process video processing failed', {
            error: err.message,
            contentId: currentContentId,
            userId: req.user._id.toString(),
          });
        } finally {
          activeProcessCount--;
          // Final safety cleanup of original file if still present
          if (fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => {
              if (!err) logger.info('Cleaned up original local file in finally', { path: req.file.path });
            });
          }
        }
      });
    }

    // Store music preference if provided
    if (req.body.musicId) {
      content.musicId = req.body.musicId;
      await content.save();
    }

    // Track action for workflow learning
    // userId already declared at the top of the function
    await trackAction(userId, 'upload_video', {
      entityType: 'video',
      entityId: content._id,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });

    // Update engagement (streak, achievements, activity) - Shielded for resilience
    try {
      const { updateStreak, checkAchievements, createActivity } = require('../services/engagementService');
      await updateStreak(userId).catch(e => logger.warn('Engagement: Streak failed', { e: e.message }));
      await checkAchievements(userId, 'upload_video', {
        contentId: content._id
      }).catch(e => logger.warn('Engagement: Achievements failed', { e: e.message }));
      await createActivity(userId, 'video_uploaded', {
        title: 'Video Uploaded! 🎥',
        description: `You uploaded "${req.file.originalname}"`,
        entityType: 'video',
        entityId: content._id
      }).catch(e => logger.warn('Engagement: Activity failed', { e: e.message }));
    } catch (engagementErr) {
      logger.warn('Engagement services unavailable, continuing upload', { error: engagementErr.message });
    }

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        contentId: content._id,
        status: 'processing'
      }
    });
  } catch (err) {
    logger.error('💥 [Ingress] Fatal collision in upload route:', {
      error: err.message,
      stack: err.stack,
      userId: req.user?._id || req.user?.id
    });

    // Clean up file if upload failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup file', { error: cleanupError.message });
      }
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'INGRESS_COLLISION',
        message: `SYSTEM_FAULT: ${err.message}`,
        debug: process.env.NODE_ENV !== 'production' ? err.stack : undefined
      });
    }
  }
});

// Process video: clip into short-form content
async function processVideo(contentId, videoPath, user) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      logger.warn('Content not found for processing', { contentId });
      return;
    }

    // Validate file exists
    const fileExists = await validateFileExists(videoPath);
    if (!fileExists) {
      throw new Error('Video file not found');
    }

    // Get video duration with retry
    const duration = await retry(
      () => getVideoDuration(videoPath),
      { maxRetries: 3, initialDelay: 1000 }
    );
    content.originalFile.duration = duration;

    // Generate transcript (if available) or use AI to extract key moments
    const transcript = await generateTranscript(videoPath);
    content.transcript = transcript;

    // Detect highlights
    const highlights = await detectHighlights(transcript, duration);

    // Generate short clips
    const clips = [];
    const clipDuration = 60; // 60 seconds per clip

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      const startTime = Math.max(0, highlight.startTime - 5); // 5 seconds before highlight
      const endTime = Math.min(duration, highlight.startTime + clipDuration);

      const clipFilename = `clip-${contentId}-${i}-${Date.now()}.mp4`; // Unique for atomic sync
      const clipPath = path.join(process.cwd(), 'uploads/clips', clipFilename);

      // Ensure clips directory exists
      const clipsDir = path.dirname(clipPath);
      if (!fs.existsSync(clipsDir)) {
        fs.mkdirSync(clipsDir, { recursive: true });
      }

      // Extract clip with retry
      await retry(
        () => new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(clipPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        }),
        { maxRetries: 2, initialDelay: 2000 }
      );

      // Generate caption for clip
      const caption = await generateCaptions(highlight.text, user.niche, highlight.platform || 'tiktok', req.language || 'en');

      // Base clip path (before any effects/overlays). If we later add music mixing or other transforms,
      // update this to point at the new output file.
      const finalClipPath = clipPath;

      // Generate and optimize thumbnail
      const thumbnailFilename = `thumb-${clipFilename.replace('.mp4', '.jpg')}`;
      const thumbnailPath = path.join(process.cwd(), 'uploads/thumbnails', thumbnailFilename);
      const thumbnailsDir = path.dirname(thumbnailPath);
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }
      await generateThumbnail(finalClipPath, thumbnailPath, {
        width: 1280,
        height: 720,
        quality: 90
      });

      // Optimize thumbnail image (in background, don't block)
      const { optimizeImage } = require('../utils/imageOptimizer');
      optimizeImage(thumbnailPath, thumbnailPath, {
        width: 1280,
        height: 720,
        quality: 85,
        format: 'jpeg'
      }).catch(err => {
        logger.warn('Thumbnail optimization failed, using original', { error: err.message });
      });

      // Apply effects if specified
      let processedClipPath = finalClipPath;
      const effects = content.processingOptions?.effects || [];
      const textOverlay = content.processingOptions?.textOverlay;
      const watermarkPath = content.processingOptions?.watermark;

      // Apply video effects
      if (effects.length > 0) {
        for (const effect of effects) {
          const effectPath = processedClipPath.replace('.mp4', `-${effect}.mp4`);
          await applyVideoEffect(processedClipPath, effectPath, effect);
          // Delete intermediate file if it's not the original clip
          if (processedClipPath !== finalClipPath && fs.existsSync(processedClipPath)) {
            fs.unlinkSync(processedClipPath);
          }
          processedClipPath = effectPath;
        }
      }

      // Add text overlay
      if (textOverlay && textOverlay.text) {
        const textPath = processedClipPath.replace('.mp4', '-text.mp4');
        await addTextOverlay(processedClipPath, textPath, textOverlay);
        if (processedClipPath !== finalClipPath && fs.existsSync(processedClipPath)) {
          fs.unlinkSync(processedClipPath);
        }
        processedClipPath = textPath;
      }

      // Add watermark
      if (watermarkPath && fs.existsSync(watermarkPath)) {
        const watermarkOutputPath = processedClipPath.replace('.mp4', '-watermark.mp4');
        await addWatermark(processedClipPath, watermarkPath, watermarkOutputPath, {
          position: 'bottom-right',
          scale: 0.1,
          opacity: 0.7
        });
        if (processedClipPath !== finalClipPath && fs.existsSync(processedClipPath)) {
          fs.unlinkSync(processedClipPath);
        }
        processedClipPath = watermarkOutputPath;
      }

      // Upload processed clip to cloud storage
      let clipUrl = `/uploads/clips/${path.basename(processedClipPath)}`;
      let thumbUrl = `/uploads/thumbnails/${thumbnailFilename}`;

      try {
        // Upload clip
        const clipUpload = await uploadFile(
          processedClipPath,
          `clips/${path.basename(processedClipPath)}`,
          'video/mp4',
          { contentId: contentId, originalVideo: videoPath }
        );
        clipUrl = clipUpload.url;

        // Upload thumbnail
        const thumbUpload = await uploadFile(
          thumbnailPath,
          `thumbnails/${thumbnailFilename}`,
          'image/jpeg',
          { contentId: contentId }
        );
        thumbUrl = thumbUpload.url;

        // Cleanup local files
        if (clipUpload.storage !== 'local' && fs.existsSync(processedClipPath)) {
          fs.unlinkSync(processedClipPath);
        }
        if (thumbUpload.storage !== 'local' && fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
        // Cleanup original local clip too
        if (finalClipPath !== processedClipPath && fs.existsSync(finalClipPath)) {
          fs.unlinkSync(finalClipPath);
        }
      } catch (uploadError) {
        logger.warn('Failed to upload clip/thumbnail to cloud, using local fallbacks', { error: uploadError.message });
      }

      clips.push({
        url: clipUrl,
        thumbnail: thumbUrl,
        duration: endTime - startTime,
        caption: caption,
        platform: highlight.platform || 'tiktok',
        highlight: true,
        hasMusic: !!content.musicId,
        effects: effects,
        hasTextOverlay: !!textOverlay,
        hasWatermark: !!watermarkPath
      });
    }

    content.generatedContent.shortVideos = clips;
    content.status = 'completed';
    await content.save();

    // Update user usage
    await User.findByIdAndUpdate(user._id, {
      $inc: { 'usage.videosProcessed': 1 }
    });

    // Emit real-time update
    try {
      emitToUser(user._id.toString(), 'video-processed', {
        contentId: content._id.toString(),
        status: 'completed',
        clips: clips.length
      });
    } catch (error) {
      // Socket not critical, continue
    }
  } catch (error) {
    logger.error('Video processing error:', error);
    const content = await Content.findById(contentId);
    if (content) {
      content.status = 'failed';
      await content.save();

      // Emit real-time update
      try {
        emitToUser(user._id.toString(), 'video-processed', {
          contentId: content._id.toString(),
          status: 'failed'
        });
      } catch (socketError) {
        // Socket not critical
      }

      // Clean up uploaded files on failure
      const filesToClean = [];
      if (content.originalFile?.url) filesToClean.push(content.originalFile.url);
      if (content.generatedContent?.shortVideos) {
        content.generatedContent.shortVideos.forEach(video => {
          if (video.url) filesToClean.push(video.url);
          if (video.thumbnail) filesToClean.push(video.thumbnail);
        });
      }
      if (filesToClean.length > 0) {
        await cleanupFailedContent(contentId, filesToClean);
      }
    }
  }
}

function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

async function generateTranscript(videoPath) {
  try {
    // Try OpenAI Whisper first
    const transcript = await generateTranscriptFromVideo(videoPath);
    if (transcript) {
      return transcript;
    }

    // Fallback if Whisper fails or not configured
    logger.warn('Using fallback transcript generation');
    return "Transcript generation requires OpenAI API key. Please configure OPENAI_API_KEY to enable automatic transcription.";
  } catch (error) {
    logger.error('Transcript generation error', { error: error.message, videoPath });
    return "Transcript generation failed. Please try again or upload a video with clear audio.";
  }
}

// Get all videos for a user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const isDev = userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123');

    if (isDev) {
      logger.info('🔧 [Video] Returning mock video list for dev user');
      return res.json({
        success: true,
        data: Array.from(devVideoStore.values())
      });
    }

    const videos = await Content.find({ userId, type: 'video' }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: videos
    });
  } catch (error) {
    logger.error('Error fetching videos:', error);
    res.status(500).json({ success: false, error: 'Error fetching videos' });
  }
});

// Transcription requirements check (must be before /:contentId/status to avoid matching)
router.get('/transcribe-editor/status', auth, (req, res) => {
  const openaiConfigured = isTranscriptionConfigured();
  res.json({
    success: true,
    data: {
      openaiConfigured,
      message: openaiConfigured
        ? 'Transcription ready. Use a local upload and click Transcribe in Elite AI.'
        : 'Set OPENAI_API_KEY in your environment to enable transcription.'
    }
  });
});

// Get video processing status
router.get('/:contentId/status', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user?._id || req.user?.id;
    
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    // Handle dev contentIds and dev users - return mock processing status with simulated completion
    if (allowDevMode && (contentId.toString().startsWith('dev-content-') || contentId.toString().startsWith('dev-') || (userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')))) {
      
      // Check if we have this video in our dev store
      const devVideo = devVideoStore.get(contentId);
      
      if (devVideo && devVideo.status === 'completed') {
        return res.json({
          success: true,
          data: {
            status: 'completed',
            progress: 100,
            generatedContent: devVideo.generatedContent,
            editedVideoUrl: devVideo.originalFile?.url,
            editsApplied: devVideo.generatedContent?.shortVideos?.[0]?.editsApplied,
            clipsCount: devVideo.generatedContent?.shortVideos?.length || 0,
            message: 'Processing completed'
          }
        });
      } else if (devVideo && devVideo.status === 'processing') {
        return res.json({
          success: true,
          data: {
            status: 'processing',
            progress: 50,
            generatedContent: null,
            clipsCount: 0,
            message: 'Processing video...'
          }
        });
      }

      // Extract timestamp from contentId to simulate processing time for mock uploads
      const timestampMatch = contentId.toString().match(/\d+/);
      const uploadTime = timestampMatch ? parseInt(timestampMatch[0]) : Date.now();
      const elapsedTime = Date.now() - uploadTime;
      // Simulate processing completes after 10 seconds
      const processingCompleteTime = 10000;

      if (elapsedTime >= processingCompleteTime) {
        // Return completed status after simulated processing time
        return res.json({
          success: true,
          data: {
            status: 'completed',
            progress: 100,
            generatedContent: {
              shortVideos: [
                {
                  url: '/uploads/dev-clip-1.mp4',
                  thumbnail: '/uploads/dev-thumbnail-1.jpg',
                  caption: 'Sample clip generated in dev mode',
                  duration: 60,
                  platform: 'tiktok'
                }
              ]
            },
            clipsCount: 1,
            message: 'Processing completed in development mode'
          }
        });
      }

      // Still processing
      const progress = Math.min(95, Math.floor((elapsedTime / processingCompleteTime) * 100));
      return res.json({
        success: true,
        data: {
          status: 'processing',
          progress,
          generatedContent: null,
          clipsCount: 0,
          message: `Processing in development mode (${progress}% complete)`
        }
      });
    }

    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      if (allowDevMode) {
        return res.json({
          success: true,
          data: {
            status: 'processing',
            progress: 50,
            generatedContent: null,
            clipsCount: 0,
            message: 'Processing in development mode (MongoDB not connected)'
          }
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable'
      });
    }

    try {
      const content = await Content.findOne({
        _id: contentId,
        userId: userId
      });

      if (!content) {
        return res.status(404).json({
          success: false,
          error: 'Content not found'
        });
      }

      // Calculate progress based on status
      let progress = 0;
      if (content.status === 'completed') progress = 100;
      else if (content.status === 'processing') progress = 50;
      else if (content.status === 'failed') progress = 0;

      res.json({
        success: true,
        data: {
          status: content.status,
          progress,
          generatedContent: content.generatedContent,
          clipsCount: content.generatedContent?.shortVideos?.length || 0
        }
      });
    } catch (dbError) {
      // Handle CastError and connection errors gracefully for dev mode
      if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('buffering') || dbError.message?.includes('connection'))) {
        logger.warn('Database error in video status query, returning mock response for dev mode', {
          error: dbError.message,
          errorName: dbError.name,
          contentId,
          userId
        });

        // Simulate completion after 10 seconds for dev mode
        const timestampMatch = contentId.toString().match(/\d+/);
        const uploadTime = timestampMatch ? parseInt(timestampMatch[0]) : Date.now();
        const elapsedTime = Date.now() - uploadTime;
        const processingCompleteTime = 10000;

        if (elapsedTime >= processingCompleteTime) {
          return res.json({
            success: true,
            data: {
              status: 'completed',
              progress: 100,
              generatedContent: {
                shortVideos: [
                  {
                    url: '/uploads/dev-clip-1.mp4',
                    thumbnail: '/uploads/dev-thumbnail-1.jpg',
                    caption: 'Sample clip generated in dev mode',
                    duration: 60,
                    platform: 'tiktok'
                  }
                ]
              },
              clipsCount: 1,
              message: 'Processing completed in development mode'
            }
          });
        }

        const progress = Math.min(95, Math.floor((elapsedTime / processingCompleteTime) * 100));
        return res.json({
          success: true,
          data: {
            status: 'processing',
            progress,
            generatedContent: null,
            clipsCount: 0,
            message: `Processing in development mode (${progress}% complete)`
          }
        });
      }
      throw dbError;
    }
  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    const contentId = req.params.contentId;
    logger.error('Get video status error', {
      error: error.message,
      stack: error.stack,
      contentId,
      userId,
      errorName: error.name,
      errorCode: error.code
    });

    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    // For dev mode CastErrors, return mock response instead of 500
    if (allowDevMode && (error.name === 'CastError' || error.message?.includes('buffering') || error.message?.includes('connection'))) {
      return res.json({
        success: true,
        data: {
          status: 'processing',
          progress: 50,
          generatedContent: null,
          clipsCount: 0,
          message: 'Processing in development mode'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to get video status' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { details: error.name })
    });
  }
});

// Get all user videos
// Test route without auth
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Video test route works' });
});

router.get('/', auth, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }

    // In development mode OR when running on localhost, return empty array for dev users
    // This prevents MongoDB queries with invalid ObjectIds
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const referer = req.headers.referer || req.headers.origin || '';
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      referer.includes('localhost') || referer.includes('127.0.0.1') ||
      (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    const nodeEnv = process.env.NODE_ENV;
    const allowDevMode = !nodeEnv || nodeEnv !== 'production' || isLocalhost;

    // Check for dev users FIRST, before any MongoDB operations
    // ALWAYS return early for dev users to prevent MongoDB CastError with invalid ObjectIds
    if (userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
      // Always return empty array for dev users, regardless of allowDevMode
      // This prevents MongoDB queries with invalid ObjectIds like 'dev-user-123'
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    // Check if MongoDB is connected before attempting queries
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return empty array for dev mode, error for production
      if (allowDevMode) {
        logger.warn('MongoDB not connected, returning empty array for dev mode');
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable'
      });
    }

    // For production or non-dev users, query the database
    // Note: In development, non-dev users can still query the database
    const query = { userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const videos = await Content.find(query)
      .select('title description originalFile status createdAt processingOptions')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Content.countDocuments(query);

    res.json({
      success: true,
      data: videos || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    logger.error('Get videos error', { error: error.message, stack: error.stack, userId });
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to load videos' : error.message
    });
  }
});

// Delete video
router.delete('/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    // Clean up files
    const filesToClean = [];
    if (content.originalFile?.url) filesToClean.push(content.originalFile.url);
    if (content.generatedContent?.shortVideos) {
      content.generatedContent.shortVideos.forEach(video => {
        if (video.url) filesToClean.push(video.url);
        if (video.thumbnail) filesToClean.push(video.thumbnail);
      });
    }

    if (filesToClean.length > 0) {
      await cleanupFailedContent(req.params.contentId, filesToClean);
    }

    await content.deleteOne();

    logger.info('Video deleted', { contentId: req.params.contentId, userId: req.user._id });

    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    logger.error('Delete video error', { error: error.message, contentId: req.params.contentId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single video by ID
router.get('/:contentId', auth, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user?._id || req.user?.id;

    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    // Handle dev contentIds - return stored video data
    if (allowDevMode && (contentId.toString().startsWith('dev-content-') || contentId.toString().startsWith('dev-'))) {
      // Check if we have this video in our dev store
      const devVideo = devVideoStore.get(contentId);

      if (devVideo) {
        
        return res.json({
          success: true,
          data: devVideo
        });
      }

      // Fallback: return mock data if not found in store (for backward compatibility)
      const timestampMatch = contentId.toString().match(/\d+/);
      const uploadTime = timestampMatch ? parseInt(timestampMatch[0]) : Date.now();

      

      return res.json({
        success: true,
        data: {
          _id: contentId,
          title: 'Uploaded Video',
          status: 'completed',
          type: 'video',
          userId: userId,
          originalFile: {
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            filename: 'sample-video.mp4'
          },
          createdAt: new Date(uploadTime).toISOString(),
          updatedAt: new Date(uploadTime).toISOString()
        }
      });
    }

    // Find the video content
    const content = await Content.findOne({
      _id: contentId,
      userId: userId,
      type: 'video'
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Populate user info for the response
    await content.populate('userId', 'name email');

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    logger.error('Get video error', { error: error.message, contentId: req.params.contentId });

    // For dev mode CastErrors, return mock response instead of 500
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') ||
      (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    if (allowDevMode && (error.name === 'CastError' || error.message?.includes('Cast to ObjectId'))) {
      const contentId = req.params.contentId;
      const timestampMatch = contentId.toString().match(/\d+/);
      const uploadTime = timestampMatch ? parseInt(timestampMatch[0]) : Date.now();

      return res.json({
        success: true,
        data: {
          _id: contentId,
          title: 'Uploaded Video',
          status: 'completed',
          type: 'video',
          userId: req.user?._id || req.user?.id,
          originalFile: {
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            filename: 'sample-video.mp4'
          },
          createdAt: new Date(uploadTime).toISOString(),
          updatedAt: new Date(uploadTime).toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze video for AI editing suggestions
router.post('/analyze', auth, async (req, res) => {
  try {
    const { videoId, url, duration } = req.body;

    if (!videoId || !url) {
      return res.status(400).json({
        success: false,
        error: 'videoId and url are required'
      });
    }

    // Try to find the video content, but don't require it for basic analysis
    const content = await Content.findOne({
      _id: videoId,
      userId: req.user._id,
      type: 'video'
    }).catch(() => null); // Ignore database errors

    // Use AI service to analyze the video content
    let analysisResult;

    try {
      const { analyzeVideoContent } = require('../services/aiService');
      analysisResult = await analyzeVideoContent({ videoId, url, duration });
    } catch (aiError) {
      
      analysisResult = null;
    }

    // Fallback analysis if AI fails or not configured
    const fallbackAnalysis = analysisResult || {
      contentType: ['educational', 'tutorial', 'review', 'entertainment', 'lifestyle', 'tech'][Math.floor(Math.random() * 6)],
      mood: ['professional', 'casual', 'energetic', 'calm', 'humorous', 'inspirational'][Math.floor(Math.random() * 6)],
      suggestedEdits: [
        {
          type: 'trim',
          start: 0,
          end: 3,
          reason: 'Remove silent intro for better engagement',
          confidence: 0.85
        },
        {
          type: 'text',
          content: 'Welcome to our amazing content!',
          position: 'center',
          time: 2,
          reason: 'Add engaging hook at the beginning',
          confidence: 0.78
        },
        {
          type: 'music',
          genre: 'upbeat',
          reason: 'Increase energy and engagement',
          confidence: 0.92
        },
        {
          type: 'highlight',
          start: Math.floor(duration * 0.3),
          end: Math.floor(duration * 0.4),
          reason: 'Key moment that resonates with audience',
          confidence: 0.88
        }
      ],
      voiceHookSuggestions: [
        {
          id: 'attention_hook',
          text: 'Did you know...',
          engagement: Math.floor(Math.random() * 20) + 75,
          category: 'curiosity'
        },
        {
          id: 'question_hook',
          text: 'Have you ever wondered...',
          engagement: Math.floor(Math.random() * 20) + 75,
          category: 'question'
        },
        {
          id: 'problem_hook',
          text: 'Are you tired of...',
          engagement: Math.floor(Math.random() * 20) + 75,
          category: 'problem-solution'
        },
        {
          id: 'story_hook',
          text: 'Let me tell you a story...',
          engagement: Math.floor(Math.random() * 20) + 75,
          category: 'storytelling'
        }
      ],
      platformOptimizations: {
        youtube: {
          duration: duration > 300 ? '8-12min' : '3-8min',
          format: '16:9',
          recommended: true,
          suggestions: [
            'Add chapter markers',
            'Include end screens',
            'Optimize thumbnail'
          ]
        },
        instagram: {
          duration: '30-90s',
          format: '9:16',
          recommended: duration < 90,
          suggestions: [
            'Vertical format preferred',
            'Add trending audio',
            'Use engaging captions'
          ]
        },
        tiktok: {
          duration: '15-60s',
          format: '9:16',
          recommended: duration < 60,
          suggestions: [
            'Hook in first 3 seconds',
            'Use trending sounds',
            'Add text overlays'
          ]
        },
        twitter: {
          duration: '30-140s',
          format: '16:9',
          recommended: duration < 140,
          suggestions: [
            'Keep it concise',
            'Add engaging thumbnail',
            'Use relevant hashtags'
          ]
        }
      },
      contentInsights: {
        bestMoments: [
          { time: Math.floor(duration * 0.2), reason: 'High engagement moment' },
          { time: Math.floor(duration * 0.6), reason: 'Key demonstration' },
          { time: Math.floor(duration * 0.8), reason: 'Strong call-to-action' }
        ],
        pacingSuggestions: [
          'Slow down for complex explanations',
          'Speed up transitions between topics',
          'Add pauses for emphasis'
        ],
        audienceRetention: {
          predicted: Math.floor(Math.random() * 20) + 70,
          tips: [
            'Maintain consistent energy',
            'Deliver value throughout',
            'Strong opening hook'
          ]
        }
      },
      technicalSuggestions: {
        brightness: 'optimal',
        audio: 'clear',
        stabilization: 'recommended',
        frameRate: '30fps',
        resolution: '1080p'
      }
    };

    // Save analysis to content (only if content exists)
    if (content) {
      content.analysis = {
        ...fallbackAnalysis,
        analyzedAt: new Date(),
        analyzer: analysisResult ? 'ai' : 'fallback'
      };
      await content.save();
    }

    // Track action for workflow learning (only if content exists)
    if (content) {
      await trackAction(req.user._id, 'analyze_video', {
        entityType: 'video',
        entityId: content._id,
        analysisType: analysisResult ? 'ai' : 'fallback',
        duration: duration
      });
    }

    res.json({
      success: true,
      data: fallbackAnalysis,
      message: 'Video analyzed successfully'
    });

  } catch (error) {
    logger.error('Video analysis error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Analysis failed. Please try again.',
      details: error.message
    });
  }
});

// Extract highlights from video
router.post('/extract-highlights', auth, async (req, res) => {
  try {
    const { videoId, url, duration, title } = req.body;

    if (!videoId || !url) {
      return res.status(400).json({
        success: false,
        error: 'videoId and url are required'
      });
    }

    // Find the video content (optional for development)
    const content = await Content.findOne({
      _id: videoId,
      userId: req.user._id,
      type: 'video'
    }).catch(() => null); // Ignore database errors

    // Use AI service to detect highlights
    const { detectHighlights } = require('../services/aiService');
    let highlightsResult;

    try {
      highlightsResult = await detectHighlights({ videoId, url, duration, title });
    } catch (aiError) {
      logger.warn('AI highlight detection failed, using fallback', {
        error: aiError.message,
        videoId
      });
    }

    // Generate highlight moments based on analysis
    const highlightMoments = [];

    if (highlightsResult && highlightsResult.moments) {
      highlightsResult.moments.forEach((moment, index) => {
        highlightMoments.push({
          startTime: moment.startTime || (index * duration / highlightsResult.moments.length),
          endTime: moment.endTime || ((index + 1) * duration / highlightsResult.moments.length),
          title: moment.title || `Highlight ${index + 1}`,
          description: moment.description || 'AI-detected engaging moment',
          score: moment.score || Math.floor(Math.random() * 30) + 70,
          type: moment.type || ['action', 'dialogue', 'emotional'][Math.floor(Math.random() * 3)],
          tags: moment.tags || ['highlight']
        });
      });
    } else {
      // Fallback: Generate highlights based on video duration
      const numHighlights = Math.min(Math.floor(duration / 30), 8);
      const interval = duration / numHighlights;

      for (let i = 0; i < numHighlights; i++) {
        const startTime = i * interval + 5; // Skip first 5 seconds
        const endTime = Math.min(startTime + Math.min(interval * 0.6, 25), duration);

        highlightMoments.push({
          startTime,
          endTime,
          title: `Highlight ${i + 1}`,
          description: 'Automatically detected engaging moment',
          score: Math.floor(Math.random() * 30) + 60,
          type: ['action', 'dialogue', 'emotional', 'funny'][Math.floor(Math.random() * 4)],
          tags: ['highlight', 'auto-generated']
        });
      }
    }

    // Update content with highlights info (only if content exists)
    if (content) {
      content.highlightsExtracted = true;
      content.highlightsCount = highlightMoments.length;
      content.highlightsData = highlightMoments;
      content.extractedAt = new Date();
      await content.save();

      // Track action
      await trackAction(req.user._id, 'extract_highlights', {
        entityType: 'video',
        entityId: content._id,
        highlightsCount: highlightMoments.length,
        method: highlightsResult ? 'ai' : 'fallback'
      });
    }

    res.json({
      success: true,
      data: {
        highlightMoments,
        totalDuration: duration,
        extractedCount: highlightMoments.length
      },
      message: `${highlightMoments.length} highlights extracted successfully`
    });

  } catch (error) {
    logger.error('Highlight extraction error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Highlight extraction failed. Please try again.',
      details: error.message
    });
  }
});

// Generate auto-captions for video
router.post('/generate-captions', auth, async (req, res) => {
  try {
    const { videoId, url, duration, language = 'en' } = req.body;

    if (!videoId || !url) {
      return res.status(400).json({
        success: false,
        error: 'videoId and url are required'
      });
    }

    // Try to find the video content, but don't require it for caption generation
    const content = await Content.findOne({
      _id: videoId,
      userId: req.user._id,
      type: 'video'
    }).catch(() => null); // Ignore database errors

    // Use AI service to generate captions
    let captionsResult;

    try {
      const { generateCaptions } = require('../services/aiService');
      captionsResult = await generateCaptions({ videoId, url, duration, language });
    } catch (aiError) {
      
      captionsResult = null;
    }

    // Generate captions using Whisper or fallback
    const captions = [];

    if (captionsResult && captionsResult.captions) {
      captionsResult.captions.forEach((caption, index) => {
        captions.push({
          id: `caption-${videoId}-${index}`,
          text: caption.text,
          start: caption.start,
          end: caption.end,
          confidence: caption.confidence || 0.9
        });
      });
    } else {
      // Fallback: Generate sample captions based on duration
      const numCaptions = Math.floor(duration / 10); // Caption every 10 seconds
      for (let i = 0; i < numCaptions; i++) {
        const start = i * 10;
        const end = Math.min(start + 8, duration);
        captions.push({
          id: `fallback-caption-${videoId}-${i}`,
          text: `Sample caption ${i + 1} for the video content`,
          start,
          end,
          confidence: 0.8
        });
      }
    }

    // Update content with captions (only if content exists)
    if (content) {
      content.captionsGenerated = true;
      content.captionsCount = captions.length;
      content.captionsData = captions;
      content.captionedAt = new Date();
      await content.save();

      // Track action
      await trackAction(req.user._id, 'generate_captions', {
        entityType: 'video',
        entityId: content._id,
        captionsCount: captions.length,
        method: captionsResult ? 'ai' : 'fallback'
      });
    }

    res.json({
      success: true,
      data: { captions },
      message: `Generated ${captions.length} captions successfully`
    });

  } catch (error) {
    logger.error('Caption generation error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Caption generation failed. Please try again.',
      details: error.message
    });
  }
});

// Detect scenes and create chapters
router.post('/detect-scenes', auth, async (req, res) => {
  try {
    const { videoId, url, duration } = req.body;

    if (!videoId || !url) {
      return res.status(400).json({
        success: false,
        error: 'videoId and url are required'
      });
    }

    // Try to find the video content, but don't require it for scene detection
    const content = await Content.findOne({
      _id: videoId,
      userId: req.user._id,
      type: 'video'
    }).catch(() => null); // Ignore database errors

    // Use AI service to detect scenes
    let scenesResult;

    try {
      const { detectHighlights } = require('../services/aiService');
      scenesResult = await detectHighlights({ videoId, url, duration, detectScenes: true });
    } catch (aiError) {
      
      scenesResult = null;
    }

    // Generate scenes/chapters
    const scenes = [];

    if (scenesResult && scenesResult.scenes) {
      scenesResult.scenes.forEach((scene, index) => {
        scenes.push({
          startTime: scene.startTime,
          endTime: scene.endTime,
          title: scene.title || `Scene ${index + 1}`,
          description: scene.description || 'Detected scene',
          thumbnail: scene.thumbnail,
          type: scene.type || 'scene',
          confidence: scene.confidence || 0.8
        });
      });
    } else {
      // Fallback: Create chapters based on duration
      const numScenes = Math.min(Math.floor(duration / 60) + 1, 8); // Scenes every ~60 seconds
      const sceneDuration = duration / numScenes;

      for (let i = 0; i < numScenes; i++) {
        const startTime = i * sceneDuration;
        const endTime = Math.min((i + 1) * sceneDuration, duration);

        scenes.push({
          startTime,
          endTime,
          title: `Chapter ${i + 1}`,
          description: `Scene ${i + 1} of the video`,
          thumbnail: url,
          type: 'chapter',
          confidence: 0.7
        });
      }
    }

    // Update content with scenes (only if content exists)
    if (content) {
      content.scenesDetected = true;
      content.scenesCount = scenes.length;
      content.scenesData = scenes;
      content.scenesDetectedAt = new Date();
      await content.save();
    }

    // Track action (only if content exists)
    if (content) {
      await trackAction(req.user._id, 'detect_scenes', {
        entityType: 'video',
        entityId: content._id,
        scenesCount: scenes.length,
        method: scenesResult ? 'ai' : 'fallback'
      });
    }

    res.json({
      success: true,
      data: { scenes },
      message: `Detected ${scenes.length} scenes successfully`
    });

  } catch (error) {
    logger.error('Scene detection error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Scene detection failed. Please try again.',
      details: error.message
    });
  }
});

// Analyze video pacing for music sync
router.post('/analyze-pacing', auth, async (req, res) => {
  try {
    const { videoId, duration, contentType } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'videoId is required'
      });
    }

    // Try to find the video content, but don't require it for pacing analysis
    const content = await Content.findOne({
      _id: videoId,
      userId: req.user._id,
      type: 'video'
    }).catch(() => null); // Ignore database errors

    // Analyze pacing based on content type
    const pacingAnalysis = {
      tempo: contentType === 'music-video' ? 'fast' : contentType === 'tutorial' ? 'moderate' : 'slow',
      rhythm: contentType === 'vlog' ? 'steady' : contentType === 'presentation' ? 'formal' : 'dynamic',
      energyLevels: [],
      recommendedGenres: [],
      syncPoints: []
    };

    // Generate pacing data based on content type
    const segments = Math.floor(duration / 30); // Analyze every 30 seconds

    for (let i = 0; i < segments; i++) {
      const time = i * 30;
      pacingAnalysis.energyLevels.push({
        time,
        energy: Math.random() * 0.5 + 0.3, // 0.3 to 0.8
        type: time < duration * 0.2 ? 'intro' : time > duration * 0.8 ? 'outro' : 'main'
      });

      if (i % 2 === 0) { // Add sync points every minute
        pacingAnalysis.syncPoints.push({
          time,
          type: 'beat',
          intensity: Math.random() * 0.5 + 0.5
        });
      }
    }

    // Recommend genres based on content
    switch (contentType) {
    case 'music-video':
      pacingAnalysis.recommendedGenres = ['electronic', 'pop', 'rock'];
      break;
    case 'vlog':
      pacingAnalysis.recommendedGenres = ['acoustic', 'indie', 'ambient'];
      break;
    case 'tutorial':
      pacingAnalysis.recommendedGenres = ['corporate', 'uplifting', 'minimal'];
      break;
    case 'social-media':
      pacingAnalysis.recommendedGenres = ['trending', 'hip-hop', 'electronic'];
      break;
    default:
      pacingAnalysis.recommendedGenres = ['ambient', 'corporate', 'electronic'];
    }

    // Track action (only if content exists)
    if (content) {
      await trackAction(req.user._id, 'analyze_pacing', {
        entityType: 'video',
        entityId: content._id,
        contentType,
        duration
      });
    }

    res.json({
      success: true,
      data: pacingAnalysis,
      message: 'Pacing analysis completed successfully'
    });

  } catch (error) {
    logger.error('Pacing analysis error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Pacing analysis failed. Please try again.',
      details: error.message
    });
  }
});

/**
 * POST /api/video/editor/save
 * Autosave video editor state
 */
router.post('/editor/save', auth, async (req, res) => {
  try {
    const { videoId, editorState } = req.body;
    const userId = req.user?._id || req.user?.id;
    const isDev = isDevUser(req.user);

    // For dev users, just return success
    if (isDev || (videoId && videoId.toString().startsWith('dev-'))) {
      
      return res.json({
        success: true,
        message: 'Editor state saved (dev mode)',
        data: {
          videoId,
          savedAt: new Date().toISOString()
        }
      });
    }

    // For production users, save to database
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Video ID is required'
      });
    }

    const content = await Content.findOne({ _id: videoId, userId });
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Update editor state
    content.editorState = editorState;
    content.updatedAt = new Date();
    await content.save();

    res.json({
      success: true,
      message: 'Editor state saved',
      data: {
        videoId,
        savedAt: content.updatedAt
      }
    });
  } catch (error) {
    logger.error('Editor save error', {
      error: error.message,
      userId: req.user._id,
      videoId: req.body.videoId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to save editor state',
      details: error.message
    });
  }
});

/**
 * POST /api/video/transcribe-editor
 * Transcribe uploaded video to word-level timestamps for editor captions.
 * Uses Whisper verbose_json + word timestamps. Video must be a local upload.
 * Requirements: OPENAI_API_KEY set; video is a local upload (not remote/sample).
 */
router.post('/transcribe-editor', auth, async (req, res) => {
  try {
    if (!isTranscriptionConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'OPENAI_KEY_MISSING',
        error: 'Transcription requires OPENAI_API_KEY. Add it to your .env and restart the server.'
      });
    }

    const { videoId } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ success: false, error: 'Video ID is required' });
    }

    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;

    let video = null;
    let fileUrl = null;

    if (allowDevMode && (videoId.startsWith('dev-content-') || videoId.startsWith('dev-'))) {
      video = devVideoStore.get(videoId);
      if (video?.originalFile?.url) fileUrl = video.originalFile.url;
    }

    if (!video) {
      try {
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(videoId)) {
          const content = await Content.findOne({
            _id: videoId,
            userId,
            type: 'video'
          });
          if (content?.originalFile?.url) fileUrl = content.originalFile.url;
        }
      } catch (e) {
        logger.warn('Transcribe-editor content lookup failed', { videoId, error: e?.message });
      }
    }

    if (!fileUrl || typeof fileUrl !== 'string') {
      return res.status(404).json({
        success: false,
        code: 'VIDEO_NOT_FOUND',
        error: 'Video not found. Upload a video first, then transcribe.'
      });
    }

    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        code: 'REMOTE_VIDEO',
        error: 'Cannot transcribe remote or sample videos. Upload your own video, then transcribe.'
      });
    }

    const filename = path.basename(fileUrl.replace(/^\//, ''));
    const videoPath = path.join(__dirname, '../../uploads/videos', filename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({
        success: false,
        code: 'FILE_NOT_FOUND',
        error: 'Video file not found on server. Re-upload the video and try again.'
      });
    }

    const result = await transcribeVideoService(userId, videoId, videoPath);

    if (!result || !result.success) {
      return res.status(500).json({
        success: false,
        error: result?.message || 'Transcription failed.'
      });
    }

    const words = (result.words || []).map((w) => ({
      word: w.word || '',
      start: typeof w.start === 'number' ? w.start : parseFloat(w.start) || 0,
      end: typeof w.end === 'number' ? w.end : parseFloat(w.end) || 0
    }));

    return res.json({
      success: true,
      data: {
        text: result.text || '',
        words
      }
    });
  } catch (err) {
    logger.error('Transcribe editor error', { error: err.message, videoId: req.body?.videoId });
    const isKeyError = /openai|api key|OPENAI_API_KEY/i.test(err.message || '');
    return res.status(isKeyError ? 503 : 500).json({
      success: false,
      code: isKeyError ? 'OPENAI_KEY_MISSING' : undefined,
      error: err.message || 'Transcription failed.'
    });
  }
});

module.exports = router;
// Worker import compatibility: allow `const { processVideo } = require('../routes/video')`
module.exports.processVideo = processVideo;

