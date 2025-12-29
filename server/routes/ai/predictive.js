// Predictive Analytics Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  predictContentPerformance,
  predictOptimalPostingTime,
  forecastContentTrends,
} = require('../../services/predictiveAnalyticsService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess } = require('../../utils/response');
const {
  ValidationError,
} = require('../../utils/errorHandler');
const router = express.Router();

router.post('/performance', auth, asyncHandler(async (req, res) => {
  const { contentData } = req.body;
  if (!contentData) {
    throw new ValidationError('Content data is required', [
      { field: 'contentData', message: 'Content data is required' },
    ]);
  }
  
  const prediction = await predictContentPerformance(contentData, req.user._id);
  sendSuccess(res, 'Performance predicted', 200, prediction);
}));

router.post('/posting-time', auth, asyncHandler(async (req, res) => {
  const { platform, contentData } = req.body;
  if (!platform) {
    return sendError(res, 'Platform is required', 400);
  }
  try {
    const prediction = await predictOptimalPostingTime(req.user._id, platform, contentData || {});
    sendSuccess(res, 'Optimal posting time predicted', 200, prediction);
  } catch (error) {
    logger.error('Predict optimal posting time error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/trends', auth, asyncHandler(async (req, res) => {
  const { platform, category, days } = req.query;
  try {
    const forecast = await forecastContentTrends(
      platform || 'instagram',
      category || null,
      days ? parseInt(days) : 30
    );
    sendSuccess(res, 'Trends forecasted', 200, forecast);
  } catch (error) {
    logger.error('Forecast content trends error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

