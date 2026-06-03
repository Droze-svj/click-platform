const logger = require('../utils/logger');

class LoggingService {
  logInfo(msg, meta = {}) {
    logger.info(msg, meta);
  }

  logError(msg, error = null, meta = {}) {
    logger.error(msg, { error: error?.message || error, ...meta });
  }
}

module.exports = new LoggingService();
