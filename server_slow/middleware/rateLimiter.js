// Rate limiting middleware

const rateLimit = require('express-rate-limit');

// General API rate limiter
// Uses per-user limiting for authenticated users, per-IP for anonymous
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased to 300 requests per window (was 100)
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID if authenticated, otherwise use IP
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip || req.connection.remoteAddress;
  },
  // Skip rate limiting for successful health checks
  skip: (req) => {
    return req.path === '/health' || req.path === '/health/debug-redis';
  },
});

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  skipSuccessfulRequests: true,
});

// Upload endpoints rate limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    success: false,
    error: 'Too many uploads, please try again later'
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter
};







