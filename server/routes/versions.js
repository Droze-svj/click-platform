// Content versioning routes

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Content = require('../models/Content');
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
 * Versions snapshot the content body, so every read is scoped to the content
 * owner (the list/get/compare reads used to fetch by contentId alone — any
 * signed-in user could read anyone's drafts). 404, not 403, so existence
 * does not leak.
 */
async function ownsContent(req, contentId) {
  if (!mongoose.Types.ObjectId.isValid(contentId)) return false;
  const userId = String(req.user._id || req.user.id);
  return Boolean(await Content.exists({ _id: contentId, userId }));
}

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
  if (!(await ownsContent(req, contentId))) return sendError(res, 'Content not found', 404);
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
  const { changeSummary } = req.body || {};
  if (!(await ownsContent(req, contentId))) return sendError(res, 'Content not found', 404);

  const version = await createVersion(contentId, String(req.user._id || req.user.id), changeSummary || '');
  sendSuccess(res, 'Version created', 201, version);
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
// Declared before /:contentId/:versionNumber, which would otherwise swallow
// "compare" as a version number.
router.get('/:contentId/compare', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { version1, version2 } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }
  if (!(await ownsContent(req, contentId))) return sendError(res, 'Content not found', 404);

  try {
    const comparison = await compareVersions(
      contentId,
      parseInt(version1, 10),
      parseInt(version2, 10)
    );
    sendSuccess(res, 'Versions compared', 200, comparison);
  } catch (err) {
    if (/not found/i.test(err.message)) return sendError(res, err.message, 404);
    throw err;
  }
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
  if (!(await ownsContent(req, contentId))) return sendError(res, 'Content not found', 404);
  const version = await getVersion(contentId, parseInt(versionNumber, 10));

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
  if (!(await ownsContent(req, contentId))) return sendError(res, 'Content not found', 404);
  try {
    const content = await restoreToVersion(contentId, parseInt(versionNumber, 10), String(req.user._id || req.user.id));
    sendSuccess(res, 'Content restored', 200, content);
  } catch (err) {
    if (/not found/i.test(err.message)) return sendError(res, err.message, 404);
    throw err;
  }
}));

module.exports = router;
