// Enhanced Support Routes
// Priority support, SLAs, status page

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { getSupportSLA, checkSLACompliance, getOnboardingStatus, completeOnboarding } = require('../services/prioritySupportService');
const { getPlatformStatus } = require('../services/prioritySupportService');
const { createSupportChat, sendChatMessage, getSupportAnalytics, checkProactiveSupport } = require('../services/supportEnhancementService');
const { escalateTicket, assignTicket, autoEscalateTickets } = require('../services/supportEscalationService');
const { searchKnowledgeBase, suggestArticlesForTicket, getArticle, markArticleHelpful } = require('../services/knowledgeBaseService');
const router = express.Router();

/**
 * GET /api/support/sla
 * Get support SLA
 */
router.get('/sla', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const sla = await getSupportSLA(userId);
  sendSuccess(res, 'SLA retrieved', 200, sla);
}));

/**
 * GET /api/support/onboarding
 * Get onboarding status
 */
router.get('/onboarding', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const status = await getOnboardingStatus(userId);
  sendSuccess(res, 'Onboarding status retrieved', 200, status);
}));

/**
 * POST /api/support/onboarding/complete
 * Complete onboarding
 */
router.post('/onboarding/complete', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { completedBy } = req.body;
  const result = await completeOnboarding(userId, completedBy || req.user._id);
  sendSuccess(res, 'Onboarding completed', 200, result);
}));

/**
 * GET /api/status
 * Get platform status (public)
 */
router.get('/status', asyncHandler(async (req, res) => {
  const status = await getPlatformStatus();
  sendSuccess(res, 'Platform status retrieved', 200, status);
}));

/**
 * POST /api/support/chat
 * Create support chat
 */
router.post('/chat', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const chat = await createSupportChat(userId, req.body);
  sendSuccess(res, 'Chat created', 201, chat);
}));

/**
 * POST /api/support/chat/:chatId/message
 * Send chat message
 */
router.post('/chat/:chatId/message', auth, asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user._id;
  const { text, attachments, fromSupport } = req.body;
  
  if (!text) {
    return sendError(res, 'Message text is required', 400);
  }

  const chat = await sendChatMessage(chatId, userId, { text, attachments, fromSupport: fromSupport || false });
  sendSuccess(res, 'Message sent', 200, chat);
}));

/**
 * GET /api/support/analytics
 * Get support analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const userId = req.user.role === 'admin' ? null : req.user._id;
  const { period = 'month' } = req.query;
  const analytics = await getSupportAnalytics(userId, period);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * GET /api/support/proactive
 * Check proactive support triggers
 */
router.get('/proactive', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const triggers = await checkProactiveSupport(userId);
  sendSuccess(res, 'Proactive support checked', 200, { triggers });
}));

/**
 * POST /api/support/tickets/:ticketId/escalate
 * Escalate ticket
 */
router.post('/tickets/:ticketId/escalate', auth, asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    return sendError(res, 'Reason is required', 400);
  }

  const ticket = await escalateTicket(ticketId, reason, req.user._id);
  sendSuccess(res, 'Ticket escalated', 200, ticket);
}));

/**
 * POST /api/support/tickets/:ticketId/assign
 * Assign ticket
 */
router.post('/tickets/:ticketId/assign', auth, asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { assigneeId } = req.body;
  
  if (!assigneeId) {
    return sendError(res, 'Assignee ID is required', 400);
  }

  const ticket = await assignTicket(ticketId, assigneeId, req.user._id);
  sendSuccess(res, 'Ticket assigned', 200, ticket);
}));

/**
 * GET /api/support/knowledge/search
 * Search knowledge base
 */
router.get('/knowledge/search', asyncHandler(async (req, res) => {
  const { q, category } = req.query;
  
  if (!q) {
    return sendError(res, 'Search query is required', 400);
  }

  const articles = await searchKnowledgeBase(q, { category });
  sendSuccess(res, 'Articles found', 200, { articles });
}));

/**
 * GET /api/support/knowledge/suggest/:ticketId
 * Suggest articles for ticket
 */
router.get('/knowledge/suggest/:ticketId', auth, asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const SupportTicket = require('../models/SupportTicket');
  const ticket = await SupportTicket.findById(ticketId).lean();
  
  if (!ticket) {
    return sendError(res, 'Ticket not found', 404);
  }

  const articles = await suggestArticlesForTicket(ticket);
  sendSuccess(res, 'Articles suggested', 200, { articles });
}));

/**
 * GET /api/support/knowledge/:articleId
 * Get article
 */
router.get('/knowledge/:articleId', asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const article = await getArticle(articleId);
  
  if (!article) {
    return sendError(res, 'Article not found', 404);
  }

  sendSuccess(res, 'Article retrieved', 200, article);
}));

/**
 * POST /api/support/knowledge/:articleId/helpful
 * Mark article as helpful
 */
router.post('/knowledge/:articleId/helpful', auth, asyncHandler(async (req, res) => {
  const { articleId } = req.params;
  const { helpful = true } = req.body;
  
  const article = await markArticleHelpful(articleId, helpful);
  sendSuccess(res, 'Article feedback recorded', 200, article);
}));

module.exports = router;

