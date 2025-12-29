// Advanced Input Sanitization

const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

/**
 * Sanitize string input
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') {
    return input;
  }

  const {
    allowHTML = false,
    maxLength = null,
    trim = true,
    removeSpecialChars = false,
  } = options;

  let sanitized = input;

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove special characters if requested
  if (removeSpecialChars) {
    sanitized = sanitized.replace(/[<>\"'%;()&+]/g, '');
  }

  // Sanitize HTML
  if (allowHTML) {
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: options.allowedTags || [],
      ALLOWED_ATTR: options.allowedAttrs || [],
    });
  } else {
    // Escape HTML entities
    sanitized = validator.escape(sanitized);
  }

  // Limit length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize email
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return null;
  }

  const sanitized = email.trim().toLowerCase();
  return validator.isEmail(sanitized) ? sanitized : null;
}

/**
 * Sanitize URL
 */
function sanitizeURL(url, options = {}) {
  if (typeof url !== 'string') {
    return null;
  }

  const { allowedProtocols = ['http:', 'https:'] } = options;
  const sanitized = url.trim();

  if (!validator.isURL(sanitized, { protocols: allowedProtocols })) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj, schema = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    const fieldSchema = schema[key] || {};
    const sanitizedKey = sanitizeString(key, { removeSpecialChars: true });

    if (value === null || value === undefined) {
      sanitized[sanitizedKey] = value;
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => {
        if (typeof item === 'string') {
          return sanitizeString(item, fieldSchema);
        } else if (typeof item === 'object') {
          return sanitizeObject(item, fieldSchema.schema || {});
        }
        return item;
      });
    } else if (typeof value === 'object') {
      sanitized[sanitizedKey] = sanitizeObject(value, fieldSchema.schema || {});
    } else if (typeof value === 'string') {
      if (fieldSchema.type === 'email') {
        sanitized[sanitizedKey] = sanitizeEmail(value);
      } else if (fieldSchema.type === 'url') {
        sanitized[sanitizedKey] = sanitizeURL(value, fieldSchema);
      } else {
        sanitized[sanitizedKey] = sanitizeString(value, fieldSchema);
      }
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize MongoDB query
 */
function sanitizeMongoQuery(query) {
  if (!query || typeof query !== 'object') {
    return {};
  }

  const sanitized = {};
  const dangerousKeys = ['$where', '$eval', '$function'];

  for (const [key, value] of Object.entries(query)) {
    // Remove dangerous operators
    if (dangerousKeys.includes(key)) {
      continue;
    }

    // Sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return sanitizeMongoQuery(item);
          }
          return typeof item === 'string' ? sanitizeString(item) : item;
        });
      } else {
        sanitized[key] = sanitizeMongoQuery(value);
      }
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize file name
 */
function sanitizeFileName(fileName) {
  if (typeof fileName !== 'string') {
    return null;
  }

  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '_');
  
  // Remove special characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');
  
  // Limit length
  sanitized = sanitized.substring(0, 255);
  
  return sanitized || 'file';
}

/**
 * Validate input against schema
 */
function validateInput(input, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    // Skip validation if field is optional and not provided
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type check
    if (rules.type && typeof value !== rules.type) {
      errors.push({ field, message: `${field} must be of type ${rules.type}` });
      continue;
    }

    // String validations
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({ field, message: `${field} format is invalid` });
      }
    }

    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, message: `${field} must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, message: `${field} must be at most ${rules.max}` });
      }
    }

    // Email validation
    if (rules.type === 'email' && !validator.isEmail(value)) {
      errors.push({ field, message: `${field} must be a valid email` });
    }

    // URL validation
    if (rules.type === 'url' && !validator.isURL(value)) {
      errors.push({ field, message: `${field} must be a valid URL` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  sanitizeString,
  sanitizeEmail,
  sanitizeURL,
  sanitizeObject,
  sanitizeMongoQuery,
  sanitizeFileName,
  validateInput,
};





