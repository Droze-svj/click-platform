// HTTP request logging middleware

const logger = require('../utils/logger');

// Redact secrets that can ride in a query string (OAuth ?code=/?state=, signed
// media ?sig=, password-reset ?token=, …) so they never reach the log sink /
// aggregator. Masks the VALUE only, keeping the key for debuggability.
const SECRET_QS = /([?&])([^=&]*(?:token|code|secret|password|passwd|apikey|api_key|access_key|key|signature|sig|state|auth)[^=&]*)=([^&]+)/gi;
const maskUrl = (url) => String(url || '').replace(SECRET_QS, '$1$2=***');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: maskUrl(req.originalUrl),
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: maskUrl(req.originalUrl),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

module.exports = requestLogger;
module.exports.maskUrl = maskUrl; // exported for testing







