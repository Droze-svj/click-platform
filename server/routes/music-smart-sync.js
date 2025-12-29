// Smart Music Sync Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  syncBeatsToScenes,
  syncVolumeToDialogue
} = require('../services/musicBeatSyncService');
const { createMoodTransitions } = require('../services/musicMoodTransitionService');
const router = express.Router();

/**
 * @route POST /api/music/sync/beats
 * @desc Sync music beats to scene boundaries and key moments
 * @access Private
 */
router.post('/sync/beats', auth, asyncHandler(async (req, res) => {
  const {
    trackId,
    contentId,
    syncToCuts = true,
    syncToKeyMoments = true,
    beatOffset = 0,
    snapTolerance = 0.1
  } = req.body;

  if (!trackId || !contentId) {
    return sendError(res, 'trackId and contentId are required', 400);
  }

  try {
    const result = await syncBeatsToScenes(
      trackId,
      contentId,
      req.user._id,
      {
        syncToCuts,
        syncToKeyMoments,
        beatOffset,
        snapTolerance
      }
    );

    sendSuccess(res, 'Beats synced to scenes', 200, result);
  } catch (error) {
    logger.error('Error syncing beats', {
      error: error.message,
      trackId,
      contentId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to sync beats', 500);
  }
}));

/**
 * @route POST /api/music/sync/dialogue
 * @desc Sync volume to dialogue rhythm
 * @access Private
 */
router.post('/sync/dialogue', auth, asyncHandler(async (req, res) => {
  const {
    trackId,
    contentId,
    duckAmount = -18,
    attackTime = 0.1,
    releaseTime = 0.3
  } = req.body;

  if (!trackId || !contentId) {
    return sendError(res, 'trackId and contentId are required', 400);
  }

  try {
    const result = await syncVolumeToDialogue(
      trackId,
      contentId,
      req.user._id,
      {
        duckAmount,
        attackTime,
        releaseTime
      }
    );

    sendSuccess(res, 'Volume synced to dialogue', 200, result);
  } catch (error) {
    logger.error('Error syncing volume to dialogue', {
      error: error.message,
      trackId,
      contentId
    });
    sendError(res, error.message || 'Failed to sync volume', 500);
  }
}));

/**
 * @route POST /api/music/transitions/mood
 * @desc Create mood transitions throughout video
 * @access Private
 */
router.post('/transitions/mood', auth, asyncHandler(async (req, res) => {
  const {
    trackId,
    contentId,
    transitionSmoothness = 0.5,
    preserveTheme = true
  } = req.body;

  if (!trackId || !contentId) {
    return sendError(res, 'trackId and contentId are required', 400);
  }

  try {
    const result = await createMoodTransitions(
      contentId,
      req.user._id,
      {
        trackId,
        transitionSmoothness,
        preserveTheme
      }
    );

    sendSuccess(res, 'Mood transitions created', 200, result);
  } catch (error) {
    logger.error('Error creating mood transitions', {
      error: error.message,
      contentId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to create mood transitions', 500);
  }
}));

module.exports = router;







