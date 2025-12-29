// Request validation middleware

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Validate request body against schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation error', { errors, path: req.path });
        return sendError(res, 'Validation failed', 400, { errors });
      }

      req.body = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error', { error: err.message });
      return sendError(res, 'Validation error', 500);
    }
  };
}

/**
 * Validate query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Query validation error', { errors, path: req.path });
        return sendError(res, 'Invalid query parameters', 400, { errors });
      }

      req.query = value;
      next();
    } catch (err) {
      logger.error('Query validation middleware error', { error: err.message });
      return sendError(res, 'Validation error', 500);
    }
  };
}

/**
 * Validate URL parameters
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Params validation error', { errors, path: req.path });
        return sendError(res, 'Invalid URL parameters', 400, { errors });
      }

      req.params = value;
      next();
    } catch (err) {
      logger.error('Params validation middleware error', { error: err.message });
      return sendError(res, 'Validation error', 500);
    }
  };
}

/**
 * Sanitize input to prevent XSS
 */
function sanitizeInput(req, res, next) {
  try {
    const sanitize = (obj) => {
      if (typeof obj !== 'object' || obj === null) {
        return typeof obj === 'string' ? obj.trim() : obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Basic XSS prevention
          sanitized[key] = value
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        } else {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    };

    if (req.body) {
      req.body = sanitize(req.body);
    }
    if (req.query) {
      req.query = sanitize(req.query);
    }

    next();
  } catch (err) {
    logger.error('Sanitization error', { error: err.message });
    next();
  }
}

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  sanitizeInput
};







