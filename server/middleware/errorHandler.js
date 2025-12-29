// Centralized error handling middleware

const logger = require('../utils/logger');
const { captureException, addBreadcrumb } = require('../utils/sentry');

const errorHandler = (err, req, res, next) => {
  // Add breadcrumb for debugging
  addBreadcrumb('Error occurred', 'error', 'error', {
    url: req.originalUrl,
    method: req.method,
    error: err.message,
  });

  // Capture exception in Sentry
  captureException(err, {
    userId: req.user?._id,
    tags: {
      route: req.originalUrl,
      method: req.method,
    },
    extra: {
      ip: req.ip,
      query: req.query,
      // Don't include body as it may contain sensitive data
    },
  });

  // Log error with context
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?._id,
    body: req.body,
    query: req.query
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `${field} already exists`,
      field
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: `Invalid ${err.path}: ${err.value}`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid or malformed token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    const multerErrors = {
      LIMIT_FILE_SIZE: {
        status: 413,
        message: `File too large. Maximum size: ${Math.round((process.env.MAX_FILE_SIZE || 1073741824) / 1024 / 1024)}MB`,
        code: 'FILE_TOO_LARGE'
      },
      LIMIT_FILE_COUNT: {
        status: 400,
        message: 'Too many files',
        code: 'TOO_MANY_FILES'
      },
      LIMIT_UNEXPECTED_FILE: {
        status: 400,
        message: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      }
    };

    const errorConfig = multerErrors[err.code] || {
      status: 400,
      message: 'File upload error',
      code: 'UPLOAD_ERROR'
    };

    return res.status(errorConfig.status).json({
      success: false,
      error: errorConfig.message,
      code: errorConfig.code
    });
  }

  // File system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File or directory not found',
      code: 'FILE_NOT_FOUND'
    });
  }

  if (err.code === 'EACCES' || err.code === 'EPERM') {
    return res.status(403).json({
      success: false,
      error: 'Permission denied',
      code: 'PERMISSION_DENIED'
    });
  }

  if (err.code === 'ENOSPC') {
    return res.status(507).json({
      success: false,
      error: 'Insufficient storage space',
      code: 'STORAGE_FULL'
    });
  }

  // Database connection errors
  if (err.name === 'MongoServerError' || err.name === 'MongoNetworkError') {
    logger.error('Database connection error', { error: err.message });
    return res.status(503).json({
      success: false,
      error: 'Database connection error. Please try again later.',
      code: 'DATABASE_ERROR'
    });
  }

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // OpenAI API errors
  if (err.response?.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'OpenAI API rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  if (err.response?.status === 401 && err.config?.url?.includes('openai')) {
    return res.status(500).json({
      success: false,
      error: 'AI service authentication failed',
      code: 'AI_AUTH_ERROR'
    });
  }

  // FFmpeg errors
  if (err.message?.includes('ffmpeg') || err.message?.includes('ffprobe')) {
    return res.status(500).json({
      success: false,
      error: 'Video processing error. Please ensure the video file is valid.',
      code: 'VIDEO_PROCESSING_ERROR'
    });
  }

  // Timeout errors
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Request timeout. Please try again.',
      code: 'TIMEOUT'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: isProduction ? 'An unexpected error occurred' : message,
    code: err.code || 'INTERNAL_ERROR',
    ...(!isProduction && { 
      stack: err.stack,
      details: err
    })
  });
};

// 404 handler
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
};

module.exports = { errorHandler, notFound };

