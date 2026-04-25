// Upload Progress Service - Real-time upload progress tracking via WebSocket

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { get, set, del } = require('./cacheService');

// Get Socket.io instance
let io = null;
function getSocketIO() {
  if (!io) {
    try {
      const socketService = require('./socketService');
      io = socketService.getIO();
    } catch (error) {
      // Socket.io not initialized yet, will be available later
    }
  }
  return io;
}

// Store upload progress in memory (fallback to Redis if available)
const uploadProgress = new Map();

/**
 * Initialize upload progress tracking
 * @param {string} uploadId - Unique upload ID
 * @param {Object} metadata - Upload metadata
 * @returns {Promise<void>}
 */
async function initializeUpload(uploadId, metadata = {}) {
  try {
    const progress = {
      uploadId,
      status: 'initializing',
      progress: 0,
      bytesUploaded: 0,
      totalBytes: metadata.totalBytes || 0,
      filename: metadata.filename || 'unknown',
      startedAt: new Date(),
      metadata,
    };

    // Store in memory
    uploadProgress.set(uploadId, progress);

    // Also store in Redis if available (for multi-instance support)
    await set(`upload:${uploadId}`, progress, 3600); // 1 hour TTL

    logger.info('Upload initialized', { uploadId, filename: metadata.filename });
  } catch (error) {
    logger.error('Error initializing upload', { uploadId, error: error.message });
    throw error;
  }
}

/**
 * Update upload progress
 * @param {string} uploadId - Upload ID
 * @param {number} bytesUploaded - Bytes uploaded so far
 * @param {number} totalBytes - Total bytes to upload
 * @returns {Promise<Object>} Updated progress
 */
async function updateProgress(uploadId, bytesUploaded, totalBytes = null) {
  try {
    // Get current progress
    let progress = uploadProgress.get(uploadId);
    if (!progress) {
      // Try to get from Redis
      progress = await get(`upload:${uploadId}`);
      if (progress) {
        uploadProgress.set(uploadId, progress);
      } else {
        throw new Error(`Upload ${uploadId} not found`);
      }
    }

    // Update progress
    progress.bytesUploaded = bytesUploaded;
    if (totalBytes !== null) {
      progress.totalBytes = totalBytes;
    }
    progress.progress = progress.totalBytes > 0
      ? Math.round((bytesUploaded / progress.totalBytes) * 100)
      : 0;
    progress.status = progress.progress >= 100 ? 'completed' : 'uploading';
    progress.updatedAt = new Date();

    // Calculate speed
    const elapsed = (Date.now() - new Date(progress.startedAt).getTime()) / 1000; // seconds
    if (elapsed > 0) {
      progress.bytesPerSecond = bytesUploaded / elapsed;
      progress.estimatedTimeRemaining = progress.totalBytes > bytesUploaded
        ? Math.round((progress.totalBytes - bytesUploaded) / progress.bytesPerSecond)
        : 0;
    }

    // Update storage
    uploadProgress.set(uploadId, progress);
    await set(`upload:${uploadId}`, progress, 3600);

    // Emit WebSocket event for real-time updates
    const socketIO = getSocketIO();
    if (socketIO) {
      socketIO.to(`upload:${uploadId}`).emit(`upload:progress:${uploadId}`, progress);
    }

    logger.debug('Upload progress updated', {
      uploadId,
      progress: progress.progress,
      bytesUploaded,
      totalBytes: progress.totalBytes,
    });

    return progress;
  } catch (error) {
    logger.error('Error updating upload progress', {
      uploadId,
      error: error.message,
    });
    captureException(error, {
      tags: { service: 'uploadProgressService', action: 'updateProgress' },
    });
    throw error;
  }
}

/**
 * Get upload progress
 * @param {string} uploadId - Upload ID
 * @returns {Promise<Object>} Progress data
 */
async function getProgress(uploadId) {
  try {
    // Try memory first
    let progress = uploadProgress.get(uploadId);
    if (!progress) {
      // Try Redis
      progress = await get(`upload:${uploadId}`);
      if (progress) {
        uploadProgress.set(uploadId, progress);
      }
    }

    if (!progress) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    return progress;
  } catch (error) {
    logger.error('Error getting upload progress', { uploadId, error: error.message });
    throw error;
  }
}

/**
 * Mark upload as completed
 * @param {string} uploadId - Upload ID
 * @param {Object} result - Upload result (file URL, etc.)
 * @returns {Promise<Object>} Final progress
 */
async function completeUpload(uploadId, result = {}) {
  try {
    const progress = await getProgress(uploadId);

    progress.status = 'completed';
    progress.progress = 100;
    progress.completedAt = new Date();
    progress.result = result;

    // Update storage
    uploadProgress.set(uploadId, progress);
    await set(`upload:${uploadId}`, progress, 3600);

    // Emit WebSocket event
    const socketIO = getSocketIO();
    if (socketIO) {
      socketIO.to(`upload:${uploadId}`).emit(`upload:progress:${uploadId}`, progress);
    }

    logger.info('Upload completed', { uploadId, filename: progress.filename });

    return progress;
  } catch (error) {
    logger.error('Error completing upload', { uploadId, error: error.message });
    throw error;
  }
}

/**
 * Mark upload as failed
 * @param {string} uploadId - Upload ID
 * @param {string} error - Error message
 * @returns {Promise<Object>} Final progress
 */
async function failUpload(uploadId, error) {
  try {
    const progress = await getProgress(uploadId);

    progress.status = 'failed';
    progress.error = error;
    progress.failedAt = new Date();

    // Update storage
    uploadProgress.set(uploadId, progress);
    await set(`upload:${uploadId}`, progress, 3600);

    // Emit WebSocket event
    const socketIO = getSocketIO();
    if (socketIO) {
      socketIO.to(`upload:${uploadId}`).emit(`upload:progress:${uploadId}`, progress);
    }

    logger.error('Upload failed', { uploadId, error, filename: progress.filename });

    return progress;
  } catch (error) {
    logger.error('Error failing upload', { uploadId, error: error.message });
    throw error;
  }
}

/**
 * Cancel upload
 * @param {string} uploadId - Upload ID
 * @returns {Promise<void>}
 */
async function cancelUpload(uploadId) {
  try {
    const progress = await getProgress(uploadId);

    progress.status = 'cancelled';
    progress.cancelledAt = new Date();

    // Update storage
    uploadProgress.set(uploadId, progress);
    await set(`upload:${uploadId}`, progress, 3600);

    // Clean up after 1 hour
    setTimeout(() => {
      uploadProgress.delete(uploadId);
      del(`upload:${uploadId}`).catch(() => {});
    }, 3600000); // 1 hour

    logger.info('Upload cancelled', { uploadId, filename: progress.filename });
  } catch (error) {
    logger.error('Error cancelling upload', { uploadId, error: error.message });
    throw error;
  }
}

/**
 * Clean up old upload progress (older than 24 hours)
 */
async function cleanupOldUploads() {
  try {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [uploadId, progress] of uploadProgress.entries()) {
      const age = now - new Date(progress.startedAt).getTime();
      if (age > maxAge) {
        uploadProgress.delete(uploadId);
        await del(`upload:${uploadId}`).catch(() => {});
        logger.debug('Cleaned up old upload progress', { uploadId });
      }
    }
  } catch (error) {
    logger.error('Error cleaning up old uploads', { error: error.message });
  }
}

// Run cleanup every hour
setInterval(cleanupOldUploads, 60 * 60 * 1000);

module.exports = {
  initializeUpload,
  updateProgress,
  getProgress,
  completeUpload,
  failUpload,
  cancelUpload,
  cleanupOldUploads,
};
