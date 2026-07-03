// Multi-Model AI Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const {
  AppError,
  ServiceUnavailableError,
  recoveryStrategies,
} = require('../utils/errorHandler');
const { generateWithFreeModel } = require('./freeAIModelService');
const { buildSystemPrompt } = require('./marketingKnowledge');
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
    const model = typeof modelGetter === 'function' ? modelGetter(...args) : (modelGetter || 'gemini-2.5-flash');
    return Sentry.startSpan(
      {
        op: 'gen_ai.invoke_agent',
        name: `invoke_agent ${agentName}`,
        attributes: {
          'gen_ai.agent.name': agentName,
          'gen_ai.request.model': model || 'gemini-2.5-flash',
          'gen_ai.operation.name': 'invoke_agent',
        },
      },
      () => fn(...args)
    );
  };
}

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
// Provider/model are process-wide reporting DEFAULTS, not per-request state.
// Previously `let currentProvider/currentModel` were WRITTEN per request by
// initAIProvider and read by other concurrent requests — a cross-request/tenant
// bleed. Generation always routes through Gemini (geminiGenerate) regardless of
// these, so they only ever fed response metadata; make them immutable constants.
const DEFAULT_PROVIDER = 'google';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Initialize AI provider. Pure: resolves the requested provider/model and returns
 * it WITHOUT mutating any shared state (so it can't leak into another request).
 */
function initAIProvider(provider = 'google', model = null) {
  try {
    let resolvedModel;
    if (provider === 'anthropic') {
      resolvedModel = model || AI_PROVIDERS.anthropic.defaultModel;
    } else {
      resolvedModel = model || DEFAULT_MODEL;
    }

    logger.info('AI provider initialized', { provider, model: resolvedModel });
    return { provider, model: resolvedModel };
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
        high: 'gemini-2.5-flash',
        medium: 'gemini-2.5-flash',
        low: 'gemini-2.5-flash',
      },
      'content-analysis': {
        high: 'gemini-2.5-flash',
        medium: 'gemini-2.5-flash',
        low: 'gemini-2.5-flash',
      },
      'summarization': {
        high: 'gemini-2.5-flash',
        medium: 'gemini-2.5-flash',
        low: 'gemini-2.5-flash',
      },
      'translation': {
        high: 'gemini-2.5-flash',
        medium: 'gemini-2.5-flash',
        low: 'gemini-2.5-flash',
      },
    };

    const taskModels = modelSelection[taskType] || modelSelection['content-generation'];
    const complexityLevel = complexity === 'high' ? 'high' : complexity === 'low' ? 'low' : 'medium';

    return taskModels[complexityLevel];
  } catch (error) {
    logger.error('Select model for task error', { error: error.message, taskType });
    return 'gemini-2.5-flash';
  }
}

const { retry } = require('../utils/retry');

/**
 * Generate content with model selection
 */
async function generateWithModel(prompt, taskType, options = {}) {
  try {
    const model = options.model || selectModelForTask(taskType, options);

    if (!geminiConfigured) {
      throw new ServiceUnavailableError('AI (Google Gemini)');
    }

    let systemPrompt = getSystemPromptForTask(taskType);
    if (options.userId || options.niche || options.platform) {
      // Pull fully contextualized user demands and styles directly from marketingKnowledge
      systemPrompt = await buildSystemPrompt({
        userId: options.userId || 'anonymous-user',
        niche: options.niche || 'general',
        platform: options.platform || 'youtube',
        contentType: taskType,
        tone: options.tone,
        customPrompt: options.customPrompt
      });
    }

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const content = await retry(
      async () => geminiGenerate(fullPrompt, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 2000,
      }),
      {
        maxRetries: 3,
        initialDelay: 1000,
        onRetry: (error, attempt, delay) => {
          logger.warn(`Retrying AI generation (attempt ${attempt})`, { delay, error: error.message });
        },
      }
    );

    return {
      content,
      model,
      provider: DEFAULT_PROVIDER, // generation always routes through Gemini
      tokens: 0, // Gemini tokens are tracked in Sentry spans within googleAI.js
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

  const antiHallucinationGuardrail = '\n\nCRITICAL INSTRUCTIONS:\n- DO NOT hallucinate. Base your response strictly on the provided context.\n- DO NOT invent features, facts, or statistics that are not explicitly stated.\n- AVOID repetitive phrasing and redundant loops. Ensure diverse and natural vocabulary.';

  return (prompts[taskType] || prompts['content-generation']) + antiHallucinationGuardrail;
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
    currentProvider: DEFAULT_PROVIDER,
    currentModel: DEFAULT_MODEL,
  };
}

module.exports = {
  initAIProvider,
  selectModelForTask,
  generateWithModel: withAgentSpan('Multi-Model Generation Agent', generateWithModel, (_prompt, _taskType, options = {}) => options.model || DEFAULT_MODEL),
  compareModelOutputs: withAgentSpan('Model Comparison Agent', compareModelOutputs, () => DEFAULT_MODEL),
  getAvailableModels,
};

