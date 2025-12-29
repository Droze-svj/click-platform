// Enhanced Pricing Routes
// Usage-based tiers, agency plans, cancellation, refunds, support

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UsageBasedTier = require('../models/UsageBasedTier');
const AgencyScalePlan = require('../models/AgencyScalePlan');
const { requestCancellation, getCancellationStatus } = require('../services/selfServeCancellationService');
const { createBillingTicket, respondToTicket, getUserTickets, getTicket, resolveTicket } = require('../services/billingSupportService');
const { getUserUsageSummary, checkUsageLimits } = require('../services/usageTrackingService');
const { forecastUsage, getUsageAlerts } = require('../services/usageForecastingService');
const { getWinBackOffer, pauseSubscription, resumeSubscription, applyWinBackOffer } = require('../services/cancellationImprovementService');
const { calculateCost, calculateROI, compareTiers, calculateAgencyCostPerClient } = require('../services/pricingCalculatorService');
const { getUserBillingHistory, getBillingSummary, getInvoice, downloadInvoicePDF, requestInvoiceCorrection } = require('../services/billingHistoryService');
const router = express.Router();

/**
 * GET /api/pricing/tiers
 * Get all usage-based tiers
 */
router.get('/tiers', asyncHandler(async (req, res) => {
  const tiers = await UsageBasedTier.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .lean();

  sendSuccess(res, 'Tiers retrieved', 200, { tiers });
}));

/**
 * GET /api/pricing/tiers/:slug
 * Get specific tier
 */
router.get('/tiers/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const tier = await UsageBasedTier.findOne({ slug, isActive: true }).lean();

  if (!tier) {
    return sendError(res, 'Tier not found', 404);
  }

  sendSuccess(res, 'Tier retrieved', 200, tier);
}));

/**
 * GET /api/pricing/agency-plans
 * Get agency scale plans
 */
router.get('/agency-plans', asyncHandler(async (req, res) => {
  const plans = await AgencyScalePlan.find({ isActive: true })
    .sort({ displayOrder: 1 })
    .lean();

  sendSuccess(res, 'Agency plans retrieved', 200, { plans });
}));

/**
 * GET /api/pricing/agency-plans/:slug
 * Get specific agency plan
 */
router.get('/agency-plans/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const plan = await AgencyScalePlan.findOne({ slug, isActive: true }).lean();

  if (!plan) {
    return sendError(res, 'Plan not found', 404);
  }

  sendSuccess(res, 'Plan retrieved', 200, plan);
}));

/**
 * GET /api/pricing/usage
 * Get user usage summary
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const summary = await getUserUsageSummary(userId);
  sendSuccess(res, 'Usage summary retrieved', 200, summary);
}));

/**
 * POST /api/pricing/usage/check
 * Check usage limits
 */
router.post('/usage/check', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { action } = req.body;

  if (!action) {
    return sendError(res, 'Action is required', 400);
  }

  const result = await checkUsageLimits(userId, action);
  sendSuccess(res, 'Usage limits checked', 200, result);
}));

/**
 * POST /api/pricing/cancel
 * Request cancellation (self-serve)
 */
router.post('/cancel', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cancellation = await requestCancellation(userId, req.body);
  sendSuccess(res, 'Cancellation requested', 200, cancellation);
}));

/**
 * GET /api/pricing/cancel/status
 * Get cancellation status
 */
router.get('/cancel/status', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const status = await getCancellationStatus(userId);
  sendSuccess(res, 'Cancellation status retrieved', 200, { status });
}));

/**
 * POST /api/support/billing
 * Create billing support ticket
 */
router.post('/support/billing', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const ticket = await createBillingTicket(userId, req.body);
  sendSuccess(res, 'Billing ticket created', 201, ticket);
}));

/**
 * GET /api/support/tickets
 * Get user tickets
 */
router.get('/support/tickets', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const tickets = await getUserTickets(userId, req.query);
  sendSuccess(res, 'Tickets retrieved', 200, { tickets });
}));

/**
 * GET /api/support/tickets/:ticketId
 * Get specific ticket
 */
router.get('/support/tickets/:ticketId', auth, asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const ticket = await getTicket(ticketId);

  if (!ticket) {
    return sendError(res, 'Ticket not found', 404);
  }

  // Verify ownership
  if (ticket.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Unauthorized', 403);
  }

  sendSuccess(res, 'Ticket retrieved', 200, ticket);
}));

/**
 * POST /api/support/tickets/:ticketId/respond
 * Respond to ticket
 */
router.post('/support/tickets/:ticketId/respond', auth, asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { text, attachments } = req.body;

  if (!text) {
    return sendError(res, 'Response text is required', 400);
  }

  const ticket = await respondToTicket(ticketId, {
    text,
    from: 'user',
    userId: req.user._id,
    attachments: attachments || []
  });

  sendSuccess(res, 'Response added', 200, ticket);
}));

