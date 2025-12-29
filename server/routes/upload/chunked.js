// Chunked upload routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  initChunkedUpload,
  uploadChunk,
  assembleChunks,
  getChunkedUploadProgress,
  cancelChunkedUpload,
  getMissingChunks,
} = require('../../services/chunkedUploadService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/upload/chunked/init:
 *   post:
 *     summary: Initialize chunked upload
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.post('/init', auth, asyncHandler(async (req, res) => {
  const { totalSize, totalChunks, filename } = req.body;
  const uploadId = randomUUID();

  if (!totalSize || !totalChunks || !filename) {
    return sendError(res, 'Missing required fields', 400);
  }

  try {
    initChunkedUpload(uploadId, totalSize, totalChunks, filename);
    sendSuccess(res, 'Chunked upload initialized', 200, { uploadId });
  } catch (error) {
    logger.error('Init chunked upload error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/upload/chunked/:uploadId:
 *   post:
 *     summary: Upload chunk
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:uploadId', auth, upload.single('chunk'), asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { chunkNumber } = req.body;

  if (!req.file) {
    return sendError(res, 'Chunk file is required', 400);
  }

  try {
    const result = await uploadChunk(
      uploadId,
      parseInt(chunkNumber),
      req.file.buffer,
      req.file.size
    );

    sendSuccess(res, 'Chunk uploaded', 200, result);
  } catch (error) {
    logger.error('Upload chunk error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/upload/chunked/:uploadId/assemble:
 *   post:
 *     summary: Assemble chunks into final file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:uploadId/assemble', auth, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;
  const { outputPath } = req.body;

  if (!outputPath) {
    return sendError(res, 'Output path is required', 400);
  }

  try {
    const finalPath = await assembleChunks(uploadId, outputPath);
    sendSuccess(res, 'Chunks assembled', 200, { filePath: finalPath });
  } catch (error) {
    logger.error('Assemble chunks error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/upload/chunked/:uploadId/progress:
 *   get:
 *     summary: Get chunked upload progress
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:uploadId/progress', auth, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;

  try {
    const progress = getChunkedUploadProgress(uploadId);
    if (!progress) {
      return sendError(res, 'Upload not found', 404);
    }

    sendSuccess(res, 'Progress fetched', 200, progress);
  } catch (error) {
    logger.error('Get progress error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/upload/chunked/:uploadId/missing:
 *   get:
 *     summary: Get missing chunks (for resume)
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:uploadId/missing', auth, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;

  try {
    const missing = getMissingChunks(uploadId);
    if (!missing) {
      return sendError(res, 'Upload not found', 404);
    }

    sendSuccess(res, 'Missing chunks fetched', 200, missing);
  } catch (error) {
    logger.error('Get missing chunks error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/upload/chunked/:uploadId:
 *   delete:
 *     summary: Cancel chunked upload
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:uploadId', auth, asyncHandler(async (req, res) => {
  const { uploadId } = req.params;

  try {
    const cancelled = cancelChunkedUpload(uploadId);
    if (!cancelled) {
      return sendError(res, 'Upload not found', 404);
    }

    sendSuccess(res, 'Upload cancelled', 200);
  } catch (error) {
    logger.error('Cancel upload error', { error: error.message, uploadId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

