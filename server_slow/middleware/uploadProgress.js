// Upload progress tracking middleware

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Store upload progress
const uploadProgress = new Map();

function getUploadProgress(uploadId) {
  return uploadProgress.get(uploadId) || { progress: 0, status: 'pending' };
}

function setUploadProgress(uploadId, progress, status = 'uploading') {
  uploadProgress.set(uploadId, { progress, status, timestamp: Date.now() });
  
  // Clean up old progress entries (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, data] of uploadProgress.entries()) {
    if (data.timestamp < oneHourAgo) {
      uploadProgress.delete(id);
    }
  }
}

function createProgressTrackingStorage(destination, userId) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../', destination);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uploadId = `${userId}-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      req.uploadId = uploadId;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });
}

module.exports = {
  getUploadProgress,
  setUploadProgress,
  createProgressTrackingStorage
};







