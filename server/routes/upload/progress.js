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
// NOTE: uploadProgressService is not currently populated by any caller (no
// initializeUpload call site), so these routes return nothing today. The owner
// guards below are forward-protection: when the service IS wired up,
// initializeUpload MUST store `userId` in the record so a user can only read/
// cancel their OWN upload (these routes are keyed only by uploadId otherwise).
function ownsUpload(progress, req) {
  const reqId = String(req.user?._id || req.user?.id || '');
  return !progress?.userId || String(progress.userId) === reqId;
}

router.get('/:uploadId', authenticate, async (req, res) => {
  try {
    const { uploadId } = req.params;

    const progress = await uploadProgressService.getProgress(uploadId);
    if (!ownsUpload(progress, req)) return sendError(res, 'Upload not found', 404);

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

    // Don't let one user cancel another's upload.
    const progress = await uploadProgressService.getProgress(uploadId);
    if (!ownsUpload(progress, req)) return sendError(res, 'Upload not found', 404);

    await uploadProgressService.cancelUpload(uploadId);

    return sendSuccess(res, null, 'Upload cancelled');
  } catch (error) {
    logger.error('Error cancelling upload', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
