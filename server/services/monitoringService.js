// Advanced Monitoring & Alerting Service

const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

// Metrics storage (in production, use Prometheus or similar)
const metrics = {
  requests: {
    total: 0,
    errors: 0,
    byEndpoint: {},
    responseTimes: [],
  },
  system: {
    memory: [],
    cpu: [],
    disk: [],
  },
  database: {
    queries: 0,
    slowQueries: [],
    connectionPool: {},
  },
};

/**
 * Record request metric
 */
function recordRequest(endpoint, method, statusCode, responseTime) {
  try {
    metrics.requests.total++;
    
    if (statusCode >= 400) {
      metrics.requests.errors++;
    }

    const key = `${method} ${endpoint}`;
    if (!metrics.requests.byEndpoint[key]) {
      metrics.requests.byEndpoint[key] = {
        count: 0,
        errors: 0,
        totalTime: 0,
        avgTime: 0,
      };
    }

    metrics.requests.byEndpoint[key].count++;
    metrics.requests.byEndpoint[key].totalTime += responseTime;
    metrics.requests.byEndpoint[key].avgTime =
      metrics.requests.byEndpoint[key].totalTime /
      metrics.requests.byEndpoint[key].count;

    if (statusCode >= 400) {
      metrics.requests.byEndpoint[key].errors++;
    }

    // Keep last 1000 response times
    metrics.requests.responseTimes.push(responseTime);
    if (metrics.requests.responseTimes.length > 1000) {
      metrics.requests.responseTimes.shift();
    }
  } catch (error) {
    logger.error('Record request metric error', { error: error.message });
  }
}

/**
 * Record system metric
 */
function recordSystemMetric(type, value) {
  try {
    if (!metrics.system[type]) {
      metrics.system[type] = [];
    }

    metrics.system[type].push({
      value,
      timestamp: new Date(),
    });

    // Keep last 100 measurements
    if (metrics.system[type].length > 100) {
      metrics.system[type].shift();
    }
  } catch (error) {
    logger.error('Record system metric error', { error: error.message, type });
  }
}

/**
 * Record database query
 */
function recordDatabaseQuery(query, duration) {
  try {
    metrics.database.queries++;

    if (duration > 1000) {
      // Slow query (>1 second)
      metrics.database.slowQueries.push({
        query: query.substring(0, 200), // Truncate long queries
        duration,
        timestamp: new Date(),
      });

      // Keep last 100 slow queries
      if (metrics.database.slowQueries.length > 100) {
        metrics.database.slowQueries.shift();
      }

      logger.warn('Slow database query detected', { duration, query: query.substring(0, 100) });
    }
  } catch (error) {
    logger.error('Record database query error', { error: error.message });
  }
}

/**
 * Get metrics
 */
function getMetrics(options = {}) {
  try {
    const {
      includeSystem = true,
      includeDatabase = true,
      includeRequests = true,
    } = options;

    const result = {};

    if (includeRequests) {
      result.requests = {
        total: metrics.requests.total,
        errors: metrics.requests.errors,
        errorRate: metrics.requests.total > 0
          ? (metrics.requests.errors / metrics.requests.total) * 100
          : 0,
        byEndpoint: metrics.requests.byEndpoint,
        avgResponseTime: calculateAverage(metrics.requests.responseTimes),
        p95ResponseTime: calculatePercentile(metrics.requests.responseTimes, 95),
        p99ResponseTime: calculatePercentile(metrics.requests.responseTimes, 99),
      };
    }

    if (includeSystem) {
      result.system = {
        memory: getLatestMetric(metrics.system.memory),
        cpu: getLatestMetric(metrics.system.cpu),
        disk: getLatestMetric(metrics.system.disk),
      };
    }

    if (includeDatabase) {
      result.database = {
        totalQueries: metrics.database.queries,
        slowQueries: metrics.database.slowQueries.length,
        recentSlowQueries: metrics.database.slowQueries.slice(-10),
      };
    }

    return result;
  } catch (error) {
    logger.error('Get metrics error', { error: error.message });
    throw error;
  }
}

/**
 * Check alerts
 */
async function checkAlerts() {
  try {
    const alerts = [];

    // Check error rate
    const errorRate = metrics.requests.total > 0
      ? (metrics.requests.errors / metrics.requests.total) * 100
      : 0;

    if (errorRate > 5) {
      alerts.push({
        severity: 'high',
        type: 'error_rate',
        message: `High error rate: ${errorRate.toFixed(2)}%`,
        value: errorRate,
      });
    }

    // Check response time
    const avgResponseTime = calculateAverage(metrics.requests.responseTimes);
    if (avgResponseTime > 2000) {
      alerts.push({
        severity: 'medium',
        type: 'response_time',
        message: `High average response time: ${avgResponseTime.toFixed(0)}ms`,
        value: avgResponseTime,
      });
    }

    // Check slow queries
    if (metrics.database.slowQueries.length > 10) {
      alerts.push({
        severity: 'medium',
        type: 'slow_queries',
        message: `${metrics.database.slowQueries.length} slow queries detected`,
        value: metrics.database.slowQueries.length,
      });
    }

    // Check system resources
    const memory = getLatestMetric(metrics.system.memory);
    if (memory && memory.value > 90) {
      alerts.push({
        severity: 'high',
        type: 'memory',
        message: `High memory usage: ${memory.value.toFixed(1)}%`,
        value: memory.value,
      });
    }

    return alerts;
  } catch (error) {
    logger.error('Check alerts error', { error: error.message });
    return [];
  }
}

/**
 * Calculate average
 */
function calculateAverage(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculate percentile
 */
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Get latest metric
 */
function getLatestMetric(metricArray) {
  if (metricArray.length === 0) return null;
  return metricArray[metricArray.length - 1];
}

/**
 * Export metrics for Prometheus
 */
function exportPrometheusMetrics() {
  try {
    const lines = [];

    // Request metrics
    lines.push(`# HELP http_requests_total Total number of HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total ${metrics.requests.total}`);

    lines.push(`# HELP http_requests_errors_total Total number of HTTP errors`);
    lines.push(`# TYPE http_requests_errors_total counter`);
    lines.push(`http_requests_errors_total ${metrics.requests.errors}`);

    lines.push(`# HELP http_request_duration_seconds Average request duration`);
    lines.push(`# TYPE http_request_duration_seconds gauge`);
    const avgTime = calculateAverage(metrics.requests.responseTimes) / 1000;
    lines.push(`http_request_duration_seconds ${avgTime}`);

    // Database metrics
    lines.push(`# HELP database_queries_total Total number of database queries`);
    lines.push(`# TYPE database_queries_total counter`);
    lines.push(`database_queries_total ${metrics.database.queries}`);

    return lines.join('\n');
  } catch (error) {
    logger.error('Export Prometheus metrics error', { error: error.message });
    return '';
  }
}

module.exports = {
  recordRequest,
  recordSystemMetric,
  recordDatabaseQuery,
  getMetrics,
  checkAlerts,
  exportPrometheusMetrics,
};






