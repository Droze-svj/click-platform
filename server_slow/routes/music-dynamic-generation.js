// Dynamic Music Generation Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  generateMusicForExactLength,
  regenerateTrackSection,
  generateStructuredTrack,
  mergeSectionIntoTrack
} = require('../services/dynamicMusicGenerationService');
const router = express.Router();

/**
 * @route POST /api/music/dynamic/generate
 * @desc Generate music with exact video length
 * @access Private
 */
router.post('/dynamic/generate', auth, asyncHandler(async (req, res) => {
  const {
    videoDuration,
    params,
    provider = 'mubert',
    theme,
    key,
    structure = 'auto'
  } = req.body;

  if (!videoDuration || !params) {
    return sendError(res, 'videoDuration and params are required', 400);
  }

  try {
    const generation = await generateMusicForExactLength(
      videoDuration,
      params,
      req.user._id,
      {
        provider,
        theme,
        key,
        structure
      }
    );

    sendSuccess(res, 'Music generated for exact length', 200, generation);
  } catch (error) {
    logger.error('Error generating dynamic music', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate music', 500);
  }
}));

/**
 * @route POST /api/music/dynamic/regenerate-section
 * @desc Regenerate section of track while maintaining theme and key
 * @access Private
 */
router.post('/dynamic/regenerate-section', auth, asyncHandler(async (req, res) => {
  const {
    originalTrackId,
    section,
    provider = 'mubert',
    preserveTheme = true,
    preserveKey = true
  } = req.body;

  if (!originalTrackId || !section || !section.start || !section.end) {
    return sendError(res, 'originalTrackId and section (with start and end) are required', 400);
  }

  try {
    const result = await regenerateTrackSection(
      originalTrackId,
      section,
      req.user._id,
      {
        provider,
        preserveTheme,
        preserveKey
      }
    );

    sendSuccess(res, 'Section regenerated', 200, result);
  } catch (error) {
    logger.error('Error regenerating section', {
      error: error.message,
      originalTrackId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to regenerate section', 500);
  }
}));

/**
 * @route POST /api/music/dynamic/structured
 * @desc Generate structured track with sections
 * @access Private
 */
router.post('/dynamic/structured', auth, asyncHandler(async (req, res) => {
  const {
    videoDuration,
    params,
    structure = 'intro-verse-chorus-outro',
    provider = 'mubert'
  } = req.body;

  if (!videoDuration || !params) {
    return sendError(res, 'videoDuration and params are required', 400);
  }

  try {
    const generation = await generateStructuredTrack(
      videoDuration,
      params,
      req.user._id,
      structure,
      {
        provider
      }
    );

    sendSuccess(res, 'Structured track generated', 200, generation);
  } catch (error) {
    logger.error('Error generating structured track', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate structured track', 500);
  }
}));

/**
 * @route POST /api/music/dynamic/merge-section
 * @desc Get instructions for merging section into track
 * @access Private
 */
router.post('/dynamic/merge-section', auth, asyncHandler(async (req, res) => {
  const {
    originalTrackId,
    sectionGenerationId,
    section
  } = req.body;

  if (!originalTrackId || !sectionGenerationId || !section) {
    return sendError(res, 'originalTrackId, sectionGenerationId, and section are required', 400);
  }

  try {
    const mergeInstructions = await mergeSectionIntoTrack(
      originalTrackId,
      sectionGenerationId,
      section,
      req.user._id
    );

    sendSuccess(res, 'Merge instructions generated', 200, mergeInstructions);
  } catch (error) {
    logger.error('Error generating merge instructions', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate merge instructions', 500);
  }
}));

module.exports = router;







