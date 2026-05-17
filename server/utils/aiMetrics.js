const logger = require('./logger');

let sentry = null;
try {
  sentry = require('./sentry');
} catch (_) {
  sentry = null;
}

const counters = new Map();

function increment(metric, tags = {}) {
  const key = metric + JSON.stringify(tags);
  counters.set(key, (counters.get(key) || 0) + 1);
  logger.info('metric.increment', { metric, tags, total: counters.get(key) });
  if (sentry && typeof sentry.captureMessage === 'function') {
    try {
      sentry.captureMessage(`metric:${metric}`, {
        level: 'info',
        tags,
      });
    } catch (_) { /* sentry optional */ }
  }
}

function get(metric, tags = {}) {
  return counters.get(metric + JSON.stringify(tags)) || 0;
}

function reset() {
  counters.clear();
}

function snapshot() {
  return Object.fromEntries(counters.entries());
}

module.exports = {
  increment,
  get,
  reset,
  snapshot,
};
