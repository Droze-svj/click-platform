// Video processing progress tracking service

const EventEmitter = require('events');
const logger = require('../utils/logger');

class VideoProgressTracker extends EventEmitter {
  constructor() {
    super();
    this.progressMap = new Map();
    // Opaque jobId → { videoId, operation } for the job-oriented facade below.
    this.jobs = new Map();
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
      // EventEmitter special-cases 'error': emitting it with NO listener THROWS
      // (uncaught → process crash). A background video job that fails while no
      // SSE progress client is attached would take the server down. Emit a
      // neutral 'failed' event always, and 'error' only when someone listens.
      this.emit('failed', { videoId, operation, error, tracking });
      if (this.listenerCount('error') > 0) {
        this.emit('error', { videoId, operation, error, tracking });
      }
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

  /**
   * Job-oriented facade used by routes/video/advanced.js. That router creates a
   * job up front and settles it by an opaque jobId — but the core tracker keys by
   * (videoId, operation). These map between the two. Without them every
   * /api/video/advanced/* operation 500'd on `progressTracker.createJob(...)`
   * because the method didn't exist.
   *
   * @returns {string} the jobId
   */
  createJob(userId, operation, meta = {}) {
    const videoId = (meta && meta.videoId) || String(userId || 'anon');
    const jobId = `${operation}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    this.jobs.set(jobId, { videoId, operation, userId });
    this.startTracking(videoId, operation);
    return jobId;
  }

  /**
   * Settle or advance a job by id. status 'completed' | 'failed' finalize;
   * anything else is treated as a progress update (numeric progress or message).
   */
  updateJob(jobId, status, result = null, errorMessage = null) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (status === 'completed') {
      this.complete(job.videoId, job.operation, result);
      this.jobs.delete(jobId);
    } else if (status === 'failed') {
      this.fail(job.videoId, job.operation, new Error(errorMessage || 'Operation failed'));
      this.jobs.delete(jobId);
    } else {
      const progress = typeof status === 'number' ? status : 50;
      this.updateProgress(job.videoId, job.operation, progress, errorMessage);
    }
  }
}

// Singleton instance
const progressTracker = new VideoProgressTracker();

module.exports = progressTracker;






