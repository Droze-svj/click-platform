// Disaster Recovery Routes

const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const {
  createDRBackup,
  restoreFromBackup,
  listBackups,
  deleteBackup,
  setupAutomatedBackups,
  testDisasterRecovery,
} = require('../services/disasterRecoveryService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

router.use(auth);
router.use(requireAdmin);

/**
 * @swagger
 * /api/disaster-recovery/backup:
 *   post:
 *     summary: Create DR backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/backup', asyncHandler(async (req, res) => {
  const {
    includeDatabase = true,
    includeFiles = true,
    includeConfig = true,
    backupType = 'full',
  } = req.body;

  try {
    const backup = await createDRBackup({
      includeDatabase,
      includeFiles,
      includeConfig,
      backupType,
    });
    sendSuccess(res, 'DR backup created', 200, backup);
  } catch (error) {
    logger.error('Create DR backup error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/backups:
 *   get:
 *     summary: List backups
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.get('/backups', asyncHandler(async (req, res) => {
  try {
    const backups = await listBackups();
    sendSuccess(res, 'Backups fetched', 200, backups);
  } catch (error) {
    logger.error('List backups error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/restore:
 *   post:
 *     summary: Restore from backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/restore', asyncHandler(async (req, res) => {
  const { backupId, restoreDatabase = true, restoreFiles = true, restoreConfig = false } = req.body;

  if (!backupId) {
    return sendError(res, 'Backup ID is required', 400);
  }

  try {
    const result = await restoreFromBackup(backupId, {
      restoreDatabase,
      restoreFiles,
      restoreConfig,
    });
    sendSuccess(res, 'Backup restored', 200, result);
  } catch (error) {
    logger.error('Restore backup error', { error: error.message, backupId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/backup/:backupId:
 *   delete:
 *     summary: Delete backup
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/backup/:backupId', asyncHandler(async (req, res) => {
  const { backupId } = req.params;

  try {
    await deleteBackup(backupId);
    sendSuccess(res, 'Backup deleted', 200);
  } catch (error) {
    logger.error('Delete backup error', { error: error.message, backupId });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/automate:
 *   post:
 *     summary: Setup automated backups
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/automate', asyncHandler(async (req, res) => {
  const { schedule = '0 2 * * *' } = req.body;

  try {
    await setupAutomatedBackups(schedule);
    sendSuccess(res, 'Automated backups configured', 200);
  } catch (error) {
    logger.error('Setup automated backups error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/disaster-recovery/test:
 *   post:
 *     summary: Test disaster recovery
 *     tags: [Disaster Recovery]
 *     security:
 *       - bearerAuth: []
 */
router.post('/test', asyncHandler(async (req, res) => {
  try {
    const result = await testDisasterRecovery();
    sendSuccess(res, 'DR test completed', 200, result);
  } catch (error) {
    logger.error('DR test error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






