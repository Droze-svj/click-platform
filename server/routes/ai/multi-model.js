// Multi-Model AI Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  initAIProvider,
  selectModelForTask,
  generateWithModel,
  compareModelOutputs,
  getAvailableModels,
} = require('../../services/multiModelAIService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const {
  ValidationError,
  AppError,
} = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const router = express.Router();

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
  if (!prompt || !taskType) {
    throw new ValidationError('Prompt and task type are required', [
      { field: 'prompt', message: 'Prompt is required' },
      { field: 'taskType', message: 'Task type is required' },
    ]);
  }
  
  const result = await generateWithModel(prompt, taskType, options || {});
  sendSuccess(res, 'Content generated', 200, result);
}));

router.post('/compare', auth, asyncHandler(async (req, res) => {
  const { prompt, taskType, models } = req.body;
  if (!prompt || !taskType) {
    throw new ValidationError('Prompt and task type are required', [
      { field: 'prompt', message: 'Prompt is required' },
      { field: 'taskType', message: 'Task type is required' },
    ]);
  }
  
  const result = await compareModelOutputs(prompt, taskType, models || ['gpt-4', 'gpt-3.5-turbo']);
  sendSuccess(res, 'Model outputs compared', 200, result);
}));

router.get('/models', auth, asyncHandler(async (req, res) => {
  try {
    const models = getAvailableModels();
    sendSuccess(res, 'Available models fetched', 200, models);
  } catch (error) {
    logger.error('Get available models error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;

