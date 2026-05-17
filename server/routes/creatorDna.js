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
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) return sendError(res, 'Unauthenticated', 401);
    const dna = await creatorDnaService.getCreatorDNA(userId);
    return sendSuccess(res, dna);
  })
);

router.get(
  '/project-defaults',
  auth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) return sendError(res, 'Unauthenticated', 401);
    const defaults = await creatorDnaService.projectDefaultsFromDNA(userId);
    return sendSuccess(res, defaults);
  })
);

module.exports = router;
