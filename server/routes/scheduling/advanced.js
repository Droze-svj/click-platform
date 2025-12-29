// Advanced Scheduling Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  scheduleWithTimezone,
  createRecurringSchedule,
  processRecurringSchedules,
  detectConflicts,
  resolveConflicts,
  createScheduleTemplate,
  applyScheduleTemplate,
  optimizeSchedule,
  getScheduleAnalytics
} = require('../../services/advancedSchedulingService');
const {
  predictOptimalTime,
  getScheduleSuggestions,
  autoRescheduleBasedOnPerformance,
  monitorScheduleHealth,
  previewSchedule,
  bulkScheduleOptimized
} = require('../../services/smartScheduleOptimizationService');
const {
  exportToCalendar,
  importFromCalendar
} = require('../../services/calendarIntegrationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * POST /api/scheduling/advanced/schedule-timezone
 * Schedule with timezone support
 */
router.post('/schedule-timezone', auth, asyncHandler(async (req, res) => {
  const { contentId, platform, scheduledTime, timezone = 'UTC' } = req.body;

  if (!contentId || !platform || !scheduledTime) {
    return sendError(res, 'Content ID, platform, and scheduled time are required', 400);
  }

  const post = await scheduleWithTimezone(req.user._id, contentId, platform, new Date(scheduledTime), timezone);
  sendSuccess(res, 'Content scheduled with timezone', 200, post);
}));

/**
 * POST /api/scheduling/advanced/recurring
 * Create recurring schedule
 */
router.post('/recurring', auth, asyncHandler(async (req, res) => {
  const schedule = await createRecurringSchedule(req.user._id, req.body);
  sendSuccess(res, 'Recurring schedule created', 201, schedule);
}));

/**
 * GET /api/scheduling/advanced/recurring
 * Get user's recurring schedules
 */
router.get('/recurring', auth, asyncHandler(async (req, res) => {
  const RecurringSchedule = require('../../models/RecurringSchedule');
  const { status = 'active' } = req.query;

  const schedules = await RecurringSchedule.find({
    userId: req.user._id,
    status
  })
    .populate('contentId', 'title type')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Recurring schedules retrieved', 200, { schedules });
}));

/**
 * PUT /api/scheduling/advanced/recurring/:scheduleId
 * Update recurring schedule
 */
router.put('/recurring/:scheduleId', auth, asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const RecurringSchedule = require('../../models/RecurringSchedule');

  const schedule = await RecurringSchedule.findOneAndUpdate(
    { _id: scheduleId, userId: req.user._id },
    req.body,
    { new: true }
  );

  if (!schedule) {
    return sendError(res, 'Recurring schedule not found', 404);
  }

  sendSuccess(res, 'Recurring schedule updated', 200, schedule);
}));

/**
 * DELETE /api/scheduling/advanced/recurring/:scheduleId
 * Cancel recurring schedule
 */
router.delete('/recurring/:scheduleId', auth, asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const RecurringSchedule = require('../../models/RecurringSchedule');

  const schedule = await RecurringSchedule.findOneAndUpdate(
    { _id: scheduleId, userId: req.user._id },
    { status: 'cancelled' },
    { new: true }
  );

  if (!schedule) {
    return sendError(res, 'Recurring schedule not found', 404);
  }

  sendSuccess(res, 'Recurring schedule cancelled', 200, schedule);
}));

/**
 * POST /api/scheduling/advanced/check-conflicts
 * Detect scheduling conflicts
 */
router.post('/check-conflicts', auth, asyncHandler(async (req, res) => {
  const { scheduledTime, platform, excludePostId = null } = req.body;

  if (!scheduledTime || !platform) {
    return sendError(res, 'Scheduled time and platform are required', 400);
  }

  const conflicts = await detectConflicts(
    req.user._id,
    new Date(scheduledTime),
    platform,
    excludePostId
  );

  sendSuccess(res, 'Conflicts checked', 200, conflicts);
}));

/**
 * POST /api/scheduling/advanced/resolve-conflicts/:postId
 * Resolve scheduling conflicts
 */
router.post('/resolve-conflicts/:postId', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { strategy = 'auto' } = req.body;

  const result = await resolveConflicts(req.user._id, postId, strategy);
  sendSuccess(res, 'Conflicts resolved', 200, result);
}));

/**
 * POST /api/scheduling/advanced/templates
 * Create schedule template
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const template = await createScheduleTemplate(req.user._id, req.body);
  sendSuccess(res, 'Schedule template created', 201, template);
}));

/**
 * GET /api/scheduling/advanced/templates
 * Get user's schedule templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const ScheduleTemplate = require('../../models/ScheduleTemplate');
  const { isActive = true } = req.query;

  const templates = await ScheduleTemplate.find({
    userId: req.user._id,
    isActive: isActive === 'true'
  })
    .sort({ isDefault: -1, usageCount: -1, createdAt: -1 })
    .lean();

  sendSuccess(res, 'Schedule templates retrieved', 200, { templates });
}));

/**
 * PUT /api/scheduling/advanced/templates/:templateId
 * Update schedule template
 */
router.put('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const ScheduleTemplate = require('../../models/ScheduleTemplate');

  const template = await ScheduleTemplate.findOneAndUpdate(
    { _id: templateId, userId: req.user._id },
    req.body,
    { new: true }
  );

  if (!template) {
    return sendError(res, 'Schedule template not found', 404);
  }

  sendSuccess(res, 'Schedule template updated', 200, template);
}));

