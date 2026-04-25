// Approval Kanban Routes
// Per-client Kanban boards with SLA tracking

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { requireWorkspaceAccess } = require('../middleware/workspaceIsolation');
const { getKanbanBoardWithCards, moveCard } = require('../services/approvalKanbanService');
const { getUserSLAAlerts } = require('../services/slaAlertService');
const router = express.Router();

/**
 * GET /api/clients/:clientWorkspaceId/kanban
 * Get Kanban board for client
 */
router.get('/:clientWorkspaceId/kanban', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { agencyWorkspaceId } = req.query;

  if (!agencyWorkspaceId) {
    return sendError(res, 'Agency workspace ID is required', 400);
  }

  const board = await getKanbanBoardWithCards(clientWorkspaceId, agencyWorkspaceId, req.query);
  sendSuccess(res, 'Kanban board retrieved', 200, board);
}));

/**
 * POST /api/clients/:clientWorkspaceId/kanban/move
 * Move card between columns
 */
router.post('/:clientWorkspaceId/kanban/move', auth, asyncHandler(async (req, res) => {
  const { clientWorkspaceId } = req.params;
  const { cardId, fromColumnId, toColumnId, agencyWorkspaceId } = req.body;

  if (!agencyWorkspaceId || !cardId || !fromColumnId || !toColumnId) {
    return sendError(res, 'Missing required fields', 400);
  }

  const userId = req.user._id;
  const result = await moveCard(cardId, fromColumnId, toColumnId, clientWorkspaceId, agencyWorkspaceId, userId);
  sendSuccess(res, 'Card moved', 200, result);
}));

/**
 * GET /api/approvals/sla-alerts
 * Get SLA alerts for current user
 */
router.get('/sla-alerts', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const alerts = await getUserSLAAlerts(userId);
  sendSuccess(res, 'SLA alerts retrieved', 200, { alerts });
}));

module.exports = router;


