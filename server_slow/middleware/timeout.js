const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Global request timeout middleware
 * @param {number} seconds - Timeout in seconds
 */
const requestTimeout = (seconds = 30) => {
  return (req, res, next) => {
    // Set timer
    const timeout = seconds * 1000;
    const fullUrl = req.originalUrl || req.url;
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`🛑 Request Timeout [${seconds}s] on ${req.method} ${fullUrl}`, {
          url: fullUrl,
          method: req.method,
          timeout: `${seconds}s`
        });
        
        sendError(res, `Request timeout (${seconds}s). The server took too long to respond.`, 408);
      }
    }, timeout);

    // Clean up on finish/close
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

module.exports = requestTimeout;
