const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { generateCaptions, detectHighlights } = require('../services/aiService');
const { generateTranscriptFromVideo } = require('../services/whisperService');
const { mixMusicWithVideo } = require('../services/audioService');
const { applyVideoEffect, addTextOverlay, addWatermark } = require('../services/videoEffects');
const { generateThumbnail } = require('../services/thumbnailService');
const { cleanupFailedContent } = require('../utils/fileCleanup');
const { emitToUser } = require('../services/socketService');
const { retry } = require('../utils/retry');
const { validateVideoFile, validateFileExists } = require('../middleware/fileValidator');
const Music = require('../models/Music');
const logger = require('../utils/logger');
const { requireActiveSubscription } = require('../middleware/subscriptionAccess');
const { uploadFile, deleteFile } = require('../services/storageService');
const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 1073741824 }, // 1GB default
  fileFilter: (req, file, cb) => {
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

// Upload video (with rate limiting)
router.post('/upload', auth, requireActiveSubscription, uploadLimiter, upload.single('video'), async (req, res) => {
  try {
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
    
    try {
      const uploadResult = await uploadFile(
        req.file.path,
        storageKey,
        req.file.mimetype,
        {
          userId: req.user._id.toString(),
          originalName: req.file.originalname,
        }
      );
      
      fileUrl = uploadResult.url;
      storageKey = uploadResult.key;
      storageType = uploadResult.storage || 'local';
      
      // Delete local file if uploaded to cloud storage
      if (uploadResult.storage === 's3' && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        logger.info('Local file deleted after cloud upload', { path: req.file.path });
      }
    } catch (uploadError) {
      logger.error('Cloud storage upload failed, using local file', { error: uploadError.message });
      // Continue with local file if cloud upload fails
    }

    const content = new Content({
      userId: req.user._id,
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

    await content.save();

    // Process video in background using job queue
    const { addVideoProcessingJob, JOB_PRIORITY } = require('../queues');
    const job = await addVideoProcessingJob({
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

    // Store music preference if provided
    if (req.body.musicId) {
      content.musicId = req.body.musicId;
      await content.save();
    }

    // Track action for workflow learning
    await trackAction(req.user._id, 'upload_video', {
      entityType: 'video',
      entityId: content._id,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });

    // Update engagement (streak, achievements, activity)
    const { updateStreak, checkAchievements, createActivity } = require('../services/engagementService');
    await updateStreak(req.user._id);
    const achievements = await checkAchievements(req.user._id, 'upload_video', {
      contentId: content._id
    });
    await createActivity(req.user._id, 'video_uploaded', {
      title: 'Video Uploaded! 🎥',
      description: `You uploaded "${req.file.originalname}"`,
      entityType: 'video',
      entityId: content._id
    });

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        contentId: content._id,
        status: 'processing'
      }
    });
  } catch (error) {
    logger.error('Video upload error', { error: error.message, userId: req.user._id });
    
    // Clean up file if upload failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup file', { error: cleanupError.message });
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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
      
      const clipFilename = `clip-${contentId}-${i}.mp4`;
      const clipPath = path.join(__dirname, '../../uploads/clips', clipFilename);
      
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
      const caption = await generateCaptions(highlight.text, user.niche);
      
      // Generate and optimize thumbnail
      const thumbnailFilename = `thumb-${clipFilename.replace('.mp4', '.jpg')}`;
      const thumbnailPath = path.join(__dirname, '../../uploads/thumbnails', thumbnailFilename);
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
          processedClipPath = effectPath;
        }
      }

      // Add text overlay
      if (textOverlay && textOverlay.text) {
        const textPath = processedClipPath.replace('.mp4', '-text.mp4');
        await addTextOverlay(processedClipPath, textPath, textOverlay);
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
        processedClipPath = watermarkOutputPath;
      }

      clips.push({
        url: `/uploads/clips/${path.basename(processedClipPath)}`,
        thumbnail: `/uploads/thumbnails/${thumbnailFilename}`,
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


// Get video processing status
router.get('/:contentId/status', auth, async (req, res) => {
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
  } catch (error) {
    logger.error('Get video status error', { error: error.message, contentId: req.params.contentId });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get all user videos
router.get('/', auth, async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const query = { userId: req.user._id, type: 'video' };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Optimize query with select and lean
    const { optimizeQuery } = require('../utils/queryOptimizer');
    
    const [contents, total] = await Promise.all([
      optimizeQuery(Content.find(query), {
        select: 'title description status originalFile generatedContent createdAt',
        lean: true,
        sort: { createdAt: -1 },
        skip,
        limit: parseInt(limit)
      }),
      Content.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: contents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get videos error', { error: error.message, userId: req.user._id });
    res.status(500).json({ 
      success: false,
      error: error.message 
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

module.exports = router;

