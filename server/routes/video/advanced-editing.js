// Advanced Video Editing Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const advancedVideoEditingService = require('../../services/advancedVideoEditingService');
const Content = require('../../models/Content');
const { addVideoProcessingJob } = require('../../queues');
const logger = require('../../utils/logger');

/**
 * POST /api/video/advanced-editing/auto-cut
 * Auto-cut video (remove silence and filler words)
 */
router.post('/auto-cut', authenticate, async (req, res) => {
  try {
    const { contentId, options = {} } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    // Get content
    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    if (!content.originalFile?.url) {
      return sendError(res, 'Video file not found', 404);
    }

    // Add to job queue for processing
    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'auto-cut',
        inputPath: content.originalFile.url,
        options: {
          removeSilence: options.removeSilence !== false,
          removeFillerWords: options.removeFillerWords || false,
          transcript: content.transcript || null,
          ...options,
        },
      },
      {
        priority: 5, // High priority
        attempts: 2,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Auto-cut job queued',
    }, 'Auto-cut processing started');
  } catch (error) {
    logger.error('Error starting auto-cut', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/advanced-editing/smart-transitions
 * Add smart transitions between scenes
 */
router.post('/smart-transitions', authenticate, async (req, res) => {
  try {
    const { contentId, options = {} } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'smart-transitions',
        inputPath: content.originalFile.url,
        options,
      },
      {
        priority: 5,
        attempts: 2,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Smart transitions job queued',
    }, 'Smart transitions processing started');
  } catch (error) {
    logger.error('Error starting smart transitions', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/advanced-editing/color-correct
 * Auto-color correct video
 */
router.post('/color-correct', authenticate, async (req, res) => {
  try {
    const { contentId, options = {} } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'color-correct',
        inputPath: content.originalFile.url,
        options,
      },
      {
        priority: 5,
        attempts: 2,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Color correction job queued',
    }, 'Color correction processing started');
  } catch (error) {
    logger.error('Error starting color correction', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/advanced-editing/auto-frame
 * Auto-frame video based on face detection
 */
router.post('/auto-frame', authenticate, async (req, res) => {
  try {
    const { contentId } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'auto-frame',
        inputPath: content.originalFile.url,
      },
      {
        priority: 5,
        attempts: 2,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Auto-framing job queued',
    }, 'Auto-framing processing started');
  } catch (error) {
    logger.error('Error starting auto-framing', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/advanced-editing/stabilize
 * Stabilize video (reduce shake)
 */
router.post('/stabilize', authenticate, async (req, res) => {
  try {
    const { contentId, options = {} } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'stabilize',
        inputPath: content.originalFile.url,
        options,
      },
      {
        priority: 5,
        attempts: 2,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Stabilization job queued',
    }, 'Stabilization processing started');
  } catch (error) {
    logger.error('Error starting stabilization', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/video/advanced-editing/apply-all
 * Apply all advanced edits
 */
router.post('/apply-all', authenticate, async (req, res) => {
  try {
    const { contentId, options = {} } = req.body;
    const userId = req.user.id;

    if (!contentId) {
      return sendError(res, 'Content ID is required', 400);
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    const job = await addVideoProcessingJob(
      {
        contentId,
        userId,
        action: 'apply-all',
        inputPath: content.originalFile.url,
        options: {
          autoCut: options.autoCut !== false,
          smartTransitions: options.smartTransitions || false,
          colorCorrection: options.colorCorrection || false,
          autoFrame: options.autoFrame || false,
          stabilize: options.stabilize || false,
          transcript: content.transcript || null,
          ...options,
        },
      },
      {
        priority: 10, // Critical priority
        attempts: 3,
      }
    );

    return sendSuccess(res, {
      jobId: job.id,
      message: 'Advanced editing job queued',
      options: options,
    }, 'Advanced editing processing started');
  } catch (error) {
    logger.error('Error starting advanced editing', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * GET /api/video/advanced-editing/scenes/:contentId
 * Detect scenes in video
 */
router.get('/scenes/:contentId', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.id;

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      return sendError(res, 'Content not found', 404);
    }

    if (!content.originalFile?.url) {
      return sendError(res, 'Video file not found', 404);
    }

    const scenes = await advancedVideoEditingService.detectScenes(
      content.originalFile.url
    );

    return sendSuccess(res, { scenes, count: scenes.length });
  } catch (error) {
    logger.error('Error detecting scenes', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
