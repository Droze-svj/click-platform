// Input sanitization middleware

const { body, query, param } = require('express-validator');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { sendError } = require('../utils/response');
const { sanitizeString, sanitizeObject, sanitizeMongoQuery, validateInput } = require('../utils/inputSanitizer');

// Use advanced sanitizer from utils

/**
 * Paths whose query/body params must NEVER be HTML-escaped. OAuth
 * callbacks carry opaque tokens (`code`, `state`, JWT-shaped `id_token`)
 * that the platform generates and we round-trip verbatim — escaping
 * `/` to `&#x2F;` or `&` to `&amp;` inside them produces garbage that
 * the platform's token endpoint rejects with "Malformed auth code" or
 * an equivalent error. Google's `4/0...` codes were the canary; the
 * other platforms work today only because their codes happen to be
 * base64url-clean.
 *
 * Anything else that needs to pass raw bytes through (webhooks, etc.)
 * can be added here. Keep this list narrow.
 */
const SANITIZER_BYPASS_PATHS = [
  /^\/api\/oauth\/[^/]+\/callback($|\?)/,
  /^\/api\/oauth\/callback($|\?)/, // legacy single-callback path, just in case
];

function sanitizeInput(req, res, next) {
  try {
    // Skip sanitization for OAuth callback paths — see comment above.
    const reqPath = req.path || req.url || '';
    if (SANITIZER_BYPASS_PATHS.some((rx) => rx.test(reqPath))) {
      return next();
    }
    if (req.body) {
      req.body = sanitizeObject(req.body, {});
    }
    if (req.query) {
      req.query = sanitizeObject(req.query, {});
      // Also sanitize MongoDB queries
      req.query = sanitizeMongoQuery(req.query);
    }
    if (req.params) {
      req.params = sanitizeObject(req.params, {});
    }
    next();
  } catch (error) {
    logger.error('Input sanitization error', { error: error.message });
    next();
  }
}

/**
 * Validate and sanitize request
 */
function validateAndSanitize(validations) {
  return async (req, res, next) => {
    // Run validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'Validation failed', 400, {
        errors: errors.array(),
      });
    }

    // Sanitize input
    sanitizeInput(req, res, next);
  };
}

/**
 * Common validation rules
 */
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),

  password: body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  objectId: (field = 'id') => param(field)
    .isMongoId()
    .withMessage('Invalid ID format'),

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  string: (field, minLength = 1, maxLength = 1000) => body(field)
    .isString()
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`),
};

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  validateAndSanitize,
  commonValidations,
};


