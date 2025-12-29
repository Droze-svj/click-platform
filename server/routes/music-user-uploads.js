// User Music Upload Routes
// Separate area for user-uploaded tracks with license attestation

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const Music = require('../models/Music');
const multer = require('multer');
const { uploadFile, getSignedUrlForFile } = require('../services/storageService');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

/**
 * @route POST /api/music/user-uploads
 * @desc Upload user's own music track
 * @access Private
 */
router.post('/user-uploads', auth, upload.single('audio'), asyncHandler(async (req, res) => {
  const {
    title,
    artist,
    genre,
    mood,
    tags,
    licenseAttestation,
    requiresAttribution,
    attributionText
  } = req.body;

  if (!title) {
    return sendError(res, 'title is required', 400);
  }

  if (!req.file) {
    return sendError(res, 'audio file is required', 400);
  }

  // License attestation is required for user uploads
  if (licenseAttestation !== 'true' && licenseAttestation !== true) {
    return sendError(res, 'You must attest that you own/hold rights to use this track', 400);
  }

  try {
    // Upload file to storage
    const fileStream = fs.createReadStream(req.file.path);
    const uploadedFile = await uploadFile(fileStream, {
      folder: 'user-music',
      filename: `${req.user._id}_${Date.now()}${path.extname(req.file.originalname)}`,
      contentType: req.file.mimetype
    });

    // Get file metadata (duration, etc.)
    // This would typically use ffprobe or similar
    const fileDuration = await getAudioDuration(req.file.path);

    // Create music record
    const music = new Music({
      userId: req.user._id,
      workspaceId: req.user.workspaceId,
      title,
      artist: artist || null,
      genre: genre || 'other',
      mood: mood || 'energetic',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [],
      file: {
        url: uploadedFile.url,
        filename: uploadedFile.filename,
        size: req.file.size,
        duration: fileDuration
      },
      license: 'user-uploaded',
      provider: 'internal',
      licenseAttestation: true,
      attestationDate: new Date(),
      requiresAttribution: requiresAttribution === 'true' || requiresAttribution === true,
      attributionText: attributionText || null,
      isPublic: false // Always private for user uploads
    });

    await music.save();

    // Cleanup temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    sendSuccess(res, 'Music uploaded successfully', 200, { music });
  } catch (error) {
    // Cleanup temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    logger.error('Error uploading user music', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to upload music', 500);
  }
}));

/**
 * @route GET /api/music/user-uploads
 * @desc Get user's uploaded music (private library)
 * @access Private
 */
router.get('/user-uploads', auth, asyncHandler(async (req, res) => {
  const {
    genre,
    mood,
    search,
    page = 1,
    limit = 50
  } = req.query;

  try {
    const query = {
      userId: req.user._id,
      provider: 'internal',
      license: 'user-uploaded'
    };

    if (genre && genre !== 'all') query.genre = genre;
    if (mood && mood !== 'all') query.mood = mood;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const tracks = await Music.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(parseInt(limit))
      .lean();

    const total = await Music.countDocuments(query);

    sendSuccess(res, 'User music retrieved', 200, {
      tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error getting user music', { error: error.message });
    sendError(res, error.message || 'Failed to get user music', 500);
  }
}));

/**
 * @route PUT /api/music/user-uploads/:trackId
 * @desc Update user's uploaded track
 * @access Private
 */
router.put('/user-uploads/:trackId', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  const {
    title,
    artist,
    genre,
    mood,
    tags,
    requiresAttribution,
    attributionText
  } = req.body;

  try {
    const music = await Music.findOne({
      _id: trackId,
      userId: req.user._id,
      provider: 'internal'
    });

    if (!music) {
      return sendError(res, 'Track not found or unauthorized', 404);
    }

    // Update allowed fields
    if (title) music.title = title;
    if (artist !== undefined) music.artist = artist;
    if (genre) music.genre = genre;
    if (mood) music.mood = mood;
    if (tags !== undefined) {
      music.tags = Array.isArray(tags) ? tags : tags.split(',');
    }
    if (requiresAttribution !== undefined) {
      music.requiresAttribution = requiresAttribution === 'true' || requiresAttribution === true;
    }
    if (attributionText !== undefined) music.attributionText = attributionText;

    await music.save();

    sendSuccess(res, 'Track updated', 200, { music });
  } catch (error) {
    logger.error('Error updating user music', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to update track', 500);
  }
}));

/**
 * @route DELETE /api/music/user-uploads/:trackId
 * @desc Delete user's uploaded track
 * @access Private
 */
router.delete('/user-uploads/:trackId', auth, asyncHandler(async (req, res) => {
  const { trackId } = req.params;

  try {
    const music = await Music.findOne({
      _id: trackId,
      userId: req.user._id,
      provider: 'internal'
    });

    if (!music) {
      return sendError(res, 'Track not found or unauthorized', 404);
    }

    await music.deleteOne();

    sendSuccess(res, 'Track deleted', 200);
  } catch (error) {
    logger.error('Error deleting user music', { error: error.message, trackId });
    sendError(res, error.message || 'Failed to delete track', 500);
  }
}));

/**
 * Get audio duration helper
 */
async function getAudioDuration(audioPath) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`;
    const { stdout } = await execAsync(command);
    return parseFloat(stdout.trim()) || null;
  } catch (error) {
    logger.warn('Error getting audio duration', { error: error.message });
    return null;
  }
}

module.exports = router;







