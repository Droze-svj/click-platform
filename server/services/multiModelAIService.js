// Multi-Model AI Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const {
  AppError,
  ServiceUnavailableError,
  recoveryStrategies,
} = require('../utils/errorHandler');
const { generateWithFreeModel } = require('./freeAIModelService');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

function withAgentSpan(agentName, fn, modelGetter) {
  return async (...args) => {
    if (!Sentry || typeof Sentry.startSpan !== 'function') {
      return fn(...args);
    }
    const model = typeof modelGetter === 'function' ? modelGetter(...args) : (modelGetter || 'gemini-1.5-flash');
    return Sentry.startSpan(
      {
        op: 'gen_ai.invoke_agent',
        name: `invoke_agent ${agentName}`,
        attributes: {
          'gen_ai.agent.name': agentName,
          'gen_ai.request.model': model || 'gemini-1.5-flash',
          'gen_ai.operation.name': 'invoke_agent',
        },
      },
      () => fn(...args)
    );
  };
}

// AI Provider configurations
// Click is configured for Gemini-only AI. OpenAI and Anthropic providers are
// intentionally absent from this map — re-adding them requires updating the
// generateWithModel pipeline (which currently calls geminiGenerate directly)
// and removing the AI_GEMINI_ONLY guards in utils/openai.js.
const AI_PROVIDERS = {
  google: {
    name: 'Google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-1.5-flash',
  },
};

let currentProvider = 'google';
let currentModel = 'gemini-1.5-flash';

/**
 * Initialize AI provider
 */
function initAIProvider(provider = 'google', model = null) {
  try {
    if (provider !== 'google') {
      logger.warn(`Provider "${provider}" requested but Click is Gemini-only — coercing to google`);
    }
    currentProvider = 'google';
    currentModel = model || AI_PROVIDERS.google.defaultModel;

    logger.info('AI provider initialized', { provider: currentProvider, model: currentModel });
    return { provider: currentProvider, model: currentModel };
  } catch (error) {
    logger.error('Init AI provider error', { error: error.message, provider });
    throw new ServiceUnavailableError(`AI Provider (${provider})`);
  }
}

/**
 * Select best model for task
 */
function selectModelForTask(taskType, options = {}) {
  try {
    const {
      complexity = 'medium',
      speed = 'balanced',
      cost = 'balanced',
    } = options;

    const modelSelection = {
      'content-generation': {
        high: 'gemini-1.5-flash',
        medium: 'gemini-1.5-flash',
        low: 'gemini-1.5-flash',
      },
      'content-analysis': {
        high: 'gemini-1.5-flash',
        medium: 'gemini-1.5-flash',
        low: 'gemini-1.5-flash',
      },
      'summarization': {
        high: 'gemini-1.5-flash',
        medium: 'gemini-1.5-flash',
        low: 'gemini-1.5-flash',
      },
      'translation': {
        high: 'gemini-1.5-flash',
        medium: 'gemini-1.5-flash',
        low: 'gemini-1.5-flash',
      },
    };

    const taskModels = modelSelection[taskType] || modelSelection['content-generation'];
    const complexityLevel = complexity === 'high' ? 'high' : complexity === 'low' ? 'low' : 'medium';

    return taskModels[complexityLevel];
  } catch (error) {
    logger.error('Select model for task error', { error: error.message, taskType });
    return 'gemini-1.5-flash';
  }
}

/**
 * Generate content with model selection
 */
async function generateWithModel(prompt, taskType, options = {}) {
  try {
    const model = options.model || selectModelForTask(taskType, options);

    if (!geminiConfigured) {
      throw new ServiceUnavailableError('AI (Google Gemini)');
    }

    const systemPrompt = getSystemPromptForTask(taskType);
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const content = await retryWithBackoff(
      async () => geminiGenerate(fullPrompt, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 2000,
      }),
      {
        maxRetries: 3,
        initialDelay: 1000,
        retryableErrors: [429, 503, 500],
        onRetry: (attempt, delay) => {
          logger.warn(`Retrying AI generation (attempt ${attempt})`, { delay });
        },
      }
    );

    return {
      content,
      model: currentModel,
      provider: currentProvider,
      tokens: 0,
    };
  } catch (error) {
    logger.error('Generate with model error', { error: error.message, taskType });

    // Handle OpenAI API errors
    if (error.response?.status === 429) {
      throw new AppError('AI API rate limit exceeded. Please try again later.', 429);
    }
    if (error.response?.status === 503) {
      throw new ServiceUnavailableError('AI Service');
    }
    if (error.response?.status === 401) {
      throw new AppError('AI API authentication failed. Please check API key.', 401);
    }

    throw new AppError('Failed to generate content. Please try again.', 500);
  }
}

/**
 * Get system prompt for task
 */
function getSystemPromptForTask(taskType) {
  const prompts = {
    'content-generation': 'You are a creative content writer. Generate engaging, original content.',
    'content-analysis': 'You are a content analyst. Analyze content and provide insights.',
    'summarization': 'You are a summarization expert. Create concise, informative summaries.',
    'translation': 'You are a professional translator. Translate accurately while maintaining tone.',
    'ideation': 'You are a creative strategist. Generate innovative ideas and suggestions.',
  };

  return prompts[taskType] || prompts['content-generation'];
}

/**
 * Compare model outputs
 */
async function compareModelOutputs(prompt, taskType, models = ['gemini-1.5-pro', 'gemini-1.5-flash']) {
  try {
    const outputs = [];

    for (const model of models) {
      try {
        const result = await generateWithModel(prompt, taskType, { model });
        outputs.push({
          model,
          content: result.content,
          tokens: result.tokens,
          success: true,
        });
      } catch (error) {
        outputs.push({
          model,
          error: error.message,
          success: false,
        });
      }
    }

    logger.info('Model outputs compared', { taskType, models: models.length });
    return {
      prompt,
      taskType,
      outputs,
      bestModel: outputs.find(o => o.success)?.model || null,
    };
  } catch (error) {
    logger.error('Compare model outputs error', { error: error.message });
    throw error;
  }
}

/**
 * Get available models
 */
function getAvailableModels() {
  return {
    providers: Object.keys(AI_PROVIDERS).map(key => ({
      id: key,
      name: AI_PROVIDERS[key].name,
      models: AI_PROVIDERS[key].models,
      defaultModel: AI_PROVIDERS[key].defaultModel,
    })),
    currentProvider,
    currentModel,
  };
}

module.exports = {
  initAIProvider,
  selectModelForTask,
  generateWithModel: withAgentSpan('Multi-Model Generation Agent', generateWithModel, (_prompt, _taskType, options = {}) => options.model || currentModel || 'gemini-1.5-flash'),
  compareModelOutputs: withAgentSpan('Model Comparison Agent', compareModelOutputs, () => currentModel || 'gemini-1.5-flash'),
  getAvailableModels,
};

