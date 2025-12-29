// Free AI Model Service
// Integrates free third-party AI model APIs with continuous learning support

const axios = require('axios');
const logger = require('../utils/logger');
const {
  AppError,
  ServiceUnavailableError,
} = require('../utils/errorHandler');
const { checkRateLimit, recordUsage } = require('./freeAIModelRateLimiter');
const { trackModelUsage } = require('./aiModelLearningService');
const { shouldUseNewVersion, updateRolloutMetrics } = require('./modelVersionGradualRollout');

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    retryableErrors = [429, 503, 500],
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const statusCode = error.response?.status || error.statusCode || 500;
      
      if (attempt === maxRetries || !retryableErrors.includes(statusCode)) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      if (options.onRetry) {
        options.onRetry(attempt + 1, delay);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Free AI Provider configurations
const FREE_AI_PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    freeTier: {
      requestsPerDay: 50,
      models: ['qwen/qwen-2.5-7b-instruct:free', 'google/gemini-flash-1.5:free'],
      requiresAuth: false,
    },
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: {
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://click.app',
      'X-Title': 'Click - AI Content Platform',
    },
  },
  huggingface: {
    name: 'Hugging Face',
    baseUrl: 'https://api-inference.huggingface.co/models',
    freeTier: {
      requestsPerDay: 1000,
      models: [
        'meta-llama/Llama-3.2-3B-Instruct',
        'mistralai/Mistral-7B-Instruct-v0.2',
        'google/gemma-2b-it',
      ],
      requiresAuth: true,
    },
    apiKey: process.env.HUGGINGFACE_API_KEY,
  },
  cerebras: {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    freeTier: {
      tokensPerDay: 1000000,
      models: ['llama-3.1-8b-instruct', 'qwen-2.5-7b-instruct'],
      requiresAuth: false,
    },
    apiKey: process.env.CEREBRAS_API_KEY,
  },
  replicate: {
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    freeTier: {
      credits: 5, // $5 free credits
      models: ['meta/llama-3-8b-instruct', 'mistralai/mistral-7b-instruct-v0.2'],
      requiresAuth: true,
    },
    apiKey: process.env.REPLICATE_API_KEY,
  },
};

// Model learning and version tracking
const modelLearning = {
  // Track model performance
  performance: new Map(),
  // Track model versions
  versions: new Map(),
  // Track usage patterns
  usage: new Map(),
};

/**
 * Initialize free AI provider
 */
function initFreeAIProvider(providerName = 'openrouter') {
  const provider = FREE_AI_PROVIDERS[providerName];
  
  if (!provider) {
    throw new AppError(`Free AI provider '${providerName}' not found`, 400);
  }

  // Check if API key is required and available
  if (provider.freeTier.requiresAuth && !provider.apiKey) {
    logger.warn(`API key not set for ${provider.name}, some features may be limited`);
  }

  logger.info(`Free AI provider initialized: ${provider.name}`);
  return provider;
}

/**
 * Get available models for provider
 */
function getAvailableModels(providerName = 'openrouter') {
  const provider = FREE_AI_PROVIDERS[providerName];
  if (!provider) {
    return [];
  }

  return provider.freeTier.models.map(model => ({
    id: model,
    name: model.split('/').pop() || model,
    provider: providerName,
    free: true,
  }));
}

/**
 * Get best model for task based on learning data
 */
function selectBestModel(taskType, options = {}) {
  const provider = options.provider || 'openrouter';
  const providerConfig = FREE_AI_PROVIDERS[provider];
  
  if (!providerConfig) {
    return providerConfig.freeTier.models[0];
  }

  // Use learning data to select best model
  const taskPerformance = modelLearning.performance.get(taskType) || {};
  const models = providerConfig.freeTier.models;
  
  // Find model with best performance for this task
  let bestModel = models[0];
  let bestScore = 0;

  for (const model of models) {
    const score = taskPerformance[model]?.score || 0;
    if (score > bestScore) {
      bestScore = score;
      bestModel = model;
    }
  }

  return bestModel;
}

