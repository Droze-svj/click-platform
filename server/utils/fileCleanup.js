// File cleanup utility for failed uploads

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Clean up files older than specified days
async function cleanupOldFiles(directory, daysOld = 7) {
  try {
    const files = await fs.readdir(directory);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.stat(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        logger.info('Deleted old file', { filePath });
      }
    }
  } catch (error) {
    logger.error('Error cleaning up files', { directory, error: error.message });
  }
}

// Sweep a temp directory of orphaned entries older than `hoursOld`. Unlike
// cleanupOldFiles this (a) measures age in hours (temp files are short-lived),
// (b) removes stale sub-directories too (recursively), and (c) isolates errors
// per entry so one undeletable file doesn't abort the sweep. Safe to point at
// uploads/temp, tmp, etc. — anything older than the window is an ffmpeg/process
// leftover that should have been cleaned at process completion.
async function cleanupTempFiles(directory, hoursOld = 6, options = {}) {
  let removed = 0;
  // Entry names to never touch — e.g. the tus resumable-upload store, whose
  // lifecycle is governed by tus's own per-upload expiration. Sweeping it here
  // by directory mtime would wipe in-progress/paused uploads (a directory's
  // mtime doesn't change when chunks are appended to existing files).
  const exclude = new Set(options.exclude || []);
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const now = Date.now();
    const maxAge = hoursOld * 60 * 60 * 1000;

    for (const entry of entries) {
      if (exclude.has(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      try {
        const stats = await fs.stat(entryPath);
        if (now - stats.mtime.getTime() <= maxAge) continue;
        if (entry.isDirectory()) {
          await fs.rm(entryPath, { recursive: true, force: true });
        } else {
          await fs.unlink(entryPath);
        }
        removed++;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn('Temp sweep: could not remove entry', { entryPath, error: err.message });
        }
      }
    }
    if (removed > 0) logger.info('Temp sweep complete', { directory, removed, hoursOld });
  } catch (error) {
    // Directory may not exist yet — that's fine.
    if (error.code !== 'ENOENT') {
      logger.error('Error sweeping temp directory', { directory, error: error.message });
    }
  }
  return removed;
}

// Clean up files associated with failed content
async function cleanupFailedContent(contentId, filePaths) {
  try {
    for (const filePath of filePaths) {
      const fullPath = path.join(__dirname, '../../', filePath);
      try {
        await fs.unlink(fullPath);
        logger.info('Cleaned up file', { filePath: fullPath, contentId });
      } catch (error) {
        // File might not exist, ignore
        if (error.code !== 'ENOENT') {
          logger.error('Error deleting file', { filePath: fullPath, error: error.message });
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up content', { contentId, error: error.message });
  }
}

module.exports = {
  cleanupOldFiles,
  cleanupTempFiles,
  cleanupFailedContent
};

