// Report Scheduling Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  scheduleReport,
  cancelScheduledReport,
  getScheduledReports,
} = require('../../services/reportSchedulerService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/reports/schedule:
 *   post:
 *     summary: Schedule report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/schedule', auth, asyncHandler(async (req, res) => {
  const { reportConfig, schedule } = req.body;

  if (!reportConfig || !schedule) {
    return sendError(res, 'Report config and schedule are required', 400);
  }

  try {
    const result = await scheduleReport(req.user._id, reportConfig, schedule);
    sendSuccess(res, 'Report scheduled', 200, result);
  } catch (error) {
    logger.error('Schedule report error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/reports/schedule:
 *   get:
 *     summary: Get scheduled reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/schedule', auth, asyncHandler(async (req, res) => {
  try {
    const reports = await getScheduledReports(req.user._id);
    sendSuccess(res, 'Scheduled reports fetched', 200, reports);
  } catch (error) {
    logger.error('Get scheduled reports error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/reports/schedule/:reportType:
 *   delete:
 *     summary: Cancel scheduled report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/schedule/:reportType', auth, asyncHandler(async (req, res) => {
  const { reportType } = req.params;

  try {
    await cancelScheduledReport(req.user._id, reportType);
    sendSuccess(res, 'Scheduled report cancelled', 200);
  } catch (error) {
    logger.error('Cancel scheduled report error', { error: error.message, reportType });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