/**
 * Generate content using free AI model
 */
async function generateWithFreeModel(prompt, options = {}) {
  const {
    provider = 'openrouter',
    model = null,
    taskType = 'content-generation',
    temperature = 0.7,
    maxTokens = 2000,
    userId = null,
  } = options;

  const providerConfig = initFreeAIProvider(provider);
  let selectedModel = model || selectBestModel(taskType, { provider });

  // Check for gradual rollout
  const currentVersion = await getCurrentVersionFromDB(provider, selectedModel);
  if (currentVersion) {
    // Check if there's an active rollout for a newer version
    const { getRolloutStatus } = require('./modelVersionGradualRollout');
    const rollouts = await getActiveRollouts(provider, selectedModel);
    
    for (const rollout of rollouts) {
      if (shouldUseNewVersion(provider, selectedModel, rollout.toVersion, userId)) {
        selectedModel = `${selectedModel}:${rollout.toVersion}`;
        logger.debug('Using new version from rollout', {
          provider,
          model: selectedModel,
          rolloutPercentage: rollout.currentPercentage,
        });
        break;
      }
    }
  }

  // Check rate limits
  try {
    const rateLimit = checkRateLimit(provider, options);
    logger.debug('Rate limit check passed', { provider, remaining: rateLimit.remaining });
  } catch (rateLimitError) {
    // If rate limited, try fallback provider
    if (rateLimitError.statusCode === 429 && provider !== 'openrouter') {
      logger.warn('Rate limited, falling back to OpenRouter', { provider });
      return generateWithFreeModel(prompt, {
        ...options,
        provider: 'openrouter',
      });
    }
    throw rateLimitError;
  }

  const startTime = Date.now();

  try {
    let response;

    if (provider === 'openrouter') {
      response = await generateWithOpenRouter(prompt, selectedModel, {
        temperature,
        maxTokens,
        providerConfig,
      });
    } else if (provider === 'huggingface') {
      response = await generateWithHuggingFace(prompt, selectedModel, {
        temperature,
        maxTokens,
        providerConfig,
      });
    } else if (provider === 'cerebras') {
      response = await generateWithCerebras(prompt, selectedModel, {
        temperature,
        maxTokens,
        providerConfig,
      });
    } else if (provider === 'replicate') {
      response = await generateWithReplicate(prompt, selectedModel, {
        temperature,
        maxTokens,
        providerConfig,
      });
    } else {
      throw new AppError(`Provider '${provider}' not implemented`, 400);
    }

    const responseTime = Date.now() - startTime;
    const tokensUsed = response.tokens || 0;

    // Record usage for rate limiting
    recordUsage(provider, tokensUsed);

    // Track performance for continuous learning
    trackModelPerformance(taskType, selectedModel, {
      ...response,
      responseTime,
    }, options);

    // Track usage for learning service
    if (userId) {
      try {
        const qualityScore = calculateResponseScore(response, { responseTime });
        
        await trackModelUsage({
          userId,
          provider,
          model: selectedModel,
          taskType,
          prompt,
          response: response.content,
          responseTime,
          tokensUsed,
          qualityScore,
        });

        // Update rollout metrics if in rollout
        const versionMatch = selectedModel.match(/:([^:]+)$/);
        if (versionMatch) {
          const version = versionMatch[1];
          updateRolloutMetrics(provider, selectedModel.split(':')[0], version, {
            success: true,
            qualityScore,
            responseTime,
          });
        }
      } catch (trackError) {
        logger.warn('Failed to track model usage', { error: trackError.message });
      }
    }

    return {
      content: response.content,
      model: selectedModel,
      provider: providerConfig.name,
      tokens: tokensUsed,
      cost: 0, // Free tier
      version: getModelVersion(selectedModel),
      responseTime,
    };
  } catch (error) {
    logger.error('Free AI generation error', {
      error: error.message,
      provider,
      model: selectedModel,
    });

    // Fallback to another provider
    if (provider !== 'openrouter') {
      logger.info('Falling back to OpenRouter');
      return generateWithFreeModel(prompt, {
        ...options,
        provider: 'openrouter',
      });
    }

    throw new ServiceUnavailableError('Free AI Service');
  }
}

