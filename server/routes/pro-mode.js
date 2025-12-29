// Pro Mode Routes
// Advanced filters, keyboard shortcuts, configuration

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  getUserPreferences,
  toggleProMode,
  saveAdvancedFilter,
  getAdvancedFilters,
  saveKeyboardShortcut,
  getKeyboardShortcuts,
  updateConfiguration,
  getConfiguration
} = require('../services/proModeService');
const {
  getCommandPalette,
  searchCommands,
  executeCommand,
  advancedSearch,
  createAutomationRule,
  createCustomDashboard
} = require('../services/proModeEnhancementService');
const { executeAutomationRule, triggerByEvent } = require('../services/automationService');
const AutomationRule = require('../models/AutomationRule');
const router = express.Router();

/**
 * GET /api/pro-mode/preferences
 * Get user preferences
 */
router.get('/preferences', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const preferences = await getUserPreferences(userId);
  sendSuccess(res, 'Preferences retrieved', 200, preferences);
}));

/**
 * POST /api/pro-mode/toggle
 * Toggle pro mode
 */
router.post('/toggle', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { enabled } = req.body;
  const preferences = await toggleProMode(userId, enabled);
  sendSuccess(res, 'Pro mode toggled', 200, preferences);
}));

/**
 * POST /api/pro-mode/filters
 * Save advanced filter
 */
router.post('/filters', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, filters, isDefault } = req.body;

  if (!name || !filters) {
    return sendError(res, 'Name and filters are required', 400);
  }

  const preferences = await saveAdvancedFilter(userId, { name, filters, isDefault });
  sendSuccess(res, 'Filter saved', 200, preferences);
}));

/**
 * GET /api/pro-mode/filters
 * Get advanced filters
 */
router.get('/filters', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const filters = await getAdvancedFilters(userId);
  sendSuccess(res, 'Filters retrieved', 200, filters);
}));

/**
 * POST /api/pro-mode/shortcuts
 * Save keyboard shortcut
 */
router.post('/shortcuts', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { key, action, description } = req.body;

  if (!key || !action) {
    return sendError(res, 'Key and action are required', 400);
  }

  const preferences = await saveKeyboardShortcut(userId, { key, action, description });
  sendSuccess(res, 'Shortcut saved', 200, preferences);
}));

/**
 * GET /api/pro-mode/shortcuts
 * Get keyboard shortcuts
 */
router.get('/shortcuts', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const shortcuts = await getKeyboardShortcuts(userId);
  sendSuccess(res, 'Shortcuts retrieved', 200, shortcuts);
}));

/**
 * PUT /api/pro-mode/configuration/:category
 * Update configuration
 */
router.put('/configuration/:category', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { category } = req.params;
  const preferences = await updateConfiguration(userId, category, req.body);
  sendSuccess(res, 'Configuration updated', 200, preferences);
}));

/**
 * GET /api/pro-mode/configuration
 * Get configuration
 */
router.get('/configuration', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const configuration = await getConfiguration(userId);
  sendSuccess(res, 'Configuration retrieved', 200, configuration);
}));

/**
 * GET /api/pro-mode/command-palette
 * Get command palette
 */
router.get('/command-palette', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const palette = await getCommandPalette(userId);
  sendSuccess(res, 'Command palette retrieved', 200, palette);
}));

/**
 * GET /api/pro-mode/command-palette/search
 * Search commands
 */
router.get('/command-palette/search', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { q } = req.query;
  const commands = await searchCommands(userId, q);
  sendSuccess(res, 'Commands found', 200, { commands });
}));

/**
 * POST /api/pro-mode/command-palette/execute
 * Execute command
 */
router.post('/command-palette/execute', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { commandId } = req.body;
  if (!commandId) {
    return sendError(res, 'Command ID is required', 400);
  }
  const result = await executeCommand(userId, commandId);
  sendSuccess(res, 'Command executed', 200, result);
}));

/**
 * POST /api/pro-mode/search/advanced
 * Advanced search
 */
router.post('/search/advanced', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const results = await advancedSearch(userId, req.body);
  sendSuccess(res, 'Search completed', 200, results);
}));

/**
 * POST /api/pro-mode/automation
 * Create automation rule
 */
router.post('/automation', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const rule = await createAutomationRule(userId, req.body);
  sendSuccess(res, 'Automation rule created', 201, rule);
}));

/**
 * POST /api/pro-mode/dashboards
 * Create custom dashboard
 */
router.post('/dashboards', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const dashboard = await createCustomDashboard(userId, req.body);
  sendSuccess(res, 'Dashboard created', 201, dashboard);
}));

/**
 * GET /api/pro-mode/automation
 * Get automation rules
 */
router.get('/automation', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const rules = await AutomationRule.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  sendSuccess(res, 'Automation rules retrieved', 200, { rules });
}));

/**
 * POST /api/pro-mode/automation
 * Create automation rule
 */
router.post('/automation', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { name, description, trigger, conditions, actions } = req.body;

  if (!name || !trigger || !actions || actions.length === 0) {
    return sendError(res, 'Name, trigger, and actions are required', 400);
  }

  const rule = new AutomationRule({
    userId,
    name,
    description,
    trigger,
    conditions: conditions || [],
    actions
  });

  await rule.save();
  sendSuccess(res, 'Automation rule created', 201, rule);
}));

/**
 * POST /api/pro-mode/automation/:ruleId/execute
 * Execute automation rule
 */
router.post('/automation/:ruleId/execute', auth, asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const userId = req.user._id;
  
  // Verify ownership
  const rule = await AutomationRule.findById(ruleId);
  if (!rule || rule.userId.toString() !== userId.toString()) {
    return sendError(res, 'Rule not found', 404);
  }

  const result = await executeAutomationRule(ruleId, req.body.context || {});
  sendSuccess(res, 'Automation executed', 200, result);
}));

/**
 * PUT /api/pro-mode/automation/:ruleId/toggle
 * Toggle automation rule
 */
router.put('/automation/:ruleId/toggle', auth, asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const userId = req.user._id;
  
  const rule = await AutomationRule.findOne({ _id: ruleId, userId });
  if (!rule) {
    return sendError(res, 'Rule not found', 404);
  }

  rule.enabled = !rule.enabled;
  await rule.save();
  sendSuccess(res, 'Rule toggled', 200, rule);
}));

module.exports = router;

