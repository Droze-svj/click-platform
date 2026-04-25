// Music Licensing Transparency Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  getLicensingTransparencyInfo,
  getLicenseSummary
} = require('../services/musicLicensingTransparencyService');
const router = express.Router();

/**
 * @route GET /api/music-licensing/transparency
 * @desc Get comprehensive licensing transparency information
 * @access Private
 */
router.get('/transparency', auth, asyncHandler(async (req, res) => {
  try {
    const info = await getLicensingTransparencyInfo(req.user._id);

    sendSuccess(res, 'Licensing transparency info retrieved', 200, info);
  } catch (error) {
    logger.error('Error getting licensing transparency info', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get licensing transparency info', 500);
  }
}));

/**
 * @route GET /api/music-licensing/transparency/summary
 * @desc Get quick license summary
 * @access Private
 */
router.get('/transparency/summary', auth, asyncHandler(async (req, res) => {
  try {
    const summary = await getLicenseSummary(req.user._id);

    sendSuccess(res, 'License summary retrieved', 200, summary);
  } catch (error) {
    logger.error('Error getting license summary', {
      error: error.message,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get license summary', 500);
  }
}));

module.exports = router;