/**
 * Generate with OpenRouter
 */
async function generateWithOpenRouter(prompt, model, options) {
  const { providerConfig, temperature, maxTokens } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...providerConfig.headers,
  };

  if (providerConfig.apiKey) {
    headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
  }

  const response = await axios.post(
    `${providerConfig.baseUrl}/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'system',
          content: getSystemPromptForTask(options.taskType),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    },
    { headers, timeout: 30000 }
  );

  return {
    content: response.data.choices[0].message.content,
    tokens: response.data.usage?.total_tokens || 0,
  };
}

/**
 * Generate with Hugging Face
 */
async function generateWithHuggingFace(prompt, model, options) {
  const { providerConfig, maxTokens } = options;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (providerConfig.apiKey) {
    headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
  }

  const response = await axios.post(
    `${providerConfig.baseUrl}/${model}`,
    {
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        return_full_text: false,
      },
    },
    { headers, timeout: 30000 }
  );

  return {
    content: Array.isArray(response.data) 
      ? response.data[0].generated_text 
      : response.data.generated_text,
    tokens: 0, // HF doesn't always return token count
  };
}

/**
 * Generate with Cerebras
 */
async function generateWithCerebras(prompt, model, options) {
  const { providerConfig, temperature, maxTokens } = options;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (providerConfig.apiKey) {
    headers['Authorization'] = `Bearer ${providerConfig.apiKey}`;
  }

  const response = await axios.post(
    `${providerConfig.baseUrl}/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    },
    { headers, timeout: 30000 }
  );

  return {
    content: response.data.choices[0].message.content,
    tokens: response.data.usage?.total_tokens || 0,
  };
}

/**
 * Generate with Replicate
 */
