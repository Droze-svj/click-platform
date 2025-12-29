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
  cleanupFailedContent
};

