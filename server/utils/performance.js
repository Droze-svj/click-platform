// Performance monitoring utilities

const logger = require('./logger');

// Response time tracking middleware
function trackResponseTime(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', logData);
    }

    // Log very slow requests
    if (duration > 5000) {
      logger.error('Very slow request detected', logData);
    }
  });

  next();
}

// Memory usage monitoring
function logMemoryUsage() {
  const used = process.memoryUsage();
  const formatMB = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
  
  logger.info('Memory usage', {
    rss: `${formatMB(used.rss)}MB`,
    heapTotal: `${formatMB(used.heapTotal)}MB`,
    heapUsed: `${formatMB(used.heapUsed)}MB`,
    external: `${formatMB(used.external)}MB`
  });
}

// Monitor memory every 5 minutes
if (process.env.NODE_ENV === 'production') {
  setInterval(logMemoryUsage, 5 * 60 * 1000);
}

module.exports = {
  trackResponseTime,
  logMemoryUsage
};







