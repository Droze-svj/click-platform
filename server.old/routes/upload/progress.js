// Upload Progress Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { sendSuccess, sendError } = require('../../utils/response');
const uploadProgressService = require('../../services/uploadProgressService');
const logger = require('../../utils/logger');

/**
 * GET /api/upload/progress/:uploadId
 * Get upload progress
 */
router.get('/:uploadId', authenticate, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const progress = await uploadProgressService.getProgress(uploadId);

    return sendSuccess(res, progress);
  } catch (error) {
    logger.error('Error getting upload progress', { error: error.message });
    return sendError(res, error.message, 404);
  }
});

/**
 * POST /api/upload/progress/:uploadId/cancel
 * Cancel upload
 */
router.post('/:uploadId/cancel', authenticate, async (req, res) => {
  try {
    const { uploadId } = req.params;

    await uploadProgressService.cancelUpload(uploadId);

    return sendSuccess(res, null, 'Upload cancelled');
  } catch (error) {
    logger.error('Error cancelling upload', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
