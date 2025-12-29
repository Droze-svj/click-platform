// Backup Encryption Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  encryptBackup,
  decryptBackup,
  compressBackup,
  verifyBackup,
  verifyBackupHash,
} = require('../../services/backupEncryptionService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/disaster-recovery/encryption/encrypt:
 *   post:
 *     summary: Encrypt backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/encrypt', asyncHandler(async (req, res) => {
  const { backupPath, encryptionKey } = req.body;

  if (!backupPath) {
    return sendError(res, 'Backup path is required', 400);
  }

  try {
    const result = await encryptBackup(backupPath, encryptionKey);
    sendSuccess(res, 'Backup encrypted', 200, result);
  } catch (error) {
    logger.error('Encrypt backup error', { error: error.message, backupPath });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/encryption/decrypt:
 *   post:
 *     summary: Decrypt backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/decrypt', asyncHandler(async (req, res) => {
  const { encryptedPath, encryptionKey } = req.body;

  if (!encryptedPath) {
    return sendError(res, 'Encrypted path is required', 400);
  }

  try {
    const result = await decryptBackup(encryptedPath, encryptionKey);
    sendSuccess(res, 'Backup decrypted', 200, result);
  } catch (error) {
    logger.error('Decrypt backup error', { error: error.message, encryptedPath });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/encryption/compress:
 *   post:
 *     summary: Compress backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/compress', asyncHandler(async (req, res) => {
  const { backupPath } = req.body;

  if (!backupPath) {
    return sendError(res, 'Backup path is required', 400);
  }

  try {
    const result = await compressBackup(backupPath);
    sendSuccess(res, 'Backup compressed', 200, result);
  } catch (error) {
    logger.error('Compress backup error', { error: error.message, backupPath });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/encryption/verify:
 *   post:
 *     summary: Verify backup integrity
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify', asyncHandler(async (req, res) => {
  const { backupPath } = req.body;

  if (!backupPath) {
    return sendError(res, 'Backup path is required', 400);
  }

  try {
    const result = await verifyBackup(backupPath);
    sendSuccess(res, 'Backup verified', 200, result);
  } catch (error) {
    logger.error('Verify backup error', { error: error.message, backupPath });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/encryption/verify-hash:
 *   post:
 *     summary: Verify backup hash
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify-hash', asyncHandler(async (req, res) => {
  const { backupPath } = req.body;

  if (!backupPath) {
    return sendError(res, 'Backup path is required', 400);
  }

  try {
    const result = await verifyBackupHash(backupPath);
    sendSuccess(res, 'Backup hash verified', 200, result);
  } catch (error) {
    logger.error('Verify backup hash error', { error: error.message, backupPath });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






