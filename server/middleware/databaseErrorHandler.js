// Database error handling middleware

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Handle database connection errors
 */
function handleDatabaseError(error) {
  if (error.name === 'MongoServerError') {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return {
        message: `${field} already exists`,
        code: 'DUPLICATE_KEY',
        statusCode: 409
      };
    }
    if (error.code === 11001) {
      return {
        message: 'Duplicate entry',
        code: 'DUPLICATE_ENTRY',
        statusCode: 409
      };
    }
  }

  if (error.name === 'MongoNetworkError') {
    logger.error('MongoDB network error', { error: error.message });
    return {
      message: 'Database connection failed. Please try again later.',
      code: 'DATABASE_CONNECTION_ERROR',
      statusCode: 503
    };
  }

  if (error.name === 'MongoTimeoutError') {
    logger.error('MongoDB timeout error', { error: error.message });
    return {
      message: 'Database operation timed out. Please try again.',
      code: 'DATABASE_TIMEOUT',
      statusCode: 504
    };
  }

  if (error.name === 'CastError') {
    return {
      message: `Invalid ${error.path}: ${error.value}`,
      code: 'INVALID_ID',
      statusCode: 400
    };
  }

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: errors
    };
  }

  return null;
}

/**
 * Wrap database operations with error handling
 */
async function withDatabaseErrorHandling(operation, errorContext = {}) {
  try {
    return await operation();
  } catch (error) {
    const handledError = handleDatabaseError(error);
    if (handledError) {
      const dbError = new Error(handledError.message);
      dbError.code = handledError.code;
      dbError.statusCode = handledError.statusCode;
      dbError.details = handledError.details;
      throw dbError;
    }
    
    // Log unhandled database errors
    logger.error('Unhandled database error', {
      error: error.message,
      stack: error.stack,
      ...errorContext
    });
    
    throw error;
  }
}

/**
 * Check database connection health
 */
async function checkDatabaseHealth() {
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      // Connected
      await mongoose.connection.db.admin().ping();
      return { healthy: true, state: 'connected' };
    }
    return { healthy: false, state: getConnectionStateName(state) };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return { healthy: false, error: error.message };
  }
}

function getConnectionStateName(state) {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
}

module.exports = {
  handleDatabaseError,
  withDatabaseErrorHandling,
  checkDatabaseHealth
};







