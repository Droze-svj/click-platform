// Content versioning routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  createVersion,
  getVersions,
  getVersion,
  restoreToVersion,
  compareVersions
} = require('../services/versionService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/versions/{contentId}:
 *   get:
 *     summary: Get all versions for content
 *     tags: [Versions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const versions = await getVersions(contentId);
  sendSuccess(res, 'Versions fetched', 200, versions);
}));

/**
 * @swagger
 * /api/versions/{contentId}/create:
 *   post:
 *     summary: Create new version
 *     tags: [Versions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/create', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { changeSummary } = req.body;

  const version = await createVersion(contentId, req.user._id, changeSummary || '');
  sendSuccess(res, 'Version created', 201, version);
}));

/**
 * @swagger
 * /api/versions/{contentId}/{versionNumber}:
 *   get:
 *     summary: Get specific version
 *     tags: [Versions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/:versionNumber', auth, asyncHandler(async (req, res) => {
  const { contentId, versionNumber } = req.params;
  const version = await getVersion(contentId, parseInt(versionNumber));

  if (!version) {
    return sendError(res, 'Version not found', 404);
  }

  sendSuccess(res, 'Version fetched', 200, version);
}));

/**
 * @swagger
 * /api/versions/{contentId}/{versionNumber}/restore:
 *   post:
 *     summary: Restore content to version
 *     tags: [Versions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/:versionNumber/restore', auth, asyncHandler(async (req, res) => {
  const { contentId, versionNumber } = req.params;
  const content = await restoreToVersion(contentId, parseInt(versionNumber), req.user._id);
  sendSuccess(res, 'Content restored', 200, content);
}));

/**
 * @swagger
 * /api/versions/{contentId}/compare:
 *   get:
 *     summary: Compare two versions
 *     tags: [Versions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:contentId/compare', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const comparison = await compareVersions(
    contentId,
    parseInt(version1),
    parseInt(version2)
  );

  sendSuccess(res, 'Versions compared', 200, comparison);
}));

module.exports = router;
