// Chunked file upload service

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { uploadFileToS3, isCloudStorageEnabled } = require('./storageService');

// Store chunk information (in production, use Redis)
const chunkStore = new Map();

// Hard ceiling on assembled size (matches the tus path) + the only directory
// assembled files may ever be written to.
const MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const ASSEMBLED_DIR = path.join(__dirname, '../../uploads/assembled');

/**
 * Fetch an upload session and assert the caller owns it. Returns the session.
 * Throws an indistinguishable "not found" on a missing OR non-owned session so
 * a caller can't probe for other users' upload ids.
 */
function getOwnedUpload(uploadId, ownerId) {
  const upload = chunkStore.get(uploadId);
  if (!upload) {
    throw new Error('Upload session not found');
  }
  if (upload.ownerId && String(ownerId) !== upload.ownerId) {
    throw new Error('Upload session not found');
  }
  return upload;
}

/**
 * Initialize chunked upload
 */
function initChunkedUpload(uploadId, totalSize, totalChunks, filename, ownerId) {
  chunkStore.set(uploadId, {
    uploadId,
    ownerId: ownerId != null ? String(ownerId) : null,
    totalSize,
    totalChunks,
    filename,
    chunks: {},
    uploadedChunks: 0,
    receivedBytes: 0,
    status: 'uploading',
    createdAt: Date.now(),
  });

  logger.info('Chunked upload initialized', { uploadId, totalChunks });
  return uploadId;
}

/**
 * Upload chunk
 */
async function uploadChunk(uploadId, chunkNumber, chunkData, chunkSize, ownerId) {
  const upload = getOwnedUpload(uploadId, ownerId);

  // Bound the chunk index to what was declared at init (prevents arbitrarily
  // high chunkNumbers inflating the on-disk chunk set).
  if (!Number.isInteger(chunkNumber) || chunkNumber < 0 || chunkNumber >= Number(upload.totalChunks)) {
    throw new Error('Invalid chunk number');
  }

  // Enforce a real byte ceiling (the declared totalSize is advisory; cap it at
  // MAX_TOTAL_SIZE) so a session can't be used to fill the disk.
  const prev = upload.chunks[chunkNumber];
  const delta = Number(chunkSize) - (prev ? Number(prev.size) : 0);
  const cap = Math.min(Number(upload.totalSize) || MAX_TOTAL_SIZE, MAX_TOTAL_SIZE);
  if (upload.receivedBytes + delta > cap) {
    throw new Error('Upload exceeds declared size');
  }

  // Store chunk
  const chunksDir = path.join(__dirname, '../../uploads/chunks', uploadId);
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }

  const chunkPath = path.join(chunksDir, `chunk-${chunkNumber}`);
  fs.writeFileSync(chunkPath, chunkData);

  const isNew = !upload.chunks[chunkNumber];
  upload.chunks[chunkNumber] = {
    path: chunkPath,
    size: chunkSize,
    uploadedAt: Date.now(),
  };
  // Only count a genuinely new index so re-uploading a chunk can't push
  // uploadedChunks past totalChunks (which would falsely satisfy assembly).
  if (isNew) upload.uploadedChunks++;
  upload.receivedBytes += delta;

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
async function assembleChunks(uploadId, ownerId) {
  const upload = getOwnedUpload(uploadId, ownerId);

  if (upload.uploadedChunks !== upload.totalChunks) {
    throw new Error('Not all chunks uploaded');
  }

  // SECURITY: the destination is ALWAYS derived server-side. Previously the
  // client passed `outputPath` straight to createWriteStream, so a value like
  // ".env" or "check.sh" (no separator, so the global HTML-escaper didn't touch
  // it) overwrote arbitrary files in the process CWD with attacker-controlled
  // bytes. We now write only into ASSEMBLED_DIR, named by the (server-random)
  // uploadId + a sanitized extension, and assert containment as defense in depth.
  if (!fs.existsSync(ASSEMBLED_DIR)) {
    fs.mkdirSync(ASSEMBLED_DIR, { recursive: true });
  }
  const ext = path.extname(upload.filename || '').toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  const finalPath = path.join(ASSEMBLED_DIR, `${uploadId}${ext}`);
  if (!path.resolve(finalPath).startsWith(path.resolve(ASSEMBLED_DIR) + path.sep)) {
    throw new Error('Invalid output path');
  }

  // Sort chunks by number
  const sortedChunks = Object.keys(upload.chunks)
    .map(Number)
    .sort((a, b) => a - b)
    .map(num => upload.chunks[num].path);

  // Assemble file
  const writeStream = fs.createWriteStream(finalPath);

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
  upload.assembledPath = finalPath;

  logger.info('Chunks assembled', { uploadId, finalPath });

  return finalPath;
}

/**
 * Get upload progress
 */
function getChunkedUploadProgress(uploadId, ownerId) {
  const upload = chunkStore.get(uploadId);
  if (!upload || (upload.ownerId && String(ownerId) !== upload.ownerId)) {
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
function cancelChunkedUpload(uploadId, ownerId) {
  const upload = chunkStore.get(uploadId);
  if (!upload || (upload.ownerId && String(ownerId) !== upload.ownerId)) {
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
function getMissingChunks(uploadId, ownerId) {
  const upload = chunkStore.get(uploadId);
  if (!upload || (upload.ownerId && String(ownerId) !== upload.ownerId)) {
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

