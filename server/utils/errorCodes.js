// Error Code Reference System

/**
 * Comprehensive error code reference
 */
const ERROR_CODES = {
  // Validation Errors (1000-1999)
  VALIDATION_REQUIRED: {
    code: 'VALIDATION_REQUIRED',
    statusCode: 400,
    message: 'Required field is missing',
    category: 'validation',
  },
  VALIDATION_INVALID_FORMAT: {
    code: 'VALIDATION_INVALID_FORMAT',
    statusCode: 400,
    message: 'Invalid format for field',
    category: 'validation',
  },
  VALIDATION_INVALID_TYPE: {
    code: 'VALIDATION_INVALID_TYPE',
    statusCode: 400,
    message: 'Invalid data type',
    category: 'validation',
  },
  VALIDATION_OUT_OF_RANGE: {
    code: 'VALIDATION_OUT_OF_RANGE',
    statusCode: 400,
    message: 'Value is out of allowed range',
    category: 'validation',
  },

  // Authentication Errors (2000-2999)
  AUTH_REQUIRED: {
    code: 'AUTH_REQUIRED',
    statusCode: 401,
    message: 'Authentication required',
    category: 'authentication',
  },
  AUTH_INVALID_TOKEN: {
    code: 'AUTH_INVALID_TOKEN',
    statusCode: 401,
    message: 'Invalid or malformed token',
    category: 'authentication',
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    statusCode: 401,
    message: 'Token has expired',
    category: 'authentication',
  },
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    statusCode: 401,
    message: 'Invalid email or password',
    category: 'authentication',
  },

  // Authorization Errors (3000-3999)
  AUTHZ_INSUFFICIENT_PERMISSIONS: {
    code: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
    statusCode: 403,
    message: 'Insufficient permissions',
    category: 'authorization',
  },
  AUTHZ_ADMIN_REQUIRED: {
    code: 'AUTHZ_ADMIN_REQUIRED',
    statusCode: 403,
    message: 'Admin access required',
    category: 'authorization',
  },
  AUTHZ_SUBSCRIPTION_REQUIRED: {
    code: 'AUTHZ_SUBSCRIPTION_REQUIRED',
    statusCode: 403,
    message: 'Active subscription required',
    category: 'authorization',
  },

  // Not Found Errors (4000-4999)
  NOT_FOUND_RESOURCE: {
    code: 'NOT_FOUND_RESOURCE',
    statusCode: 404,
    message: 'Resource not found',
    category: 'not_found',
  },
  NOT_FOUND_USER: {
    code: 'NOT_FOUND_USER',
    statusCode: 404,
    message: 'User not found',
    category: 'not_found',
  },
  NOT_FOUND_CONTENT: {
    code: 'NOT_FOUND_CONTENT',
    statusCode: 404,
    message: 'Content not found',
    category: 'not_found',
  },

  // Rate Limiting (5000-5999)
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    statusCode: 429,
    message: 'Rate limit exceeded',
    category: 'rate_limit',
  },
  RATE_LIMIT_ENDPOINT: {
    code: 'RATE_LIMIT_ENDPOINT',
    statusCode: 429,
    message: 'Endpoint rate limit exceeded',
    category: 'rate_limit',
  },

  // Service Errors (6000-6999)
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    statusCode: 503,
    message: 'Service temporarily unavailable',
    category: 'service',
  },
  SERVICE_DATABASE: {
    code: 'SERVICE_DATABASE',
    statusCode: 503,
    message: 'Database service unavailable',
    category: 'service',
  },
  SERVICE_CACHE: {
    code: 'SERVICE_CACHE',
    statusCode: 503,
    message: 'Cache service unavailable',
    category: 'service',
  },
  SERVICE_AI: {
    code: 'SERVICE_AI',
    statusCode: 503,
    message: 'AI service unavailable',
    category: 'service',
  },
  SERVICE_STORAGE: {
    code: 'SERVICE_STORAGE',
    statusCode: 503,
    message: 'Storage service unavailable',
    category: 'service',
  },

  // Network Errors (7000-7999)
  NETWORK_TIMEOUT: {
    code: 'NETWORK_TIMEOUT',
    statusCode: 504,
    message: 'Request timeout',
    category: 'network',
  },
  NETWORK_CONNECTION: {
    code: 'NETWORK_CONNECTION',
    statusCode: 503,
    message: 'Network connection error',
    category: 'network',
  },

  // Internal Errors (8000-8999)
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    message: 'Internal server error',
    category: 'internal',
  },
  INTERNAL_PROCESSING: {
    code: 'INTERNAL_PROCESSING',
    statusCode: 500,
    message: 'Error processing request',
    category: 'internal',
  },
};

/**
 * Get error code info
 */
function getErrorCodeInfo(code) {
  return ERROR_CODES[code] || {
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    message: 'Unknown error',
    category: 'unknown',
  };
}

/**
 * Get all error codes by category
 */
function getErrorCodesByCategory(category) {
  return Object.values(ERROR_CODES).filter(error => error.category === category);
}

/**
 * Get all error codes
 */
function getAllErrorCodes() {
  return ERROR_CODES;
}

/**
 * Create error with code
 */
function createErrorWithCode(code, customMessage = null, metadata = {}) {
  const errorInfo = getErrorCodeInfo(code);
  const error = new Error(customMessage || errorInfo.message);
  error.code = errorInfo.code;
  error.statusCode = errorInfo.statusCode;
  error.category = errorInfo.category;
  error.metadata = metadata;
  return error;
}

module.exports = {
  ERROR_CODES,
  getErrorCodeInfo,
  getErrorCodesByCategory,
  getAllErrorCodes,
  createErrorWithCode,
};





