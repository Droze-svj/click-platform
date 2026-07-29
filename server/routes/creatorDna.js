/**
 * GET /api/me/creator-dna — read-only Creator DNA for the authenticated user.
 * Used by the editor to surface "your style" badges and to seed new project
 * defaults.
 *
 * No write side. CreatorDNA is a read-only facade over UserStyleProfile +
 * UserPreferences + cached brandVoice; updates flow through those models'
 * existing write paths.
 */

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const creatorDnaService = require('../services/creatorDnaService');

const router = express.Router();

router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    // Canonical Mongo key = the ObjectId, IDENTICAL to me-personalization's uid()
    // (UserPreferences.userId is Mixed — an ObjectId and its hex string are stored
    // as different documents, so the exact form must match). id-first split
    // creatorDNA into a separate doc the personalization reader never saw.
    const userId = req.user?._id || req.user?.id;
    if (!userId) return sendError(res, 'Unauthenticated', 401);
    const dna = await creatorDnaService.getCreatorDNA(userId);
    return sendSuccess(res, dna);
  })
);

router.get(
  '/project-defaults',
  auth,
  asyncHandler(async (req, res) => {
    // Canonical Mongo key = the ObjectId, IDENTICAL to me-personalization's uid()
    // (UserPreferences.userId is Mixed — an ObjectId and its hex string are stored
    // as different documents, so the exact form must match). id-first split
    // creatorDNA into a separate doc the personalization reader never saw.
    const userId = req.user?._id || req.user?.id;
    if (!userId) return sendError(res, 'Unauthenticated', 401);
    const defaults = await creatorDnaService.projectDefaultsFromDNA(userId);
    return sendSuccess(res, defaults);
  })
);

module.exports = router;
