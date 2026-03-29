const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const digitalTwinService = require('../services/digitalTwinService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/digital-twin/generate
 * @desc    Generate a digital twin video from a voice note
 * @access  Private
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { voiceNoteUrl, options } = req.body;
    const userId = req.user.id || req.user._id;

    if (!voiceNoteUrl) {
      return res.status(400).json({ error: 'voiceNoteUrl is required' });
    }

    const job = await digitalTwinService.createAvatarVideo(userId, voiceNoteUrl, options);
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Digital Twin generation failed', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to initiate digital twin generation' });
  }
});

/**
 * @route   GET /api/digital-twin/status/:jobId
 * @desc    Get the status of a digital twin generation job
 * @access  Private
 */
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await digitalTwinService.getGenerationStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Failed to get digital twin status', { error: error.message, jobId: req.params.jobId });
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

module.exports = router;
