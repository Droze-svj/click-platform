// Help Center Routes

const express = require('express');
const auth = require('../middleware/auth');
const {
  getHelpArticles,
  getHelpArticle,
  getCategories,
  markHelpful,
  createSupportTicket,
  getUserTickets,
  addTicketMessage,
  updateTicketStatus,
} = require('../services/helpCenterService');
const {
  aiSearch,
  getArticleRecommendations,
  getPersonalizedSuggestions,
} = require('../services/helpCenterAIService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/help/articles:
 *   get:
 *     summary: Get help articles
 *     tags: [Help Center]
 */
router.get('/articles', asyncHandler(async (req, res) => {
  const {
    category,
    search,
    featured,
    limit = 20,
    skip = 0,
  } = req.query;

  try {
    const result = await getHelpArticles({
      category,
      search,
      featured: featured === 'true',
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    sendSuccess(res, 'Help articles fetched', 200, result);
  } catch (error) {
    logger.error('Get help articles error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/articles/:slug:
 *   get:
 *     summary: Get help article by slug
 *     tags: [Help Center]
 */
router.get('/articles/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  try {
    const article = await getHelpArticle(slug);
    if (!article) {
      return sendError(res, 'Article not found', 404);
    }
    sendSuccess(res, 'Article fetched', 200, article);
  } catch (error) {
    logger.error('Get article error', { error: error.message, slug });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/categories:
 *   get:
 *     summary: Get article categories
 *     tags: [Help Center]
 */
router.get('/categories', asyncHandler(async (req, res) => {
  try {
    const categories = await getCategories();
    sendSuccess(res, 'Categories fetched', 200, categories);
  } catch (error) {
    logger.error('Get categories error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/articles/:id/helpful:
 *   post:
 *     summary: Mark article as helpful
 *     tags: [Help Center]
 */
router.post('/articles/:id/helpful', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { helpful = true } = req.body;

  try {
    await markHelpful(id, helpful);
    sendSuccess(res, 'Feedback recorded', 200);
  } catch (error) {
    logger.error('Mark helpful error', { error: error.message, id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/tickets:
 *   post:
 *     summary: Create support ticket
 *     tags: [Help Center]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets', auth, asyncHandler(async (req, res) => {
  const { subject, description, category, priority } = req.body;

  if (!subject || !description) {
    return sendError(res, 'Subject and description are required', 400);
  }

  try {
    const ticket = await createSupportTicket(req.user._id, {
      subject,
      description,
      category: category || 'other',
      priority: priority || 'medium',
    });
    sendSuccess(res, 'Ticket created', 201, ticket);
  } catch (error) {
    logger.error('Create ticket error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/tickets:
 *   get:
 *     summary: Get user support tickets
 *     tags: [Help Center]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tickets', auth, asyncHandler(async (req, res) => {
  const { status, limit = 20, skip = 0 } = req.query;

  try {
    const result = await getUserTickets(req.user._id, {
      status,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
    sendSuccess(res, 'Tickets fetched', 200, result);
  } catch (error) {
    logger.error('Get tickets error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/tickets/:id/messages:
 *   post:
 *     summary: Add message to ticket
 *     tags: [Help Center]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets/:id/messages', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message, attachments = [] } = req.body;

  if (!message) {
    return sendError(res, 'Message is required', 400);
  }

  try {
    const ticket = await addTicketMessage(id, req.user._id, message, attachments);
    sendSuccess(res, 'Message added', 200, ticket);
  } catch (error) {
    logger.error('Add message error', { error: error.message, ticketId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/tickets/:id/status:
 *   put:
 *     summary: Update ticket status
 *     tags: [Help Center]
 *     security:
 *       - bearerAuth: []
 */
router.put('/tickets/:id/status', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return sendError(res, 'Status is required', 400);
  }

  try {
    const ticket = await updateTicketStatus(id, status, req.user._id);
    sendSuccess(res, 'Status updated', 200, ticket);
  } catch (error) {
    logger.error('Update status error', { error: error.message, ticketId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/ai-search:
 *   get:
 *     summary: AI-powered article search
 *     tags: [Help Center]
 */
router.get('/ai-search', asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return sendError(res, 'Query must be at least 2 characters', 400);
  }

  try {
    const results = await aiSearch(q, req.user?._id);
    sendSuccess(res, 'AI search completed', 200, results);
  } catch (error) {
    logger.error('AI search error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/articles/:id/recommendations:
 *   get:
 *     summary: Get article recommendations
 *     tags: [Help Center]
 */
router.get('/articles/:id/recommendations', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const recommendations = await getArticleRecommendations(id, req.user?._id);
    sendSuccess(res, 'Recommendations fetched', 200, recommendations);
  } catch (error) {
    logger.error('Get recommendations error', { error: error.message, articleId: id });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/help/suggestions:
 *   get:
 *     summary: Get personalized help suggestions
 *     tags: [Help Center]
 *     security:
 *       - bearerAuth: []
 */
router.get('/suggestions', auth, asyncHandler(async (req, res) => {
  const { context } = req.query;

  try {
    const suggestions = await getPersonalizedSuggestions(
      req.user._id,
      context ? JSON.parse(context) : {}
    );
    sendSuccess(res, 'Suggestions fetched', 200, suggestions);
  } catch (error) {
    logger.error('Get suggestions error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

