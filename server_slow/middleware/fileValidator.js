// Enhanced file validation

const path = require('path');
const fs = require('fs');

/**
 * Validate video file
 */
function validateVideoFile(file) {
  const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const allowedMimeTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-m4v'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExtension = allowedExtensions.includes(ext);
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

  if (!isValidExtension || !isValidMimeType) {
    throw new Error(`Invalid video file. Allowed formats: ${allowedExtensions.join(', ')}`);
  }

  // Check file size (default 1GB)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 1073741824;
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`);
  }

  return true;
}

/**
 * Validate image file
 */
function validateImageFile(file) {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExtension = allowedExtensions.includes(ext);
  const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

  if (!isValidExtension || !isValidMimeType) {
    throw new Error(`Invalid image file. Allowed formats: ${allowedExtensions.join(', ')}`);
  }

  const maxSize = 10 * 1024 * 1024; // 10MB for images
  if (file.size > maxSize) {
    throw new Error(`Image too large. Maximum size: 10MB`);
  }

  return true;
}

/**
 * Check if file exists and is readable
 */
async function validateFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  validateVideoFile,
  validateImageFile,
  validateFileExists
};