/**
 * GET /api/pricing/usage/forecast
 * Forecast usage
 */
router.get('/usage/forecast', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = 'month' } = req.query;
  const forecast = await forecastUsage(userId, period);
  sendSuccess(res, 'Usage forecast retrieved', 200, forecast);
}));

/**
 * GET /api/pricing/usage/alerts
 * Get usage alerts
 */
router.get('/usage/alerts', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const alerts = await getUsageAlerts(userId);
  sendSuccess(res, 'Usage alerts retrieved', 200, { alerts });
}));

/**
 * GET /api/pricing/cancel/win-back
 * Get win-back offer
 */
router.get('/cancel/win-back', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const offer = await getWinBackOffer(userId);
  sendSuccess(res, 'Win-back offer retrieved', 200, { offer });
}));

/**
 * POST /api/pricing/pause
 * Pause subscription
 */
router.post('/pause', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await pauseSubscription(userId, req.body);
  sendSuccess(res, 'Subscription paused', 200, result);
}));

/**
 * POST /api/pricing/resume
 * Resume subscription
 */
router.post('/resume', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await resumeSubscription(userId);
  sendSuccess(res, 'Subscription resumed', 200, result);
}));

/**
 * POST /api/pricing/win-back/apply
 * Apply win-back offer
 */
router.post('/win-back/apply', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { offerType, offerData } = req.body;
  const result = await applyWinBackOffer(userId, offerType, offerData);
  sendSuccess(res, 'Win-back offer applied', 200, result);
}));

/**
 * POST /api/pricing/calculator
 * Calculate cost
 */
router.post('/calculator', asyncHandler(async (req, res) => {
  const cost = await calculateCost(req.body);
  sendSuccess(res, 'Cost calculated', 200, cost);
}));

/**
 * POST /api/pricing/calculator/roi
 * Calculate ROI
 */
router.post('/calculator/roi', asyncHandler(async (req, res) => {
  const { usageData, businessMetrics } = req.body;
  const roi = await calculateROI(usageData, businessMetrics);
  sendSuccess(res, 'ROI calculated', 200, roi);
}));

/**
 * POST /api/pricing/compare
 * Compare tiers
 */
router.post('/compare', asyncHandler(async (req, res) => {
  const { tierIds } = req.body;
  if (!tierIds || !Array.isArray(tierIds) || tierIds.length < 2) {
    return sendError(res, 'At least 2 tier IDs are required', 400);
  }
  const comparison = await compareTiers(tierIds);
  sendSuccess(res, 'Tiers compared', 200, comparison);
}));

/**
 * POST /api/pricing/agency/cost-per-client
 * Calculate agency cost per client
 */
router.post('/agency/cost-per-client', asyncHandler(async (req, res) => {
  const { planId, clientCount } = req.body;
  if (!planId || !clientCount) {
    return sendError(res, 'Plan ID and client count are required', 400);
  }
  const cost = await calculateAgencyCostPerClient(planId, clientCount);
  sendSuccess(res, 'Cost per client calculated', 200, cost);
}));

/**
 * GET /api/billing/history
 * Get billing history
 */
router.get('/billing/history', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const history = await getUserBillingHistory(userId, req.query);
  sendSuccess(res, 'Billing history retrieved', 200, { history });
}));

/**
 * GET /api/billing/summary
 * Get billing summary
 */
router.get('/billing/summary', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = 'year' } = req.query;
  const summary = await getBillingSummary(userId, period);
  sendSuccess(res, 'Billing summary retrieved', 200, summary);
}));

/**
 * GET /api/billing/invoices/:invoiceNumber
 * Get invoice
 */
router.get('/billing/invoices/:invoiceNumber', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user._id;
  const invoice = await getInvoice(invoiceNumber, userId);
  sendSuccess(res, 'Invoice retrieved', 200, invoice);
}));

/**
 * GET /api/billing/invoices/:invoiceNumber/download
 * Download invoice PDF
 */
router.get('/billing/invoices/:invoiceNumber/download', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user._id;
  const pdf = await downloadInvoicePDF(invoiceNumber, userId);
  sendSuccess(res, 'Invoice PDF ready', 200, pdf);
}));

/**
 * POST /api/billing/invoices/:invoiceNumber/correct
 * Request invoice correction
 */
router.post('/billing/invoices/:invoiceNumber/correct', auth, asyncHandler(async (req, res) => {
  const { invoiceNumber } = req.params;
  const userId = req.user._id;
  const { reason } = req.body;
  if (!reason) {
    return sendError(res, 'Reason is required', 400);
  }
  const result = await requestInvoiceCorrection(invoiceNumber, userId, { reason });
  sendSuccess(res, 'Correction request submitted', 200, result);
}));

module.exports = router;

