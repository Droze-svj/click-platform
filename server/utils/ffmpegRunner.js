const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const aiMetrics = require('./aiMetrics');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.FFMPEG_TIMEOUT_MS || '180000', 10);

// Dedicated log directory for FFmpeg run diagnostics (per CLAUDE.md directive).
const FFMPEG_LOG_DIR = path.join(process.cwd(), 'logs', 'ffmpeg');
try { fs.mkdirSync(FFMPEG_LOG_DIR, { recursive: true }); } catch (_) { /* already exists */ }

function writeFFmpegLog(label, status, data) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = String(label).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const logFile = path.join(FFMPEG_LOG_DIR, `${ts}_${safeName}_${status}.log`);
    const content = [
      `label: ${label}`,
      `status: ${status}`,
      `timestamp: ${new Date().toISOString()}`,
      data.durationMs != null ? `durationMs: ${data.durationMs}` : null,
      data.stderr ? `\n--- stderr ---\n${data.stderr}` : null,
      data.stdout ? `\n--- stdout ---\n${data.stdout}` : null,
      data.message ? `\n--- error ---\n${data.message}` : null,
    ].filter(Boolean).join('\n');
    fs.writeFileSync(logFile, content, 'utf8');
  } catch (_) { /* log write failures must never crash the pipeline */ }
}

class FFmpegTimeoutError extends Error {
  constructor(message, ctx) {
    super(message);
    this.name = 'FFmpegTimeoutError';
    this.ctx = ctx;
  }
}

class FFmpegRunError extends Error {
  constructor(message, ctx) {
    super(message);
    this.name = 'FFmpegRunError';
    this.ctx = ctx;
  }
}

function run(buildCommand, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    label = 'ffmpeg.run',
    output = null,
  } = options;

  return new Promise((resolve, reject) => {
    let command;
    try {
      command = buildCommand(ffmpeg);
    } catch (err) {
      aiMetrics.increment('ffmpeg.build_error', { label });
      return reject(new FFmpegRunError(`build failed: ${err.message}`, { label }));
    }

    let settled = false;
    const startedAt = Date.now();

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        if (typeof command.kill === 'function') command.kill('SIGKILL');
      } catch (_) { /* already exited */ }
      aiMetrics.increment('ffmpeg.timeout', { label });
      logger.error('ffmpeg.timeout', { label, timeoutMs });
      reject(new FFmpegTimeoutError(`ffmpeg timed out after ${timeoutMs}ms`, { label, timeoutMs }));
    }, timeoutMs);

    command.on('error', (err, stdout, stderr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      aiMetrics.increment('ffmpeg.error', { label });
      logger.error('ffmpeg.error', {
        label,
        message: err && err.message,
        stderr: stderr ? String(stderr).slice(0, 2000) : undefined,
      });
      writeFFmpegLog(label, 'error', {
        message: err && err.message,
        stdout: stdout ? String(stdout) : null,
        stderr: stderr ? String(stderr) : null,
      });
      reject(new FFmpegRunError(err && err.message ? err.message : 'ffmpeg error', { label, stdout, stderr }));
    });

    command.on('end', (stdout, stderr) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      aiMetrics.increment('ffmpeg.success', { label });
      logger.info('ffmpeg.success', { label, durationMs });
      // Write full stderr diagnostics to logs/ffmpeg/ for post-run inspection.
      if (stderr) writeFFmpegLog(label, 'success', { durationMs, stderr: String(stderr) });
      resolve({ output, stdout, stderr, durationMs });
    });

    if (output) {
      command.save(output);
    } else if (typeof command.run === 'function') {
      command.run();
    }
  });
}

function ffprobe(inputPath, options = {}) {
  const { timeoutMs = 30000, label = 'ffprobe' } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      aiMetrics.increment('ffprobe.timeout', { label });
      reject(new FFmpegTimeoutError(`ffprobe timed out after ${timeoutMs}ms`, { label, timeoutMs }));
    }, timeoutMs);

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        aiMetrics.increment('ffprobe.error', { label });
        return reject(new FFmpegRunError(err.message || 'ffprobe error', { label }));
      }
      resolve(metadata);
    });
  });
}

module.exports = {
  run,
  ffprobe,
  FFmpegTimeoutError,
  FFmpegRunError,
  DEFAULT_TIMEOUT_MS,
};
