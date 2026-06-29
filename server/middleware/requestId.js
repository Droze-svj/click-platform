// Request ID middleware for tracing

const { runWithContext } = require('../utils/requestContext');

function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Add a unique request ID to each request AND run the rest of the request inside
 * an AsyncLocalStorage context so the logger can stamp every log line with it
 * (see utils/logger.js + utils/requestContext.js) — request-scoped tracing
 * without threading the id through every call.
 */
function addRequestId(req, res, next) {
  req.id = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.id);
  runWithContext({ requestId: req.id }, () => next());
}

module.exports = { addRequestId };

