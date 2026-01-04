// Advanced security middleware

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('express-validator');
const logger = require('../utils/logger');

/**
 * Enhanced rate limiting with different tiers
 */
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // In local development, avoid locking yourself out while testing flows.
    skip: (req) => {
      if (process.env.NODE_ENV === 'production') return false;
      const ip = (req.ip || '').toString();
      const host = (req.hostname || '').toString();
      const origin = (req.get && req.get('origin')) ? req.get('origin') : '';
      return (
        host === 'localhost' ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip.includes('127.0.0.1') ||
        (typeof origin === 'string' && origin.includes('localhost'))
      );
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        user: req.user?._id
      });
      res.status(429).json({
        success: false,
        error: message
      });
    }
  });
};

// Different rate limiters for different endpoints
const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 requests
  'Too many authentication attempts. Please try again later.'
);

const apiRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many API requests. Please slow down.'
);

const uploadRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads
  'Upload limit exceeded. Please try again later.'
);

const strictRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 requests
  'Too many requests. Please try again later.'
);

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove potentially dangerous characters
  const sanitize = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove script tags and dangerous patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

/**
 * SQL injection prevention
 */
const preventSQLInjection = (req, res, next) => {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          logger.warn('Potential SQL injection attempt', {
            ip: req.ip,
            value: value.substring(0, 100)
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid input detected'
          });
        }
      }
    }
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        checkValue(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkObject(obj[key]);
      }
    }
  };

  if (req.body) checkObject(req.body);
  if (req.query) checkObject(req.query);
  if (req.params) checkObject(req.params);

  next();
};

/**
 * File upload security
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return next();
  }

  const file = req.file || (req.files && req.files[0]);
  if (!file) {
    return next();
  }

  // Check file size (should also be checked in multer config)
  const maxSize = 500 * 1024 * 1024; // 500MB
  if (file.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: 'File size exceeds maximum allowed size'
    });
  }

  // Check file type
  const allowedMimeTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/wav',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed'
    });
  }

  // Check for malicious file extensions
  const dangerousExtensions = ['.exe', '.bat', '.sh', '.php', '.js', '.jar'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (dangerousExtensions.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed'
    });
  }

  next();
};

/**
 * IP whitelist/blacklist (optional)
 */
const ipFilter = (allowedIPs = [], blockedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (blockedIPs.length > 0 && blockedIPs.includes(clientIP)) {
      logger.warn('Blocked IP attempt', { ip: clientIP });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn('Unauthorized IP attempt', { ip: clientIP });
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    next();
  };
};

/**
 * Request size limit
 */
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
    }

    next();
  };
};

const parseSize = (size) => {
  const units = { kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(kb|mb|gb)$/);
  if (match) {
    return parseInt(match[1]) * units[match[2]];
  }
  return 10 * 1024 * 1024; // Default 10MB
};

/**
 * Enhanced Helmet configuration
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow external resources
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow serving uploads
});

module.exports = {
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  strictRateLimiter,
  sanitizeInput,
  preventSQLInjection,
  validateFileUpload,
  ipFilter,
  requestSizeLimit,
  securityHeaders
};







