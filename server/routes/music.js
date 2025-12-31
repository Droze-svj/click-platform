// Music library routes

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Music = require('../models/Music');
const auth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/enhancedRateLimiter');
const { validateFileExists } = require('../middleware/fileValidator');
const logger = require('../utils/logger');
const { uploadFile } = require('../services/storageService');
const router = express.Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/music');
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for audio
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|aac|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /audio/.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (mp3, wav, m4a, aac, ogg)'));
    }
  }
});

/**
 * @swagger
 * /api/music:
 *   get:
 *     summary: Get music library
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
  try {
    const { genre, mood, search, limit = 50 } = req.query;
    const query = {
      $or: [
        { userId: req.user._id },
        { isPublic: true }
      ]
    };

    if (genre) query.genre = genre;
    if (mood) query.mood = mood;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const music = await Music.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: music
    });
  } catch (error) {
    logger.error('Get music error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/music/upload:
 *   post:
 *     summary: Upload music file
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 */
router.post('/upload', auth, uploadLimiter, upload.single('music'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      });
    }

    const { title, artist, genre, mood, tags, isPublic } = req.body;

    // Get audio duration (simplified - in production use ffprobe)
    const duration = 0; // Will be calculated in background

    // Upload to cloud storage (S3) or keep local
    let fileUrl = `/uploads/music/${req.file.filename}`;
    let storageKey = `music/${req.file.filename}`;
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

    const music = new Music({
      userId: req.user._id,
      title: title || req.file.originalname,
      artist: artist || 'Unknown',
      genre: genre || 'other',
      mood: mood || 'energetic',
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      file: {
        url: fileUrl,
        filename: req.file.filename,
        size: req.file.size,
        storageKey: storageKey,
        storage: storageType
      },
      isPublic: isPublic === 'true',
      license: 'user-uploaded'
    });

    await music.save();

    // Calculate duration in background
    calculateAudioDuration(music._id, req.file.path).catch(err => {
      logger.error('Audio duration calculation error', { error: err.message });
    });

    logger.info('Music uploaded', { musicId: music._id, userId: req.user._id });

    res.json({
      success: true,
      message: 'Music uploaded successfully',
      data: music
    });
  } catch (error) {
    logger.error('Music upload error', { error: error.message });
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/music/{musicId}:
 *   delete:
 *     summary: Delete music
 *     tags: [Music]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:musicId', auth, async (req, res) => {
  try {
    const music = await Music.findOne({
      _id: req.params.musicId,
      userId: req.user._id
    });

    if (!music) {
      return res.status(404).json({
        success: false,
        error: 'Music not found'
      });
    }

    // Delete file
    if (music.file.url) {
      const filePath = path.join(__dirname, '../../', music.file.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await music.deleteOne();

    logger.info('Music deleted', { musicId: req.params.musicId });

    res.json({
      success: true,
      message: 'Music deleted successfully'
    });
  } catch (error) {
    logger.error('Delete music error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to calculate audio duration
async function calculateAudioDuration(musicId, audioPath) {
  const ffmpeg = require('fluent-ffmpeg');
  
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration;
      
      Music.findByIdAndUpdate(musicId, {
        'file.duration': duration
      }).then(() => {
        logger.info('Audio duration calculated', { musicId, duration });
        resolve(duration);
      }).catch(reject);
    });
  });
}

module.exports = router;


