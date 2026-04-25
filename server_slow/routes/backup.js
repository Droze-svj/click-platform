// Backup and recovery routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  createUserBackup,
  restoreFromBackup,
  getUserBackups,
  deleteBackup,
  exportUserData,
  verifyBackup,
  decryptBackup,
  getBackupStats,
} = require('../services/backupService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const upload = multer({ dest: 'uploads/backups/' });

/**
 * @swagger
 * /api/backup/create:
 *   post:
 *     summary: Create user backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.post('/create', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const options = req.body;

  try {
    const result = await createUserBackup(userId, options);
    sendSuccess(res, 'Backup created successfully', 200, result);
  } catch (error) {
    logger.error('Create backup error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/list:
 *   get:
 *     summary: Get user backups list
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.get('/list', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const backups = await getUserBackups(userId);
    sendSuccess(res, 'Backups fetched', 200, backups);
  } catch (error) {
    logger.error('Get backups error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/restore:
 *   post:
 *     summary: Restore from backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.post('/restore', auth, upload.single('backup'), asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { options, password } = req.body;

  if (!req.file) {
    return sendError(res, 'Backup file is required', 400);
  }

  try {
    // Read backup file
    const fs = require('fs');
    let backupData;
    
    try {
      backupData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    } catch (parseError) {
      // Might be encrypted
      if (password) {
        const encryptedContent = fs.readFileSync(req.file.path, 'utf8');
        const decrypted = decryptBackup(encryptedContent, password);
        backupData = JSON.parse(decrypted);
      } else {
        throw new Error('Backup appears to be encrypted. Password required.');
      }
    }

    // Check if encrypted
    if (backupData.metadata?.encrypted && !password) {
      return sendError(res, 'Password required for encrypted backup', 400);
    }

    // Restore from backup
    const result = await restoreFromBackup(userId, backupData, options || {});

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    sendSuccess(res, 'Backup restored successfully', 200, result);
  } catch (error) {
    logger.error('Restore backup error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/export:
 *   get:
 *     summary: Export user data (GDPR)
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.get('/export', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const result = await exportUserData(userId);
    
    // Send file as download
    const fs = require('fs');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="click-export-${userId}-${Date.now()}.json"`);
    res.send(JSON.stringify(result.data, null, 2));
  } catch (error) {
    logger.error('Export user data error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/:filename:
 *   delete:
 *     summary: Delete backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:filename', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { filename } = req.params;

  try {
    await deleteBackup(userId, filename);
    sendSuccess(res, 'Backup deleted successfully', 200);
  } catch (error) {
    logger.error('Delete backup error', { error: error.message, userId, filename });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/verify/:filename:
 *   post:
 *     summary: Verify backup integrity
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify/:filename', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { filename } = req.params;
  const { hash } = req.body;

  try {
    const backupDir = path.join(__dirname, '../../backups');
    const filepath = path.join(backupDir, filename);
    
    if (!filepath.startsWith(backupDir) || !filename.startsWith(`backup-${userId}-`)) {
      return sendError(res, 'Invalid backup file', 400);
    }

    const isValid = await verifyBackup(filepath, hash);
    sendSuccess(res, 'Backup verification complete', 200, { valid: isValid });
  } catch (error) {
    logger.error('Verify backup error', { error: error.message, userId, filename });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/stats:
 *   get:
 *     summary: Get backup statistics
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const stats = await getBackupStats(userId);
    sendSuccess(res, 'Backup stats fetched', 200, stats);
  } catch (error) {
    logger.error('Get backup stats error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/backup/preview:
 *   post:
 *     summary: Preview restore (dry run)
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 */
router.post('/preview', auth, upload.single('backup'), asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { options, password } = req.body;

  if (!req.file) {
    return sendError(res, 'Backup file is required', 400);
  }

  try {
    const fs = require('fs');
    let backupData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));

    // Decrypt if needed
    if (backupData.metadata?.encrypted) {
      if (!password) {
        return sendError(res, 'Password required for encrypted backup', 400);
      }
      const encryptedContent = fs.readFileSync(req.file.path, 'utf8');
      const decrypted = decryptBackup(encryptedContent, password);
      backupData = JSON.parse(decrypted);
    }

    // Preview restore (dry run)
    const result = await restoreFromBackup(userId, backupData, {
      ...options,
      preview: true,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    sendSuccess(res, 'Restore preview completed', 200, result);
  } catch (error) {
    logger.error('Preview restore error', { error: error.message, userId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

