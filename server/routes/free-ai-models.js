// Free AI Models API Routes
// Endpoints for managing free AI model providers

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');

const {
  getAvailableModels,
  generateWithFreeModel,
  getLearningInsights,
  FREE_AI_PROVIDERS,
} = require('../services/freeAIModelService');

const {
  validateAPIKey,
  getAllKeysStatus,
  getProviderLimits,
  getAllProviderLimits,
} = require('../services/freeAIModelKeyManager');

const {
  getUsage,
  getAllUsage,
} = require('../services/freeAIModelRateLimiter');

const {
  getBestModelForTask,
  getLearningInsights: getAILearningInsights,
} = require('../services/aiModelLearningService');

/**
 * GET /api/free-ai-models/providers
 * Get all available providers and their limits
 */
router.get('/providers', auth, asyncHandler(async (req, res) => {
  const limits = getAllProviderLimits();
  const keysStatus = await getAllKeysStatus();
  const usage = getAllUsage();

  const providers = Object.keys(FREE_AI_PROVIDERS).map(provider => ({
    id: provider,
    name: FREE_AI_PROVIDERS[provider].name,
    limits: limits[provider],
    keyStatus: keysStatus[provider],
    usage: usage[provider],
  }));

  return sendSuccess(res, { providers });
}));

/**
 * GET /api/free-ai-models/providers/:provider/models
 * Get available models for a provider
 */
router.get('/providers/:provider/models', auth, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const models = getAvailableModels(provider);

  if (models.length === 0) {
    return sendError(res, `No models found for provider '${provider}'`, 404);
  }

  return sendSuccess(res, { provider, models });
}));

/**
 * POST /api/free-ai-models/validate-key
 * Validate an API key for a provider
 */
router.post('/validate-key', auth, asyncHandler(async (req, res) => {
  const { provider, apiKey } = req.body;

  if (!provider || !apiKey) {
    return sendError(res, 'Provider and API key are required', 400);
  }

  const validation = await validateAPIKey(provider, apiKey);

  return sendSuccess(res, validation);
}));

/**
 * GET /api/free-ai-models/usage
 * Get usage statistics for all providers
 */
router.get('/usage', auth, asyncHandler(async (req, res) => {
  const usage = getAllUsage();
  return sendSuccess(res, { usage });
}));

/**
 * GET /api/free-ai-models/usage/:provider
 * Get usage statistics for a specific provider
 */
router.get('/usage/:provider', auth, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const usage = getUsage(provider);

  if (!usage) {
    return sendError(res, `Provider '${provider}' not found`, 404);
  }

  return sendSuccess(res, { usage });
}));

/**
 * GET /api/free-ai-models/best-model/:taskType
 * Get best model for a task type based on learning
 */
router.get('/best-model/:taskType', auth, asyncHandler(async (req, res) => {
  const { taskType } = req.params;
  const { provider, minUsageCount, minQualityScore } = req.query;

  const best = await getBestModelForTask(taskType, {
    provider: provider || null,
    minUsageCount: minUsageCount ? parseInt(minUsageCount) : 10,
    minQualityScore: minQualityScore ? parseFloat(minQualityScore) : 0.5,
  });

  return sendSuccess(res, { best });
}));

/**
 * GET /api/free-ai-models/learning-insights
 * Get learning insights and recommendations
 */
router.get('/learning-insights', auth, asyncHandler(async (req, res) => {
  const { provider, taskType, days } = req.query;

  const insights = await getAILearningInsights({
    provider: provider || null,
    taskType: taskType || null,
    days: days ? parseInt(days) : 30,
  });

  return sendSuccess(res, { insights });
}));

/**
 * POST /api/free-ai-models/generate
 * Generate content using free AI model
 */
router.post('/generate', auth, asyncHandler(async (req, res) => {
  const {
    prompt,
    provider = 'openrouter',
    model = null,
    taskType = 'content-generation',
    temperature = 0.7,
    maxTokens = 2000,
  } = req.body;

  if (!prompt) {
    return sendError(res, 'Prompt is required', 400);
  }

  const result = await generateWithFreeModel(prompt, {
    provider,
    model,
    taskType,
    temperature,
    maxTokens,
    userId: req.user.id,
  });

  return sendSuccess(res, { result });
}));

/**
 * GET /api/free-ai-models/keys/status
 * Get status of all API keys
 */
router.get('/keys/status', auth, asyncHandler(async (req, res) => {
  const status = await getAllKeysStatus();
  return sendSuccess(res, { keys: status });
}));

module.exports = router;


