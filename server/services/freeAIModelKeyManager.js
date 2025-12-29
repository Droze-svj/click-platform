// Free AI Model API Key Manager
// Manages API keys for free AI providers and validates them

const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

// Key validation cache (5 minutes)
const keyValidationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Validate API key for provider
 */
async function validateAPIKey(provider, apiKey) {
  try {
    // Check cache first
    const cacheKey = `${provider}:${apiKey?.substring(0, 10)}`;
    const cached = keyValidationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    const { FREE_AI_PROVIDERS } = require('./freeAIModelService');
    const providerConfig = FREE_AI_PROVIDERS[provider];
    if (!providerConfig) {
      throw new AppError(`Provider '${provider}' not found`, 400);
    }

    let isValid = false;
    let details = {};

    switch (provider) {
      case 'openrouter':
        isValid = await validateOpenRouterKey(apiKey);
        if (isValid) {
          details = await getOpenRouterKeyDetails(apiKey);
        }
        break;

      case 'huggingface':
        isValid = await validateHuggingFaceKey(apiKey);
        if (isValid) {
          details = await getHuggingFaceKeyDetails(apiKey);
        }
        break;

      case 'cerebras':
        isValid = await validateCerebrasKey(apiKey);
        break;

      case 'replicate':
        isValid = await validateReplicateKey(apiKey);
        if (isValid) {
          details = await getReplicateKeyDetails(apiKey);
        }
        break;

      default:
        throw new AppError(`Key validation not implemented for ${provider}`, 400);
    }

    const result = {
      isValid,
      provider,
      details,
      timestamp: new Date(),
    };

    // Cache result
    keyValidationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    logger.error('Validate API key error', { error: error.message, provider });
    return {
      isValid: false,
      provider,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Validate OpenRouter API key
 */
async function validateOpenRouterKey(apiKey) {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://click.app',
        'X-Title': 'Click - AI Content Platform',
      },
      timeout: 10000,
    });

    return response.status === 200;
  } catch (error) {
    if (error.response?.status === 401) {
      return false;
    }
    // Network errors don't mean key is invalid
    logger.warn('OpenRouter key validation error', { error: error.message });
    return true; // Assume valid if we can't verify
  }
}

/**
 * Get OpenRouter key details (limits, usage)
 */
async function getOpenRouterKeyDetails(apiKey) {
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://click.app',
        'X-Title': 'Click - AI Content Platform',
      },
      timeout: 10000,
    });

    return {
      label: response.data?.label || 'OpenRouter Key',
      credits: response.data?.credits || null,
      usage: response.data?.usage || null,
      limits: response.data?.limits || null,
    };
  } catch (error) {
    logger.warn('Get OpenRouter key details error', { error: error.message });
    return {};
  }
}

/**
 * Validate Hugging Face API key
 */
async function validateHuggingFaceKey(apiKey) {
  try {
    const response = await axios.get('https://huggingface.co/api/whoami', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    return response.status === 200 && response.data?.name;
  } catch (error) {
    if (error.response?.status === 401) {
      return false;
    }
    logger.warn('Hugging Face key validation error', { error: error.message });
    return true; // Assume valid if we can't verify
  }
}

/**
 * Get Hugging Face key details
 */
async function getHuggingFaceKeyDetails(apiKey) {
  try {
    const response = await axios.get('https://huggingface.co/api/whoami', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    return {
      username: response.data?.name,
      type: response.data?.type || 'user',
      organizations: response.data?.orgs || [],
    };
  } catch (error) {
    logger.warn('Get Hugging Face key details error', { error: error.message });
    return {};
  }
}

/**
 * Validate Cerebras API key
 */
async function validateCerebrasKey(apiKey) {
  try {
    // Cerebras doesn't have a public validation endpoint
    // We'll test with a minimal request
    const response = await axios.post(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instruct',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return response.status === 200;
  } catch (error) {
    if (error.response?.status === 401) {
      return false;
    }
    logger.warn('Cerebras key validation error', { error: error.message });
    return true; // Assume valid if we can't verify
  }
}

/**
 * Validate Replicate API key
 */
async function validateReplicateKey(apiKey) {
  try {
    const response = await axios.get('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      timeout: 10000,
    });

    return response.status === 200 && response.data?.username;
  } catch (error) {
    if (error.response?.status === 401) {
      return false;
    }
    logger.warn('Replicate key validation error', { error: error.message });
    return true; // Assume valid if we can't verify
  }
}

/**
 * Get Replicate key details (credits, usage)
 */
async function getReplicateKeyDetails(apiKey) {
  try {
    const response = await axios.get('https://api.replicate.com/v1/account', {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      timeout: 10000,
    });

    return {
      username: response.data?.username,
      name: response.data?.name,
      email: response.data?.email,
      // Credits info might be in billing endpoint
    };
  } catch (error) {
    logger.warn('Get Replicate key details error', { error: error.message });
    return {};
  }
}

/**
 * Get all configured keys status
 */
async function getAllKeysStatus() {
  const status = {};
  const { FREE_AI_PROVIDERS } = require('./freeAIModelService');

  if (!FREE_AI_PROVIDERS) {
    return {};
  }

  for (const [provider, config] of Object.entries(FREE_AI_PROVIDERS)) {
    const apiKey = config.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    
    if (apiKey) {
      const validation = await validateAPIKey(provider, apiKey);
      status[provider] = {
        configured: true,
        validated: validation.isValid,
        details: validation.details,
        lastValidated: validation.timestamp,
      };
    } else {
      status[provider] = {
        configured: false,
        validated: false,
        message: 'No API key configured',
      };
    }
  }

  return status;
}

/**
 * Get provider limits and usage
 */
function getProviderLimits(provider) {
  const { FREE_AI_PROVIDERS } = require('./freeAIModelService');
  const providerConfig = FREE_AI_PROVIDERS[provider];
  if (!providerConfig) {
    return null;
  }

  return {
    name: providerConfig.name,
    freeTier: {
      ...providerConfig.freeTier,
      requiresAuth: providerConfig.freeTier.requiresAuth,
    },
    hasAPIKey: !!providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
  };
}

/**
 * Get all provider limits
 */
function getAllProviderLimits() {
  const limits = {};
  const { FREE_AI_PROVIDERS } = require('./freeAIModelService');

  if (!FREE_AI_PROVIDERS) {
    return {};
  }

  for (const [provider, config] of Object.entries(FREE_AI_PROVIDERS)) {
    limits[provider] = getProviderLimits(provider);
  }

  return limits;
}

/**
 * Clear validation cache
 */
function clearValidationCache() {
  keyValidationCache.clear();
  logger.info('API key validation cache cleared');
}

module.exports = {
  validateAPIKey,
  validateOpenRouterKey,
  validateHuggingFaceKey,
  validateCerebrasKey,
  validateReplicateKey,
  getOpenRouterKeyDetails,
  getHuggingFaceKeyDetails,
  getReplicateKeyDetails,
  getAllKeysStatus,
  getProviderLimits,
  getAllProviderLimits,
  clearValidationCache,
};