async function generateWithReplicate(prompt, model, options) {
  const { providerConfig, temperature, maxTokens } = options;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Token ${providerConfig.apiKey}`,
  };

  // Replicate uses a different API structure
  const response = await axios.post(
    `${providerConfig.baseUrl}/predictions`,
    {
      version: model, // Replicate uses version IDs
      input: {
        prompt,
        temperature,
        max_length: maxTokens,
      },
    },
    { headers, timeout: 60000 } // Replicate can take longer
  );

  // Replicate is async, poll for result
  let result = response.data;
  while (result.status === 'starting' || result.status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResponse = await axios.get(
      `${providerConfig.baseUrl}/predictions/${result.id}`,
      { headers }
    );
    result = statusResponse.data;
  }

  if (result.status === 'failed') {
    throw new Error(result.error || 'Replicate prediction failed');
  }

  return {
    content: Array.isArray(result.output) 
      ? result.output.join('') 
      : result.output,
    tokens: 0,
  };
}

/**
 * Track model performance for continuous learning
 */
function trackModelPerformance(taskType, model, response, options) {
  if (!modelLearning.performance.has(taskType)) {
    modelLearning.performance.set(taskType, {});
  }

  const taskPerf = modelLearning.performance.get(taskType);
  
  if (!taskPerf[model]) {
    taskPerf[model] = {
      count: 0,
      totalScore: 0,
      score: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
    };
  }

  const modelPerf = taskPerf[model];
  modelPerf.count += 1;
  
  // Calculate score based on response quality (can be enhanced)
  const score = calculateResponseScore(response, options);
  modelPerf.totalScore += score;
  modelPerf.score = modelPerf.totalScore / modelPerf.count;

  // Track response time
  const responseTime = response.responseTime || 0;
  modelPerf.totalResponseTime += responseTime;
  modelPerf.avgResponseTime = modelPerf.totalResponseTime / modelPerf.count;

  logger.debug('Model performance tracked', {
    taskType,
    model,
    score: modelPerf.score,
    count: modelPerf.count,
  });
}

/**
 * Calculate response quality score
 */
function calculateResponseScore(response, options) {
  let score = 0.5; // Base score

  // Score based on content length (not too short, not too long)
  const contentLength = response.content?.length || 0;
  if (contentLength > 50 && contentLength < 5000) {
    score += 0.2;
  }

  // Score based on response time (faster is better, but not too fast)
  if (response.responseTime) {
    if (response.responseTime < 2000) {
      score += 0.2;
    } else if (response.responseTime > 10000) {
      score -= 0.1;
    }
  }

  // Score based on token efficiency
  if (response.tokens && response.content) {
    const tokensPerChar = response.tokens / response.content.length;
    if (tokensPerChar < 0.5) {
      score += 0.1;
    }
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Get current version from database
 */
async function getCurrentVersionFromDB(provider, model) {
  try {
    const ModelVersion = require('../models/ModelVersion');
    const version = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    }).lean();

    return version;
  } catch (error) {
    logger.warn('Get current version from DB error', { error: error.message });
    return null;
  }
}

/**
 * Get active rollouts for model
 */
async function getActiveRollouts(provider, model) {
  try {
    const { getRolloutStatus } = require('./modelVersionGradualRollout');
    // This would need to be enhanced to get all active rollouts
    // For now, return empty array
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Get model version information
 */
function getModelVersion(model) {
  if (!modelLearning.versions.has(model)) {
    modelLearning.versions.set(model, {
      current: '1.0.0',
      history: [],
      lastUpdated: new Date(),
    });
  }

  return modelLearning.versions.get(model);
}

/**
 * Update model version (for continuous learning)
 */
function updateModelVersion(model, newVersion, improvements = []) {
  const versionInfo = getModelVersion(model);
  const oldVersion = versionInfo.current;

  versionInfo.history.push({
    version: oldVersion,
    updated: new Date(),
    improvements,
  });

  versionInfo.current = newVersion;
  versionInfo.lastUpdated = new Date();

  logger.info('Model version updated', {
    model,
    oldVersion,
    newVersion,
    improvements,
  });
}

/**
 * Get system prompt for task
 */
function getSystemPromptForTask(taskType) {
  const prompts = {
    'content-generation': 'You are a creative content writer specializing in social media content.',
    'caption-generation': 'You are an expert at creating engaging social media captions.',
    'hashtag-generation': 'You are a hashtag research expert.',
    'content-optimization': 'You are a content optimization specialist.',
    'translation': 'You are a professional translator.',
  };

  return prompts[taskType] || 'You are a helpful AI assistant.';
}

/**
 * Get learning insights
 */
function getLearningInsights() {
  const insights = {
    bestModels: {},
    recommendations: [],
    usageStats: {},
  };

  // Find best model for each task
  for (const [taskType, performance] of modelLearning.performance.entries()) {
    let bestModel = null;
    let bestScore = 0;

    for (const [model, perf] of Object.entries(performance)) {
      if (perf.score > bestScore) {
        bestScore = perf.score;
        bestModel = model;
      }
    }

    if (bestModel) {
      insights.bestModels[taskType] = {
        model: bestModel,
        score: bestScore,
        usage: performance[bestModel].count,
      };
    }
  }

  // Generate recommendations
  for (const [taskType, best] of Object.entries(insights.bestModels)) {
    insights.recommendations.push({
      task: taskType,
      recommendation: `Use ${best.model} for ${taskType} tasks (score: ${best.score.toFixed(2)})`,
      confidence: best.score > 0.7 ? 'high' : best.score > 0.5 ? 'medium' : 'low',
    });
  }

  return insights;
}

module.exports = {
  initFreeAIProvider,
  getAvailableModels,
  generateWithFreeModel,
  selectBestModel,
  trackModelPerformance,
  getModelVersion,
  updateModelVersion,
  getLearningInsights,
  FREE_AI_PROVIDERS,
};

