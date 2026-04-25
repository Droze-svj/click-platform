// Export Error Handler
// Specialized error handling for AI and publishing failures

const logger = require('../utils/logger');

/**
 * Categorize export errors
 */
function categorizeExportError(error) {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toUpperCase() || '';

  // AI-related errors
  if (errorMessage.includes('ai') || 
      errorMessage.includes('openai') || 
      errorMessage.includes('gpt') ||
      errorMessage.includes('anthropic') ||
      errorCode.includes('AI_')) {
    return {
      category: 'ai',
      retryable: true,
      severity: errorMessage.includes('quota') || errorMessage.includes('rate limit') ? 'high' : 'medium',
      userMessage: getAIErrorMessage(error),
      technicalDetails: {
        errorCode: error.code,
        errorMessage: error.message,
        stack: error.stack
      }
    };
  }

  // Publishing-related errors
  if (errorMessage.includes('publish') || 
      errorMessage.includes('post') ||
      errorMessage.includes('twitter') ||
      errorMessage.includes('linkedin') ||
      errorMessage.includes('facebook') ||
      errorMessage.includes('instagram') ||
      errorCode.includes('PUBLISH_')) {
    return {
      category: 'publishing',
      retryable: !errorMessage.includes('auth') && !errorMessage.includes('token'),
      severity: errorMessage.includes('auth') ? 'high' : 'medium',
      userMessage: getPublishingErrorMessage(error),
      technicalDetails: {
        errorCode: error.code,
        errorMessage: error.message,
        platform: extractPlatform(error),
        stack: error.stack
      }
    };
  }

  // Format conversion errors
  if (errorMessage.includes('format') || 
      errorMessage.includes('convert') ||
      errorCode.includes('FORMAT_')) {
    return {
      category: 'format',
      retryable: false,
      severity: 'low',
      userMessage: 'Unable to convert to the selected format. Please try a different format.',
      technicalDetails: {
        errorCode: error.code,
        errorMessage: error.message
      }
    };
  }

  // Network errors
  if (errorMessage.includes('network') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorCode.includes('ECONN') ||
      errorCode.includes('ETIMEDOUT')) {
    return {
      category: 'network',
      retryable: true,
      severity: 'medium',
      userMessage: 'Network error occurred. Please check your connection and try again.',
      technicalDetails: {
        errorCode: error.code,
        errorMessage: error.message
      }
    };
  }

  // Storage errors
  if (errorMessage.includes('storage') || 
      errorMessage.includes('disk') ||
      errorMessage.includes('space') ||
      errorCode.includes('ENOSPC')) {
    return {
      category: 'storage',
      retryable: false,
      severity: 'high',
      userMessage: 'Storage error. Unable to save export file. Please contact support.',
      technicalDetails: {
        errorCode: error.code,
        errorMessage: error.message
      }
    };
  }

  // Default
  return {
    category: 'unknown',
    retryable: true,
    severity: 'medium',
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    technicalDetails: {
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack
    }
  };
}

/**
 * Get AI-specific error message
 */
function getAIErrorMessage(error) {
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toUpperCase() || '';

  if (message.includes('timeout') || message.includes('timed out') || code.includes('TIMEOUT')) {
    return 'AI processing timed out. The content is taking longer than expected. Please try again or reduce the content size.';
  }

  if (message.includes('quota') || message.includes('limit exceeded') || code.includes('QUOTA')) {
    return 'AI processing quota exceeded. You have reached your AI processing limit for this period. Please upgrade your plan or wait for your quota to reset.';
  }

  if (message.includes('rate limit') || code.includes('RATE_LIMIT')) {
    return 'AI processing rate limit reached. Too many requests in a short time. Please wait a moment and try again.';
  }

  if (message.includes('service unavailable') || message.includes('503') || code.includes('UNAVAILABLE')) {
    return 'AI service is temporarily unavailable. Our AI service is experiencing issues. Please try again in a few minutes.';
  }

  if (message.includes('invalid') || message.includes('bad request') || code.includes('400')) {
    return 'AI processing request invalid. The content format may not be supported. Please check your content and try again.';
  }

  if (message.includes('unauthorized') || message.includes('401') || code.includes('AUTH')) {
    return 'AI service authentication failed. Please contact support to resolve this issue.';
  }

  return 'AI processing failed. The AI service encountered an error while processing your content. Please try again in a few moments. If the problem persists, contact support.';
}

/**
 * Get publishing-specific error message
 */
function getPublishingErrorMessage(error) {
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toUpperCase() || '';
  const platform = extractPlatform(error);

  if (message.includes('auth') || message.includes('token') || message.includes('expired') || code.includes('AUTH')) {
    return `Your ${platform} connection has expired. Please reconnect your account in settings and try again.`;
  }

  if (message.includes('rate limit') || code.includes('RATE_LIMIT')) {
    return `Publishing rate limit reached for ${platform}. Too many posts in a short time. Please wait before publishing again.`;
  }

  if (message.includes('validation') || message.includes('invalid') || message.includes('rejected')) {
    return `Content validation failed for ${platform}. Your content does not meet platform requirements. Please review and adjust your content (check length, media, hashtags, etc.).`;
  }

  if (message.includes('duplicate') || message.includes('already posted')) {
    return `This content appears to be a duplicate on ${platform}. Please create new content or wait before reposting.`;
  }

  if (message.includes('permission') || message.includes('forbidden') || code.includes('403')) {
    return `Permission denied for ${platform}. You may not have permission to post. Please check your account permissions.`;
  }

  if (message.includes('service unavailable') || message.includes('503') || code.includes('UNAVAILABLE')) {
    return `${platform} service is temporarily unavailable. Please try again in a few minutes.`;
  }

  return `Publishing to ${platform} failed. Please check your platform connection and try again. If the problem persists, contact support.`;
}

/**
 * Extract platform from error
 */
function extractPlatform(error) {
  const message = error.message?.toLowerCase() || '';
  const platforms = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'];
  
  for (const platform of platforms) {
    if (message.includes(platform)) {
      return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  }

  return 'platform';
}

/**
 * Should retry based on error category
 */
function shouldRetry(error, attempt, maxAttempts) {
  const categorized = categorizeExportError(error);
  
  if (!categorized.retryable) {
    return false;
  }

  // Don't retry certain errors
  if (categorized.category === 'format') {
    return false;
  }

  // Retry network errors more aggressively
  if (categorized.category === 'network' && attempt < maxAttempts) {
    return true;
  }

  // Retry AI/publishing errors with limits
  if ((categorized.category === 'ai' || categorized.category === 'publishing') && attempt < maxAttempts) {
    // Don't retry auth errors
    if (categorized.severity === 'high' && categorized.category === 'publishing') {
      return false;
    }
    return true;
  }

  return attempt < maxAttempts;
}

/**
 * Get retry delay based on error
 */
function getRetryDelay(error, attempt, baseDelay = 1000) {
  const categorized = categorizeExportError(error);
  
  // Longer delay for rate limits
  if (categorized.category === 'ai' || categorized.category === 'publishing') {
    const message = error.message?.toLowerCase() || '';
    if (message.includes('rate limit')) {
      return baseDelay * Math.pow(2, attempt) * 5; // 5x longer for rate limits
    }
  }

  // Standard exponential backoff
  return baseDelay * Math.pow(2, attempt);
}

module.exports = {
  categorizeExportError,
  shouldRetry,
  getRetryDelay,
  getAIErrorMessage,
  getPublishingErrorMessage
};


