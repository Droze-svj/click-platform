// Simple job queue for background processing

const EventEmitter = require('events');
const logger = require('./logger');

class JobQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.queue = [];
    this.processing = false;
    this.concurrency = options.concurrency || 3;
    this.activeJobs = 0;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Add job to queue
   */
  add(job) {
    const jobData = {
      id: job.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      handler: job.handler,
      data: job.data || {},
      priority: job.priority || 0,
      retries: 0,
      createdAt: Date.now()
    };

    // Insert based on priority (higher priority first)
    const index = this.queue.findIndex(j => j.priority < jobData.priority);
    if (index === -1) {
      this.queue.push(jobData);
    } else {
      this.queue.splice(index, 0, jobData);
    }

    this.emit('job:added', jobData);
    this.process();

    return jobData.id;
  }

  /**
   * Process queue
   */
  async process() {
    if (this.processing || this.activeJobs >= this.concurrency) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
      const job = this.queue.shift();
      this.activeJobs++;

      this.executeJob(job).finally(() => {
        this.activeJobs--;
        if (this.queue.length > 0) {
          this.process();
        } else {
          this.processing = false;
        }
      });
    }

    this.processing = false;
  }

  /**
   * Execute job
   */
  async executeJob(job) {
    try {
      this.emit('job:started', job);
      logger.info('Job started', { jobId: job.id });

      const result = await job.handler(job.data);

      this.emit('job:completed', { job, result });
      logger.info('Job completed', { jobId: job.id });

      return result;
    } catch (error) {
      logger.error('Job failed', { jobId: job.id, error: error.message });

      // Retry if retries left
      if (job.retries < this.maxRetries) {
        job.retries++;
        logger.info('Retrying job', { jobId: job.id, retry: job.retries });
        
        // Add back to queue with lower priority
        job.priority = Math.max(0, job.priority - 1);
        this.queue.push(job);
        this.process();
      } else {
        this.emit('job:failed', { job, error });
        logger.error('Job failed permanently', { jobId: job.id });
      }
    }
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      queued: this.queue.length,
      active: this.activeJobs,
      total: this.queue.length + this.activeJobs
    };
  }

  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.emit('queue:cleared');
  }
}

// Create singleton instance
const jobQueue = new JobQueue({
  concurrency: 3,
  maxRetries: 3
});

module.exports = jobQueue;







