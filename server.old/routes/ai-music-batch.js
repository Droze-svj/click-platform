// AI Music Batch Generation Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { generateMusicTrack } = require('../services/aiMusicGenerationService');
const { queueGeneration } = require('../services/aiMusicGenerationQueue');
const MusicGeneration = require('../models/MusicGeneration');
const router = express.Router();

/**
 * @route POST /api/ai-music/batch/generate
 * @desc Generate multiple tracks in batch
 * @access Private
 */
router.post('/batch/generate', auth, asyncHandler(async (req, res) => {
  const {
    requests, // Array of { provider, params, priority }
    maxConcurrent = 3
  } = req.body;

  if (!requests || !Array.isArray(requests) || requests.length === 0) {
    return sendError(res, 'requests array is required', 400);
  }

  if (requests.length > 10) {
    return sendError(res, 'Maximum 10 tracks per batch', 400);
  }

  try {
    const generations = [];
    const errors = [];

    // Process requests (with concurrency limit)
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);

      const batchResults = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            const generation = await generateMusicTrack(
              request.provider || 'mubert',
              request.params || {},
              req.user._id
            );

            // Queue for status checking
            await queueGeneration(generation.generationId, request.provider || 'mubert', request.priority || 0);

            return {
              requestIndex: requests.indexOf(request),
              generation
            };
          } catch (error) {
            return {
              requestIndex: requests.indexOf(request),
              error: error.message
            };
          }
        })
      );

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            errors.push(result.value);
          } else {
            generations.push(result.value);
          }
        } else {
          errors.push({
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    sendSuccess(res, 'Batch generation started', 200, {
      total: requests.length,
      started: generations.length,
      failed: errors.length,
      generations: generations.map(g => g.generation),
      errors
    });
  } catch (error) {
    logger.error('Error in batch generation', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to start batch generation', 500);
  }
}));

/**
 * @route POST /api/ai-music/batch/scenes
 * @desc Generate music for multiple scenes
 * @access Private
 */
router.post('/batch/scenes', auth, asyncHandler(async (req, res) => {
  const {
    sceneIds,
    provider,
    useRecommendations = true
  } = req.body;

  if (!sceneIds || !Array.isArray(sceneIds)) {
    return sendError(res, 'sceneIds array is required', 400);
  }

  try {
    const { recommendMusicForScenes } = require('../services/aiMusicRecommendationService');

    // Get recommendations for scenes
    const recommendations = useRecommendations
      ? await recommendMusicForScenes(sceneIds, req.user._id)
      : sceneIds.map(() => ({ recommendations: { mood: 'energetic', genre: 'electronic', duration: 60 } }));

    // Generate tracks
    const generations = [];
    for (const rec of recommendations) {
      try {
        const generation = await generateMusicTrack(
          provider || rec.recommendations.provider || 'mubert',
          rec.recommendations,
          req.user._id
        );

        generations.push({
          sceneId: rec.sceneId,
          generation
        });
      } catch (error) {
        logger.warn('Failed to generate for scene', {
          sceneId: rec.sceneId,
          error: error.message
        });
      }
    }

    sendSuccess(res, 'Scene batch generation started', 200, {
      total: sceneIds.length,
      started: generations.length,
      generations
    });
  } catch (error) {
    logger.error('Error in scene batch generation', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to start scene batch generation', 500);
  }
}));

/**
 * @route GET /api/ai-music/batch/status
 * @desc Get status of batch generations
 * @access Private
 */
router.get('/batch/status', auth, asyncHandler(async (req, res) => {
  const { generationIds } = req.query;

  if (!generationIds) {
    return sendError(res, 'generationIds query parameter is required', 400);
  }

  const ids = Array.isArray(generationIds) ? generationIds : generationIds.split(',');

  try {
    const generations = await MusicGeneration.find({
      _id: { $in: ids },
      userId: req.user._id
    }).lean();

    const status = {
      total: ids.length,
      processing: generations.filter(g => g.status === 'processing').length,
      completed: generations.filter(g => g.status === 'completed').length,
      failed: generations.filter(g => g.status === 'failed').length,
      generations: generations.map(g => ({
        id: g._id,
        status: g.status,
        progress: g.progress,
        provider: g.provider
      }))
    };

    sendSuccess(res, 'Batch status retrieved', 200, status);
  } catch (error) {
    logger.error('Error getting batch status', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get batch status', 500);
  }
}));

module.exports = router;

