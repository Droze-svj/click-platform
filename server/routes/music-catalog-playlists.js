// Music Catalog Playlists Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const MusicCatalogPlaylist = require('../models/MusicCatalogPlaylist');
const router = express.Router();

/**
 * @route POST /api/music-catalog/playlists
 * @desc Create playlist
 * @access Private
 */
router.post('/playlists', auth, asyncHandler(async (req, res) => {
  const { name, description, tracks = [], isPublic = false, tags = [] } = req.body;

  if (!name) {
    return sendError(res, 'Playlist name is required', 400);
  }

  try {
    const playlist = new MusicCatalogPlaylist({
      userId: req.user._id,
      name,
      description,
      tracks: tracks.map((track, index) => ({
        trackId: track.trackId || track.id,
        source: track.source,
        position: index
      })),
      isPublic,
      tags
    });

    await playlist.save();

    sendSuccess(res, 'Playlist created', 200, { playlist });
  } catch (error) {
    logger.error('Error creating playlist', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to create playlist', 500);
  }
}));

/**
 * @route GET /api/music-catalog/playlists
 * @desc Get user playlists
 * @access Private
 */
router.get('/playlists', auth, asyncHandler(async (req, res) => {
  const { includePublic = false } = req.query;

  try {
    const query = includePublic === 'true'
      ? { $or: [{ userId: req.user._id }, { isPublic: true }] }
      : { userId: req.user._id };

    const playlists = await MusicCatalogPlaylist.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    sendSuccess(res, 'Playlists retrieved', 200, { playlists });
  } catch (error) {
    logger.error('Error getting playlists', { error: error.message });
    sendError(res, error.message || 'Failed to get playlists', 500);
  }
}));

/**
 * @route GET /api/music-catalog/playlists/:playlistId
 * @desc Get playlist details
 * @access Private
 */
router.get('/playlists/:playlistId', auth, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  try {
    const playlist = await MusicCatalogPlaylist.findOne({
      _id: playlistId,
      $or: [
        { userId: req.user._id },
        { isPublic: true }
      ]
    }).lean();

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    sendSuccess(res, 'Playlist retrieved', 200, { playlist });
  } catch (error) {
    logger.error('Error getting playlist', { error: error.message, playlistId });
    sendError(res, error.message || 'Failed to get playlist', 500);
  }
}));

/**
 * @route PUT /api/music-catalog/playlists/:playlistId
 * @desc Update playlist
 * @access Private
 */
router.put('/playlists/:playlistId', auth, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description, tracks, isPublic, tags } = req.body;

  try {
    const playlist = await MusicCatalogPlaylist.findOne({
      _id: playlistId,
      userId: req.user._id
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (tracks !== undefined) {
      playlist.tracks = tracks.map((track, index) => ({
        trackId: track.trackId || track.id,
        source: track.source,
        position: index
      }));
    }
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    if (tags !== undefined) playlist.tags = tags;

    await playlist.save();

    sendSuccess(res, 'Playlist updated', 200, { playlist });
  } catch (error) {
    logger.error('Error updating playlist', { error: error.message, playlistId });
    sendError(res, error.message || 'Failed to update playlist', 500);
  }
}));

/**
 * @route DELETE /api/music-catalog/playlists/:playlistId
 * @desc Delete playlist
 * @access Private
 */
router.delete('/playlists/:playlistId', auth, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  try {
    const playlist = await MusicCatalogPlaylist.findOne({
      _id: playlistId,
      userId: req.user._id
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    await playlist.deleteOne();

    sendSuccess(res, 'Playlist deleted', 200);
  } catch (error) {
    logger.error('Error deleting playlist', { error: error.message, playlistId });
    sendError(res, error.message || 'Failed to delete playlist', 500);
  }
}));

/**
 * @route POST /api/music-catalog/playlists/:playlistId/tracks
 * @desc Add tracks to playlist
 * @access Private
 */
router.post('/playlists/:playlistId/tracks', auth, asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { tracks } = req.body;

  if (!tracks || !Array.isArray(tracks)) {
    return sendError(res, 'tracks array is required', 400);
  }

  try {
    const playlist = await MusicCatalogPlaylist.findOne({
      _id: playlistId,
      userId: req.user._id
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    const newTracks = tracks.map((track, index) => ({
      trackId: track.trackId || track.id,
      source: track.source,
      position: playlist.tracks.length + index
    }));

    playlist.tracks.push(...newTracks);
    await playlist.save();

    sendSuccess(res, 'Tracks added to playlist', 200, { playlist });
  } catch (error) {
    logger.error('Error adding tracks to playlist', { error: error.message, playlistId });
    sendError(res, error.message || 'Failed to add tracks', 500);
  }
}));

/**
 * @route DELETE /api/music-catalog/playlists/:playlistId/tracks/:trackId
 * @desc Remove track from playlist
 * @access Private
 */
router.delete('/playlists/:playlistId/tracks/:trackId', auth, asyncHandler(async (req, res) => {
  const { playlistId, trackId } = req.params;

  try {
    const playlist = await MusicCatalogPlaylist.findOne({
      _id: playlistId,
      userId: req.user._id
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    playlist.tracks = playlist.tracks.filter(t => t.trackId !== trackId);
    // Reorder positions
    playlist.tracks.forEach((track, index) => {
      track.position = index;
    });

    await playlist.save();

    sendSuccess(res, 'Track removed from playlist', 200, { playlist });
  } catch (error) {
    logger.error('Error removing track from playlist', { error: error.message, playlistId, trackId });
    sendError(res, error.message || 'Failed to remove track', 500);
  }
}));

module.exports = router;







