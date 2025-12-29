// Enhanced Calendar Routes
// Real-time updates, analytics, rescheduling, performance preview

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { getCalendarAnalytics } = require('../services/calendarAnalyticsService');
const {
  reschedulePost,
  bulkReschedule,
  getRescheduleSuggestions
} = require('../services/calendarRescheduleService');
const {
  getPerformancePreview,
  batchGetPerformancePreviews
} = require('../services/performancePreviewService');
const CalendarView = require('../models/CalendarView');
const CalendarEvent = require('../models/CalendarEvent');
const ScheduledPost = require('../models/ScheduledPost');
const router = express.Router();

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/analytics
 * Get calendar analytics and insights
 */
router.get('/:agencyWorkspaceId/calendar/analytics', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    clientWorkspaceIds: req.query.clientIds ? req.query.clientIds.split(',') : []
  };

  const analytics = await getCalendarAnalytics(agencyWorkspaceId, filters);
  sendSuccess(res, 'Calendar analytics retrieved', 200, analytics);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/calendar/reschedule
 * Reschedule single post (drag-and-drop)
 */
router.post('/:agencyWorkspaceId/calendar/reschedule', auth, requireWorkspaceAccess('canSchedule'), asyncHandler(async (req, res) => {
  const { postId, newScheduledTime, options = {} } = req.body;

  if (!postId || !newScheduledTime) {
    return sendError(res, 'Post ID and new scheduled time are required', 400);
  }

  const result = await reschedulePost(postId, newScheduledTime, options);
  sendSuccess(res, 'Post rescheduled', 200, result);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/calendar/bulk-reschedule
 * Bulk reschedule posts
 */
router.post('/:agencyWorkspaceId/calendar/bulk-reschedule', auth, requireWorkspaceAccess('canSchedule'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { rescheduleData, options = {} } = req.body;

  if (!rescheduleData) {
    return sendError(res, 'Reschedule data is required', 400);
  }

  const result = await bulkReschedule(agencyWorkspaceId, rescheduleData, options);
  sendSuccess(res, 'Posts bulk rescheduled', 200, result);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/reschedule-suggestions/:postId
 * Get reschedule suggestions
 */
router.get('/:agencyWorkspaceId/calendar/reschedule-suggestions/:postId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const options = {
    suggestOptimal: req.query.suggestOptimal !== 'false',
    suggestAlternatives: req.query.suggestAlternatives !== 'false',
    maxSuggestions: parseInt(req.query.maxSuggestions) || 5
  };

  const suggestions = await getRescheduleSuggestions(postId, options);
  sendSuccess(res, 'Reschedule suggestions retrieved', 200, { suggestions });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/performance-preview/:postId
 * Get performance preview for post
 */
router.get('/:agencyWorkspaceId/calendar/performance-preview/:postId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const preview = await getPerformancePreview(postId);
  sendSuccess(res, 'Performance preview retrieved', 200, preview);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/calendar/performance-preview/batch
 * Batch get performance previews
 */
router.post('/:agencyWorkspaceId/calendar/performance-preview/batch', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { postIds } = req.body;

  if (!postIds || !Array.isArray(postIds)) {
    return sendError(res, 'Post IDs array is required', 400);
  }

  const previews = await batchGetPerformancePreviews(postIds);
  sendSuccess(res, 'Performance previews retrieved', 200, { previews });
}));

/**
 * POST /api/agency/:agencyWorkspaceId/calendar/views
 * Save calendar view
 */
router.post('/:agencyWorkspaceId/calendar/views', auth, requireWorkspaceAccess('canCreate'), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const viewData = {
    ...req.body,
    agencyWorkspaceId,
    createdBy: req.user._id
  };

  // If setting as default, unset other defaults
  if (viewData.isDefault) {
    await CalendarView.updateMany(
      { agencyWorkspaceId, isDefault: true },
      { isDefault: false }
    );
  }

  const view = new CalendarView(viewData);
  await view.save();
  sendSuccess(res, 'Calendar view saved', 201, view);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/views
 * Get saved calendar views
 */
router.get('/:agencyWorkspaceId/calendar/views', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const views = await CalendarView.find({
    agencyWorkspaceId,
    $or: [
      { createdBy: req.user._id },
      { isShared: true }
    ]
  }).sort({ isDefault: -1, createdAt: -1 }).lean();

  sendSuccess(res, 'Calendar views retrieved', 200, { views });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/views/:viewId
 * Get calendar view
 */
router.get('/:agencyWorkspaceId/calendar/views/:viewId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const view = await CalendarView.findById(viewId).lean();

  if (!view) {
    return sendError(res, 'Calendar view not found', 404);
  }

  sendSuccess(res, 'Calendar view retrieved', 200, view);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/calendar/views/:viewId
 * Update calendar view
 */
router.put('/:agencyWorkspaceId/calendar/views/:viewId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  const view = await CalendarView.findById(viewId);

  if (!view) {
    return sendError(res, 'Calendar view not found', 404);
  }

  // If setting as default, unset other defaults
  if (req.body.isDefault) {
    await CalendarView.updateMany(
      { agencyWorkspaceId: view.agencyWorkspaceId, isDefault: true, _id: { $ne: viewId } },
      { isDefault: false }
    );
  }

  Object.assign(view, req.body);
  await view.save();

  sendSuccess(res, 'Calendar view updated', 200, view);
}));

/**
 * DELETE /api/agency/:agencyWorkspaceId/calendar/views/:viewId
 * Delete calendar view
 */
router.delete('/:agencyWorkspaceId/calendar/views/:viewId', auth, requireWorkspaceAccess('canDelete'), asyncHandler(async (req, res) => {
  const { viewId } = req.params;
  await CalendarView.findByIdAndDelete(viewId);
  sendSuccess(res, 'Calendar view deleted', 200);
}));

/**
 * POST /api/agency/:agencyWorkspaceId/calendar/events/:postId/comments
 * Add comment to calendar event
 */
router.post('/:agencyWorkspaceId/calendar/events/:postId/comments', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text, mentions = [] } = req.body;

  if (!text) {
    return sendError(res, 'Comment text is required', 400);
  }

  let event = await CalendarEvent.findOne({ scheduledPostId: postId });
  if (!event) {
    event = new CalendarEvent({
      scheduledPostId: postId,
      agencyWorkspaceId: req.params.agencyWorkspaceId
    });
  }

  event.comments.push({
    userId: req.user._id,
    text,
    mentions,
    createdAt: new Date()
  });

  await event.save();
  sendSuccess(res, 'Comment added', 200, event);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/events/:postId
 * Get calendar event (comments, notes, performance)
 */
router.get('/:agencyWorkspaceId/calendar/events/:postId', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { postId } = req.params;
  let event = await CalendarEvent.findOne({ scheduledPostId: postId })
    .populate('comments.userId', 'name email')
    .populate('comments.mentions', 'name email')
    .lean();

  if (!event) {
    // Create default event
    event = {
      scheduledPostId: postId,
      comments: [],
      notes: '',
      priority: 'normal'
    };
  }

  // Get performance preview
  try {
    const preview = await getPerformancePreview(postId);
    event.performancePreview = preview;
  } catch (error) {
    // Ignore preview errors
  }

  sendSuccess(res, 'Calendar event retrieved', 200, event);
}));

/**
 * PUT /api/agency/:agencyWorkspaceId/calendar/events/:postId
 * Update calendar event (notes, priority, tags)
 */
router.put('/:agencyWorkspaceId/calendar/events/:postId', auth, requireWorkspaceAccess('canEdit'), asyncHandler(async (req, res) => {
  const { postId } = req.params;
  let event = await CalendarEvent.findOne({ scheduledPostId: postId });

  if (!event) {
    event = new CalendarEvent({
      scheduledPostId: postId,
      agencyWorkspaceId: req.params.agencyWorkspaceId
    });
  }

  if (req.body.notes !== undefined) event.notes = req.body.notes;
  if (req.body.priority !== undefined) event.priority = req.body.priority;
  if (req.body.tags !== undefined) event.tags = req.body.tags;
  if (req.body.customFields !== undefined) event.customFields = req.body.customFields;

  await event.save();
  sendSuccess(res, 'Calendar event updated', 200, event);
}));

module.exports = router;


