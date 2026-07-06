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
    threads = Math.max(1, Math.floor(os.cpus().length * 0.75)),
  } = options;

  // Thread tuning ONLY. Everything else (codec, preset, rate control, -pix_fmt,
  // -movflags, and hardware-encoder selection) is owned by
  // videoRenderService.buildVideoOutputOptions / resolveVideoEncoder — one place,
  // per encoder family. This helper used to ALSO set `-preset fast` (silently
  // overriding the render's slow/medium quality preset — last -preset wins) and
  // force `-pix_fmt yuv420p` on EVERY codec (corrupting ProRes exports) and
  // hardcode h264_nvenc (ignoring hevc/prores). Those are removed.
  command.outputOptions(['-threads', threads.toString()]);
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

  // Fill every free concurrency slot from the queue. Synchronous + idempotent —
  // safe to call from add() and from each finishing job. Jobs now run in PARALLEL
  // up to maxConcurrent (cores/2); previously the in-loop `await` serialized the
  // whole queue — activeJobs never exceeded 1 and the concurrency cap was dead.
  process() {
    while (this.queue.length > 0 && this.activeJobs < this.maxConcurrent) {
      const job = this.queue.shift();
      this.activeJobs++;
      // Fire WITHOUT awaiting so the loop can fill the remaining slots; the job
      // releases its slot (and pulls the next queued one) in _runJob's finally.
      this._runJob(job);
    }
  }

  async _runJob(job) {
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    // Hard timeout so a single hung ffmpeg job (corrupt input, stalled remote
    // source, codec deadlock) can NEVER wedge its slot forever. Generous default
    // (20 min) so real long renders aren't killed; tune via RENDER_JOB_TIMEOUT_MS.
    const RENDER_JOB_TIMEOUT_MS = Number(process.env.RENDER_JOB_TIMEOUT_MS) || 20 * 60 * 1000;
    let timeoutHandle = null;
    try {
      // Capture and forward the execute() result. Previously the queue discarded
      // the result and called onComplete(job) with the queue's own job object, so
      // callers (e.g. videoRenderService) never received the render output
      // ({ outputPath, url }) — manual exports completed but returned no URL.
      const result = await Promise.race([
        job.execute(),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Render job timed out after ${RENDER_JOB_TIMEOUT_MS}ms`)),
            RENDER_JOB_TIMEOUT_MS,
          );
        }),
      ]);
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;
      if (job.onComplete) {
        job.onComplete(result);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      if (job.onError) {
        job.onError(error);
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.activeJobs--;
      // A slot just freed — pull the next queued job (if any).
      if (this.queue.length > 0) this.process();
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
  RenderQueue, // exported for tests (construct with a controlled maxConcurrent)
};
