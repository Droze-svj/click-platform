// Multi-Model AI Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');
const {
  AppError,
  ServiceUnavailableError,
  recoveryStrategies,
} = require('../utils/errorHandler');
const { generateWithFreeModel } = require('./freeAIModelService');

// AI Provider configurations
const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    defaultModel: 'claude-3-sonnet',
  },
  google: {
    name: 'Google',
    models: ['gemini-pro', 'gemini-ultra'],
    defaultModel: 'gemini-pro',
  },
};

let openaiClient = null;
let currentProvider = 'openai';
let currentModel = 'gpt-4';

/**
 * Initialize AI provider
 */
function initAIProvider(provider = 'openai', model = null) {
  try {
    currentProvider = provider;

    if (provider === 'openai') {
      openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      currentModel = model || AI_PROVIDERS.openai.defaultModel;
    } else if (provider === 'anthropic') {
      // In production, initialize Anthropic client
      currentModel = model || AI_PROVIDERS.anthropic.defaultModel;
    } else if (provider === 'google') {
      // In production, initialize Google client
      currentModel = model || AI_PROVIDERS.google.defaultModel;
    }

    logger.info('AI provider initialized', { provider, model: currentModel });
    return { provider, model: currentModel };
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
        high: 'gpt-4',
        medium: 'gpt-4-turbo',
        low: 'gpt-3.5-turbo',
      },
      'content-analysis': {
        high: 'gpt-4',
        medium: 'gpt-4-turbo',
        low: 'gpt-3.5-turbo',
      },
      'summarization': {
        high: 'gpt-4-turbo',
        medium: 'gpt-3.5-turbo',
        low: 'gpt-3.5-turbo',
      },
      'translation': {
        high: 'gpt-4',
        medium: 'gpt-3.5-turbo',
        low: 'gpt-3.5-turbo',
      },
    };

    const taskModels = modelSelection[taskType] || modelSelection['content-generation'];
    const complexityLevel = complexity === 'high' ? 'high' : complexity === 'low' ? 'low' : 'medium';

    return taskModels[complexityLevel];
  } catch (error) {
    logger.error('Select model for task error', { error: error.message, taskType });
    return 'gpt-4';
  }
}

/**
 * Generate content with model selection
 */
async function generateWithModel(prompt, taskType, options = {}) {
  try {
    const model = options.model || selectModelForTask(taskType, options);
    
    if (!openaiClient) {
      initAIProvider('openai', model);
    }

    // Retry with exponential backoff for transient errors
    const response = await retryWithBackoff(
      async () => {
        return await openaiClient.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: getSystemPromptForTask(taskType),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
        });
      },
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
      content: response.choices[0].message.content,
      model,
      provider: currentProvider,
      tokens: response.usage?.total_tokens || 0,
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
async function compareModelOutputs(prompt, taskType, models = ['gpt-4', 'gpt-3.5-turbo']) {
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
  generateWithModel,
  compareModelOutputs,
  getAvailableModels,
};

