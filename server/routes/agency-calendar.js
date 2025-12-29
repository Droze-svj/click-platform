// Agency Master Calendar Routes
// Master calendar view for agencies

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getMasterCalendar,
  getCalendarConflicts,
  getCalendarView
} = require('../services/masterCalendarService');
const { requireWorkspaceAccess, requireAgencyClientAccess } = require('../middleware/workspaceIsolation');
const router = express.Router();

/**
 * GET /api/agency/:agencyWorkspaceId/calendar
 * Get master calendar for agency
 */
router.get('/:agencyWorkspaceId/calendar', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    clientWorkspaceIds: req.query.clientIds ? req.query.clientIds.split(',') : [],
    platforms: req.query.platforms ? req.query.platforms.split(',') : [],
    teamMemberIds: req.query.teamMemberIds ? req.query.teamMemberIds.split(',') : [],
    status: req.query.status ? req.query.status.split(',') : [],
    search: req.query.search,
    groupBy: req.query.groupBy || 'date'
  };

  const calendar = await getMasterCalendar(agencyWorkspaceId, filters);
  sendSuccess(res, 'Master calendar retrieved', 200, calendar);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/view
 * Get calendar view (day/week/month)
 */
router.get('/:agencyWorkspaceId/calendar/view', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { viewType = 'month', date, ...filters } = req.query;

  const viewDate = date ? new Date(date) : new Date();
  const calendar = await getCalendarView(agencyWorkspaceId, viewType, viewDate, filters);
  sendSuccess(res, 'Calendar view retrieved', 200, calendar);
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/conflicts
 * Get calendar conflicts
 */
router.get('/:agencyWorkspaceId/calendar/conflicts', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    clientWorkspaceIds: req.query.clientIds ? req.query.clientIds.split(',') : [],
    platforms: req.query.platforms ? req.query.platforms.split(',') : []
  };

  const conflicts = await getCalendarConflicts(agencyWorkspaceId, filters);
  sendSuccess(res, 'Calendar conflicts retrieved', 200, { conflicts });
}));

/**
 * GET /api/agency/:agencyWorkspaceId/calendar/export
 * Export calendar data
 */
router.get('/:agencyWorkspaceId/calendar/export', auth, requireWorkspaceAccess(), asyncHandler(async (req, res) => {
  const { agencyWorkspaceId } = req.params;
  const { format = 'json', ...filters } = req.query;

  const calendar = await getMasterCalendar(agencyWorkspaceId, filters);

  if (format === 'csv') {
    // Convert to CSV
    const csv = convertToCSV(calendar.posts);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="calendar-${Date.now()}.csv"`);
    return res.send(csv);
  } else {
    // JSON export
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="calendar-${Date.now()}.json"`);
    return res.json(calendar);
  }
}));

function convertToCSV(posts) {
  const headers = ['Date', 'Time', 'Client', 'Platform', 'Status', 'Content', 'Team Member'];
  const rows = posts.map(post => [
    new Date(post.scheduledTime).toISOString().split('T')[0],
    new Date(post.scheduledTime).toTimeString().split(' ')[0],
    post.clientWorkspaceId?.name || '',
    post.platform,
    post.status,
    post.content?.text?.substring(0, 50) || '',
    post.userId?.name || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

module.exports = router;