/**
 * DELETE /api/scheduling/advanced/templates/:templateId
 * Delete schedule template
 */
router.delete('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const ScheduleTemplate = require('../../models/ScheduleTemplate');

  const template = await ScheduleTemplate.findOneAndDelete({
    _id: templateId,
    userId: req.user._id
  });

  if (!template) {
    return sendError(res, 'Schedule template not found', 404);
  }

  sendSuccess(res, 'Schedule template deleted', 200);
}));

/**
 * POST /api/scheduling/advanced/templates/:templateId/apply
 * Apply schedule template
 */
router.post('/templates/:templateId/apply', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { contentIds, ...options } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  const result = await applyScheduleTemplate(req.user._id, contentIds, templateId, options);
  sendSuccess(res, 'Schedule template applied', 200, result);
}));

/**
 * POST /api/scheduling/advanced/optimize
 * Optimize schedule
 */
router.post('/optimize', auth, asyncHandler(async (req, res) => {
  const { dateRange = 7 } = req.body;

  const optimizations = await optimizeSchedule(req.user._id, dateRange);
  sendSuccess(res, 'Schedule optimized', 200, optimizations);
}));

/**
 * GET /api/scheduling/advanced/analytics
 * Get schedule analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const { period = 30 } = req.query;

  const analytics = await getScheduleAnalytics(req.user._id, parseInt(period));
  sendSuccess(res, 'Schedule analytics retrieved', 200, analytics);
}));

/**
 * POST /api/scheduling/advanced/predict-optimal-time
 * Predict optimal posting time
 */
router.post('/predict-optimal-time', auth, asyncHandler(async (req, res) => {
  const { contentId, platform, ...options } = req.body;

  if (!contentId || !platform) {
    return sendError(res, 'Content ID and platform are required', 400);
  }

  const prediction = await predictOptimalTime(req.user._id, contentId, platform, options);
  sendSuccess(res, 'Optimal time predicted', 200, prediction);
}));

/**
 * GET /api/scheduling/advanced/suggestions
 * Get schedule suggestions
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const { dateRange = 7, platforms, minPostsPerDay = 1, maxPostsPerDay = 5 } = req.query;

  const suggestions = await getScheduleSuggestions(req.user._id, {
    dateRange: parseInt(dateRange),
    platforms: platforms ? platforms.split(',') : null,
    minPostsPerDay: parseInt(minPostsPerDay),
    maxPostsPerDay: parseInt(maxPostsPerDay)
  });

  sendSuccess(res, 'Schedule suggestions retrieved', 200, suggestions);
}));

/**
 * POST /api/scheduling/advanced/auto-reschedule/:postId
 * Auto-reschedule based on performance
 */
router.post('/auto-reschedule/:postId', auth, asyncHandler(async (req, res) => {
  const { postId } = req.params;

  const result = await autoRescheduleBasedOnPerformance(req.user._id, postId);
  sendSuccess(res, 'Auto-reschedule completed', 200, result);
}));

/**
 * GET /api/scheduling/advanced/health
 * Monitor schedule health
 */
router.get('/health', auth, asyncHandler(async (req, res) => {
  const { dateRange = 7 } = req.query;

  const health = await monitorScheduleHealth(req.user._id, parseInt(dateRange));
  sendSuccess(res, 'Schedule health retrieved', 200, health);
}));

/**
 * POST /api/scheduling/advanced/preview
 * Preview schedule
 */
router.post('/preview', auth, asyncHandler(async (req, res) => {
  const { scheduleData, dateRange = 7 } = req.body;

  if (!scheduleData || !scheduleData.contentIds || !scheduleData.platforms) {
    return sendError(res, 'Schedule data with contentIds and platforms is required', 400);
  }

  const preview = await previewSchedule(req.user._id, scheduleData, dateRange);
  sendSuccess(res, 'Schedule preview generated', 200, preview);
}));

/**
 * POST /api/scheduling/advanced/bulk-optimized
 * Bulk schedule with optimization
 */
router.post('/bulk-optimized', auth, asyncHandler(async (req, res) => {
  const { contentIds, platforms, startDate, ...options } = req.body;

  if (!contentIds || !platforms || !startDate) {
    return sendError(res, 'Content IDs, platforms, and start date are required', 400);
  }

  const results = await bulkScheduleOptimized(req.user._id, {
    contentIds,
    platforms,
    startDate,
    ...options
  });

  sendSuccess(res, 'Bulk scheduling completed', 200, results);
}));

/**
 * GET /api/scheduling/advanced/export-calendar
 * Export schedule to calendar
 */
router.get('/export-calendar', auth, asyncHandler(async (req, res) => {
  const { startDate, endDate, platforms, format = 'ics' } = req.query;

  const calendar = await exportToCalendar(req.user._id, {
    startDate,
    endDate,
    platforms: platforms ? platforms.split(',') : null,
    format
  });

  if (format === 'ics') {
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule.ics"');
    res.send(calendar);
  } else {
    sendSuccess(res, 'Calendar exported', 200, calendar);
  }
}));

/**
 * POST /api/scheduling/advanced/import-calendar
 * Import from calendar
 */
router.post('/import-calendar', auth, asyncHandler(async (req, res) => {
  const { calendarData, format = 'ics' } = req.body;

  if (!calendarData) {
    return sendError(res, 'Calendar data is required', 400);
  }

  const result = await importFromCalendar(req.user._id, calendarData, format);
  sendSuccess(res, 'Calendar import completed', 200, result);
}));

module.exports = router;
