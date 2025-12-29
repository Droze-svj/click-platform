// File upload progress tracking routes

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

// Store upload progress in memory (in production, use Redis)
const uploadProgress = new Map();

/**
 * Initialize upload progress tracking
 */
function initUploadProgress(uploadId) {
  uploadProgress.set(uploadId, {
    uploadId,
    progress: 0,
    status: 'uploading',
    bytesUploaded: 0,
    totalBytes: 0,
    startTime: Date.now(),
    estimatedTimeRemaining: null,
  });
}

/**
 * Update upload progress
 */
function updateUploadProgress(uploadId, bytesUploaded, totalBytes) {
  const progress = uploadProgress.get(uploadId);
  if (progress) {
    progress.bytesUploaded = bytesUploaded;
    progress.totalBytes = totalBytes;
    progress.progress = totalBytes > 0 ? Math.round((bytesUploaded / totalBytes) * 100) : 0;

    // Calculate estimated time remaining
    const elapsed = Date.now() - progress.startTime;
    if (progress.progress > 0) {
      const totalEstimated = elapsed / (progress.progress / 100);
      progress.estimatedTimeRemaining = Math.max(0, totalEstimated - elapsed);
    }
  }
}

/**
 * Complete upload progress
 */
function completeUploadProgress(uploadId) {
  const progress = uploadProgress.get(uploadId);
  if (progress) {
    progress.status = 'completed';
    progress.progress = 100;
    progress.completedAt = Date.now();
  }
}

/**
 * Fail upload progress
 */
function failUploadProgress(uploadId, error) {
  const progress = uploadProgress.get(uploadId);
  if (progress) {
    progress.status = 'failed';
    progress.error = error.message;
    progress.failedAt = Date.now();
  }
}

/**
 * Get upload progress
 */
function getUploadProgress(uploadId) {
  return uploadProgress.get(uploadId) || null;
}

/**
 * Clean up old progress entries (older than 1 hour)
 */
function cleanupProgress() {
  const oneHourAgo = Date.now() - 3600000;
  for (const [uploadId, progress] of uploadProgress.entries()) {
    if (progress.completedAt && progress.completedAt < oneHourAgo) {
      uploadProgress.delete(uploadId);
    }
    if (progress.failedAt && progress.failedAt < oneHourAgo) {
      uploadProgress.delete(uploadId);
    }
  }
}

// Cleanup every 30 minutes
setInterval(cleanupProgress, 30 * 60 * 1000);

/**
 * @swagger
 * /api/upload/progress/:uploadId:
 *   get:
 *     summary: Get upload progress
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.get('/progress/:uploadId', auth, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;

  try {
    const progress = getUploadProgress(uploadId);
    if (!progress) {
      return sendError(res, 'Upload progress not found', 404);
    }

    sendSuccess(res, 'Upload progress fetched', 200, progress);
  } catch (error) {
    logger.error('Get upload progress error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

module.exports = {
  router,
  initUploadProgress,
  updateUploadProgress,
  completeUploadProgress,
  failUploadProgress,
  getUploadProgress,
};






