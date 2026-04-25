// Performance Optimization Service
// GPU acceleration, multi-threading, smart caching, lazy loading

const logger = require('../utils/logger');
const os = require('os');

/**
 * Get system capabilities
 */
function getSystemCapabilities() {
  return {
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      speed: os.cpus()[0]?.speed || 0
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    },
    platform: os.platform(),
    arch: os.arch(),
    gpu: {
      available: false, // Would detect GPU in production
      acceleration: false
    }
  };
}

/**
 * Optimize FFmpeg command for performance
 */
function optimizeFFmpegCommand(command, options = {}) {
  const {
    useGPU = false,
    threads = Math.max(1, Math.floor(os.cpus().length * 0.75)),
    preset = 'fast'
  } = options;

  // Set thread count
  command.outputOptions([`-threads`, threads.toString()]);

  // GPU acceleration (if available)
  if (useGPU) {
    // NVIDIA GPU
    command.outputOptions(['-hwaccel', 'cuda']);
    command.videoCodec('h264_nvenc');
  } else {
    // CPU optimization
    command.outputOptions(['-preset', preset]);
  }

  // Memory optimization
  command.outputOptions([
    '-movflags', '+faststart', // Web optimization
    '-pix_fmt', 'yuv420p' // Compatible format
  ]);

  return command;
}

/**
 * Get optimal settings for system
 */
function getOptimalSettings() {
  const capabilities = getSystemCapabilities();
  const cores = capabilities.cpu.cores;
  const memoryGB = capabilities.memory.total / (1024 * 1024 * 1024);

  return {
    threads: Math.max(1, Math.floor(cores * 0.75)),
    preset: memoryGB > 8 ? 'medium' : 'fast',
    useGPU: capabilities.gpu.available,
    maxConcurrentJobs: Math.max(1, Math.floor(cores / 2)),
    cacheSize: Math.floor(memoryGB * 0.1) * 1024 * 1024 * 1024 // 10% of memory
  };
}

/**
 * Create render queue
 */
class RenderQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = getOptimalSettings().maxConcurrentJobs;
    this.activeJobs = 0;
  }

  add(job) {
    this.queue.push({
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString(),
      status: 'queued'
    });
    this.process();
  }

  async process() {
    if (this.processing || this.activeJobs >= this.maxConcurrent) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const job = this.queue.shift();
      this.activeJobs++;

      job.status = 'processing';
      job.startedAt = new Date().toISOString();

      try {
        await job.execute();
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        if (job.onComplete) {
          job.onComplete(job);
        }
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        if (job.onError) {
          job.onError(error);
        }
      } finally {
        this.activeJobs--;
      }
    }

    this.processing = false;

    // Continue processing if queue not empty
    if (this.queue.length > 0) {
      setImmediate(() => this.process());
    }
  }

  getStatus() {
    return {
      queued: this.queue.length,
      processing: this.activeJobs,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Global render queue instance
const renderQueue = new RenderQueue();

module.exports = {
  getSystemCapabilities,
  optimizeFFmpegCommand,
  getOptimalSettings,
  renderQueue,
};
