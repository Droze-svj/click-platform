// File operation error handling

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Handle file system errors
 */
function handleFileError(error, filePath = '') {
  const errorMap = {
    ENOENT: {
      message: 'File or directory not found',
      code: 'FILE_NOT_FOUND',
      statusCode: 404
    },
    EACCES: {
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
      statusCode: 403
    },
    EPERM: {
      message: 'Operation not permitted',
      code: 'OPERATION_NOT_PERMITTED',
      statusCode: 403
    },
    ENOSPC: {
      message: 'No space left on device',
      code: 'STORAGE_FULL',
      statusCode: 507
    },
    EEXIST: {
      message: 'File already exists',
      code: 'FILE_EXISTS',
      statusCode: 409
    },
    EISDIR: {
      message: 'Is a directory',
      code: 'IS_DIRECTORY',
      statusCode: 400
    },
    ENOTDIR: {
      message: 'Not a directory',
      code: 'NOT_DIRECTORY',
      statusCode: 400
    },
    EMFILE: {
      message: 'Too many open files',
      code: 'TOO_MANY_FILES',
      statusCode: 503
    }
  };

  const errorConfig = errorMap[error.code];
  if (errorConfig) {
    logger.warn('File operation error', {
      code: error.code,
      message: error.message,
      filePath
    });
    return errorConfig;
  }

  return null;
}

/**
 * Safe file read with error handling
 */
async function safeReadFile(filePath, options = {}) {
  try {
    const data = await fs.readFile(filePath, options);
    return { success: true, data };
  } catch (error) {
    const handledError = handleFileError(error, filePath);
    if (handledError) {
      return {
        success: false,
        error: handledError.message,
        code: handledError.code,
        statusCode: handledError.statusCode
      };
    }
    logger.error('File read error', { error: error.message, filePath });
    return {
      success: false,
      error: 'Failed to read file',
      code: 'FILE_READ_ERROR',
      statusCode: 500
    };
  }
}

/**
 * Safe file write with error handling
 */
async function safeWriteFile(filePath, data, options = {}) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(filePath, data, options);
    return { success: true };
  } catch (error) {
    const handledError = handleFileError(error, filePath);
    if (handledError) {
      return {
        success: false,
        error: handledError.message,
        code: handledError.code,
        statusCode: handledError.statusCode
      };
    }
    logger.error('File write error', { error: error.message, filePath });
    return {
      success: false,
      error: 'Failed to write file',
      code: 'FILE_WRITE_ERROR',
      statusCode: 500
    };
  }
}

/**
 * Safe file delete with error handling
 */
async function safeDeleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    // ENOENT is okay - file doesn't exist
    if (error.code === 'ENOENT') {
      return { success: true, skipped: true };
    }
    
    const handledError = handleFileError(error, filePath);
    if (handledError) {
      return {
        success: false,
        error: handledError.message,
        code: handledError.code,
        statusCode: handledError.statusCode
      };
    }
    logger.error('File delete error', { error: error.message, filePath });
    return {
      success: false,
      error: 'Failed to delete file',
      code: 'FILE_DELETE_ERROR',
      statusCode: 500
    };
  }
}

/**
 * Check if file exists safely
 */
async function safeFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get file stats safely
 */
async function safeFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return { success: true, stats };
  } catch (error) {
    const handledError = handleFileError(error, filePath);
    return {
      success: false,
      error: handledError?.message || 'Failed to get file stats',
      code: handledError?.code || 'FILE_STATS_ERROR'
    };
  }
}

module.exports = {
  handleFileError,
  safeReadFile,
  safeWriteFile,
  safeDeleteFile,
  safeFileExists,
  safeFileStats
};







