// Multi-Model AI Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { aiLimiter } = require('../../middleware/enhancedRateLimiter');
const {
  initAIProvider,
  generateWithModel,
  compareModelOutputs,
  getAvailableModels,
} = require('../../services/multiModelAIService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const {
  ValidationError,
} = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const router = express.Router();

// Paid LLM calls — the router had no rate limit, and /compare fans out one call
// per entry in a fully attacker-supplied `models` array. Rate-limit POSTs.
router.use((req, res, next) => (req.method === 'POST' ? aiLimiter(req, res, next) : next()));
const MAX_COMPARE_MODELS = 4;

router.post('/provider', auth, asyncHandler(async (req, res) => {
  const { provider, model } = req.body;
  try {
    const result = initAIProvider(provider || 'openai', model);
    sendSuccess(res, 'AI provider initialized', 200, result);
  } catch (error) {
    logger.error('Init AI provider error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/generate', auth, asyncHandler(async (req, res) => {
  const { prompt, taskType, options } = req.body;
  if (!prompt || !taskType || typeof prompt !== 'string' || typeof taskType !== 'string') {
    throw new ValidationError('Prompt and task type are required strings', [
      { field: 'prompt', message: 'Prompt is required as a string' },
      { field: 'taskType', message: 'Task type is required as a string' },
    ]);
  }
  
  const result = await generateWithModel(prompt, taskType, options || {});
  sendSuccess(res, 'Content generated', 200, result);
}));

router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { prompt, taskType, models } = req.body;
  if (!prompt || !taskType || typeof prompt !== 'string' || typeof taskType !== 'string') {
    throw new ValidationError('Prompt and task type are required strings', [
      { field: 'prompt', message: 'Prompt is required as a string' },
      { field: 'taskType', message: 'Task type is required as a string' },
    ]);
  }
  
  // Cap the fan-out: one LLM call per model, so an unbounded array is a cost bomb.
  const requested = Array.isArray(models) && models.length ? models : ['gpt-4', 'gpt-3.5-turbo'];
  const result = await compareModelOutputs(prompt, taskType, requested.slice(0, MAX_COMPARE_MODELS));
  sendSuccess(res, 'Model outputs compared', 200, result);
}));

router.get('/models', auth, asyncHandler(async (req, res) => {
  try {
    const models = getAvailableModels();
    sendSuccess(res, 'Available models fetched', 200, models || {
      providers: [],
      currentProvider: null,
      currentModel: null
    });
  } catch (error) {
    logger.error('Get available models error', { error: error.message });
    sendSuccess(res, 'Available models fetched', 200, {
      providers: [],
      currentProvider: null,
      currentModel: null
    });
  }
}));

module.exports = router;

