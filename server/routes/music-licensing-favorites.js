// Music Favorites and Playlists Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const MusicFavorite = require('../models/MusicFavorite');
const MusicPlaylist = require('../models/MusicPlaylist');
const MusicLicense = require('../models/MusicLicense');
const router = express.Router();

/**
 * @route POST /api/music-licensing/favorites
 * @desc Add track to favorites
 * @access Private
 */
router.post('/favorites', auth, asyncHandler(async (req, res) => {
  const { licenseId, notes, tags } = req.body;

  if (!licenseId) {
    return sendError(res, 'licenseId is required', 400);
  }

  try {
    // Check if track exists
    const track = await MusicLicense.findById(licenseId);
    if (!track) {
      return sendError(res, 'Track not found', 404);
    }

    // Check if already favorited
    const existing = await MusicFavorite.findOne({
      userId: req.user._id,
      licenseId
    });

    if (existing) {
      return sendError(res, 'Track already in favorites', 400);
    }

    const favorite = new MusicFavorite({
      userId: req.user._id,
      licenseId,
      notes,
      tags: tags || []
    });

    await favorite.save();

    sendSuccess(res, 'Track added to favorites', 200, { favorite });
  } catch (error) {
    logger.error('Error adding favorite', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to add favorite', 500);
  }
}));

/**
 * @route GET /api/music-licensing/favorites
 * @desc Get user favorites
 * @access Private
 */
router.get('/favorites', auth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  try {
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      MusicFavorite.find({ userId: req.user._id })
        .populate('licenseId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MusicFavorite.countDocuments({ userId: req.user._id })
    ]);

    sendSuccess(res, 'Favorites retrieved', 200, {
      favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting favorites', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to get favorites', 500);
  }
}));

/**
 * @route DELETE /api/music-licensing/favorites/:favoriteId
 * @desc Remove favorite
 * @access Private
 */
router.delete('/favorites/:favoriteId', auth, asyncHandler(async (req, res) => {
  const { favoriteId } = req.params;

  try {
    const favorite = await MusicFavorite.findOneAndDelete({
      _id: favoriteId,
      userId: req.user._id
    });

    if (!favorite) {
      return sendError(res, 'Favorite not found', 404);
    }

    sendSuccess(res, 'Favorite removed', 200);
  } catch (error) {
    logger.error('Error removing favorite', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to remove favorite', 500);
  }
}));

/**
 * @route POST /api/music-licensing/playlists
 * @desc Create playlist
 * @access Private
 */
router.post('/playlists', auth, asyncHandler(async (req, res) => {
  const { name, description, tracks, isPublic, tags } = req.body;

  if (!name) {
    return sendError(res, 'Playlist name is required', 400);
  }

  try {
    const playlist = new MusicPlaylist({
      userId: req.user._id,
      name,
      description,
      tracks: (tracks || []).map((licenseId, index) => ({
        licenseId,
        order: index
      })),
      isPublic: isPublic || false,
      tags: tags || []
    });

    await playlist.save();

    sendSuccess(res, 'Playlist created', 200, { playlist });
  } catch (error) {
    logger.error('Error creating playlist', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to create playlist', 500);
  }
}));

/**
 * @route GET /api/music-licensing/playlists
 * @desc Get user playlists
 * @access Private
 */
router.get('/playlists', auth, asyncHandler(async (req, res) => {
  try {
    const playlists = await MusicPlaylist.find({
      $or: [
        { userId: req.user._id },
        { isPublic: true }
      ]
    })
      .populate('tracks.licenseId')
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, 'Playlists retrieved', 200, { playlists });
  } catch (error) {
    logger.error('Error getting playlists', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to get playlists', 500);
  }
}));

/**
 * @route PUT /api/music-licensing/playlists/:playlistId
 * @desc Update playlist
 * @access Private
 */
router.put('/playlists/:playlistId', auth, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description, tracks, isPublic, tags } = req.body;

  try {
    const playlist = await MusicPlaylist.findOne({
      _id: playlistId,
      userId: req.user._id
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (tracks) {
      playlist.tracks = tracks.map((licenseId, index) => ({
        licenseId,
        order: index
      }));
    }
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    if (tags) playlist.tags = tags;

    await playlist.save();

    sendSuccess(res, 'Playlist updated', 200, { playlist });
  } catch (error) {
    logger.error('Error updating playlist', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to update playlist', 500);
  }
}));

module.exports = router;







