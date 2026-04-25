// Request ID middleware for tracing

function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Add unique request ID to each request
 */
function addRequestId(req, res, next) {
  req.id = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = { addRequestId };

