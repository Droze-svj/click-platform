// Video processing progress tracking service

const EventEmitter = require('events');
const logger = require('../utils/logger');

class VideoProgressTracker extends EventEmitter {
  constructor() {
    super();
    this.progressMap = new Map();
    // Keep completed/failed results briefly so the client can fetch them after finishing.
    // (If we delete immediately, the UI often misses the final status/result.)
    this.retentionMs = parseInt(process.env.VIDEO_PROGRESS_RETENTION_MS, 10) || 5 * 60 * 1000; // 5 min
  }

  /**
   * Start tracking progress for a video
   */
  startTracking(videoId, operation) {
    const key = `${videoId}-${operation}`;
    this.progressMap.set(key, {
      videoId,
      operation,
      progress: 0,
      status: 'processing',
      startTime: Date.now(),
      estimatedTimeRemaining: null,
    });
    this.emit('progress', { videoId, operation, progress: 0 });
  }

  /**
   * Update progress
   */
  updateProgress(videoId, operation, progress, message = null) {
    const key = `${videoId}-${operation}`;
    const tracking = this.progressMap.get(key);
    
    if (!tracking) {
      return;
    }

    tracking.progress = Math.min(100, Math.max(0, progress));
    tracking.message = message;
    
    // Calculate estimated time remaining
    const elapsed = Date.now() - tracking.startTime;
    if (progress > 0) {
      const totalEstimated = elapsed / (progress / 100);
      tracking.estimatedTimeRemaining = Math.max(0, totalEstimated - elapsed);
    }

    this.emit('progress', {
      videoId,
      operation,
      progress: tracking.progress,
      message,
      estimatedTimeRemaining: tracking.estimatedTimeRemaining,
    });
  }

  /**
   * Schedule removal of a completed/failed entry after retentionMs.
   */
  scheduleCleanup(videoId, operation) {
    const key = `${videoId}-${operation}`;
    const tracking = this.progressMap.get(key);
    if (!tracking) return;
    if (tracking.cleanupTimer) return;

    tracking.cleanupTimer = setTimeout(() => {
      this.progressMap.delete(key);
    }, this.retentionMs);
  }

  /**
   * Complete tracking
   */
  complete(videoId, operation, result = null) {
    const key = `${videoId}-${operation}`;
    const tracking = this.progressMap.get(key);
    
    if (tracking) {
      tracking.progress = 100;
      tracking.status = 'completed';
      tracking.result = result;
      tracking.completedAt = Date.now();
      this.emit('complete', { videoId, operation, result, tracking });
      this.scheduleCleanup(videoId, operation);
    }
  }

  /**
   * Fail tracking
   */
  fail(videoId, operation, error) {
    const key = `${videoId}-${operation}`;
    const tracking = this.progressMap.get(key);
    
    if (tracking) {
      tracking.status = 'failed';
      tracking.error = error.message;
      tracking.completedAt = Date.now();
      this.emit('error', { videoId, operation, error, tracking });
      this.scheduleCleanup(videoId, operation);
    }
  }

  /**
   * Get current progress
   */
  getProgress(videoId, operation) {
    const key = `${videoId}-${operation}`;
    return this.progressMap.get(key) || null;
  }

  /**
   * Get all active operations
   */
  getActiveOperations() {
    return Array.from(this.progressMap.values());
  }
}

// Singleton instance
const progressTracker = new VideoProgressTracker();

module.exports = progressTracker;






