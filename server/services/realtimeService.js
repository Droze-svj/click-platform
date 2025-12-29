// Real-time service for processing updates

const logger = require('../utils/logger');

function getSocketService() {
  // Lazy load to avoid circular dependency
  try {
    return require('./socketService').getSocketService();
  } catch (error) {
    return null;
  }
}

/**
 * Emit processing progress update
 */
function emitProcessingProgress(userId, jobId, progress, message = null) {
  try {
    const io = getSocketService();
    if (io) {
      io.to(`user:${userId}`).emit('processing:progress', {
        jobId,
        progress,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Emit processing progress error', {
      userId,
      jobId,
      error: error.message,
    });
  }
}

/**
 * Emit processing completion
 */
function emitProcessingComplete(userId, jobId, result) {
  try {
    const io = getSocketService();
    if (io) {
      io.to(`user:${userId}`).emit('processing:complete', {
        jobId,
        result,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Emit processing complete error', {
      userId,
      jobId,
      error: error.message,
    });
  }
}

/**
 * Emit processing failure
 */
function emitProcessingFailed(userId, jobId, error) {
  try {
    const io = getSocketService();
    if (io) {
      io.to(`user:${userId}`).emit('processing:failed', {
        jobId,
        error: error.message || error,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error('Emit processing failed error', {
      userId,
      jobId,
      error: err.message,
    });
  }
}

/**
 * Emit upload progress
 */
function emitUploadProgress(userId, uploadId, progress, bytesUploaded, totalBytes) {
  try {
    const io = getSocketService();
    if (io) {
      io.to(`user:${userId}`).emit('upload:progress', {
        uploadId,
        progress,
        bytesUploaded,
        totalBytes,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Emit upload progress error', {
      userId,
      uploadId,
      error: error.message,
    });
  }
}

/**
 * Emit notification
 */
function emitNotification(userId, notification) {
  try {
    const io = getSocketService();
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Emit notification error', {
      userId,
      error: error.message,
    });
  }
}

module.exports = {
  emitProcessingProgress,
  emitProcessingComplete,
  emitProcessingFailed,
  emitUploadProgress,
  emitNotification,
};

