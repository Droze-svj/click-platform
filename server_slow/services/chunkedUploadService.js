// Chunked file upload service

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { uploadFileToS3, isCloudStorageEnabled } = require('./storageService');

// Store chunk information (in production, use Redis)
const chunkStore = new Map();

/**
 * Initialize chunked upload
 */
function initChunkedUpload(uploadId, totalSize, totalChunks, filename) {
  chunkStore.set(uploadId, {
    uploadId,
    totalSize,
    totalChunks,
    filename,
    chunks: {},
    uploadedChunks: 0,
    status: 'uploading',
    createdAt: Date.now(),
  });

  logger.info('Chunked upload initialized', { uploadId, totalChunks });
  return uploadId;
}

/**
 * Upload chunk
 */
async function uploadChunk(uploadId, chunkNumber, chunkData, chunkSize) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    throw new Error('Upload session not found');
  }

  // Store chunk
  const chunksDir = path.join(__dirname, '../../uploads/chunks', uploadId);
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const chunkPath = path.join(chunksDir, `chunk-${chunkNumber}`);
  fs.writeFileSync(chunkPath, chunkData);

  upload.chunks[chunkNumber] = {
    path: chunkPath,
    size: chunkSize,
    uploadedAt: Date.now(),
  };
  upload.uploadedChunks++;

  logger.debug('Chunk uploaded', { uploadId, chunkNumber, uploadedChunks: upload.uploadedChunks });

  return {
    chunkNumber,
    uploadedChunks: upload.uploadedChunks,
    totalChunks: upload.totalChunks,
    progress: Math.round((upload.uploadedChunks / upload.totalChunks) * 100),
  };
}

/**
 * Assemble chunks into final file
 */
async function assembleChunks(uploadId, outputPath) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    throw new Error('Upload session not found');
  }

  if (upload.uploadedChunks !== upload.totalChunks) {
    throw new Error('Not all chunks uploaded');
  }

  // Sort chunks by number
  const sortedChunks = Object.keys(upload.chunks)
    .map(Number)
    .sort((a, b) => a - b)
    .map(num => upload.chunks[num].path);

  // Assemble file
  const writeStream = fs.createWriteStream(outputPath);
  
  for (const chunkPath of sortedChunks) {
    const chunkData = fs.readFileSync(chunkPath);
    writeStream.write(chunkData);
  }

  writeStream.end();

  // Wait for write to complete
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Clean up chunks
  const chunksDir = path.join(__dirname, '../../uploads/chunks', uploadId);
  if (fs.existsSync(chunksDir)) {
    fs.rmSync(chunksDir, { recursive: true, force: true });
  }

  upload.status = 'completed';
  upload.assembledPath = outputPath;

  logger.info('Chunks assembled', { uploadId, outputPath });

  return outputPath;
}

/**
 * Get upload progress
 */
function getChunkedUploadProgress(uploadId) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    return null;
  }

  return {
    uploadId,
    progress: Math.round((upload.uploadedChunks / upload.totalChunks) * 100),
    uploadedChunks: upload.uploadedChunks,
    totalChunks: upload.totalChunks,
    status: upload.status,
  };
}

/**
 * Cancel chunked upload
 */
function cancelChunkedUpload(uploadId) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    return false;
  }

  // Clean up chunks
  const chunksDir = path.join(__dirname, '../../uploads/chunks', uploadId);
  if (fs.existsSync(chunksDir)) {
    fs.rmSync(chunksDir, { recursive: true, force: true });
  }

  chunkStore.delete(uploadId);
  logger.info('Chunked upload cancelled', { uploadId });
  return true;
}

/**
 * Resume chunked upload (get missing chunks)
 */
function getMissingChunks(uploadId) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    return null;
  }

  const uploaded = Object.keys(upload.chunks).map(Number);
  const missing = [];
  
  for (let i = 0; i < upload.totalChunks; i++) {
    if (!uploaded.includes(i)) {
      missing.push(i);
    }
  }

  return {
    missing,
    uploaded: uploaded.length,
    total: upload.totalChunks,
  };
}

module.exports = {
  initChunkedUpload,
  uploadChunk,
  assembleChunks,
  getChunkedUploadProgress,
  cancelChunkedUpload,
  getMissingChunks,
};

