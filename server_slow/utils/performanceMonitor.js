// Advanced performance monitoring

const os = require('os');
const logger = require('./logger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      },
      database: {
        queries: 0,
        slowQueries: 0,
        averageQueryTime: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      memory: {
        used: 0,
        free: 0,
        total: 0,
        percentage: 0
      },
      cpu: {
        usage: 0,
        loadAverage: []
      },
      errors: {
        count: 0,
        byType: {}
      }
    };

    this.responseTimes = [];
    this.maxResponseTimeHistory = 1000; // Keep last 1000 response times
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime, success = true) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    // Calculate average
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.requests.averageResponseTime = sum / this.responseTimes.length;
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(queryTime, isSlow = false) {
    this.metrics.database.queries++;
    
    if (isSlow) {
      this.metrics.database.slowQueries++;
    }

    // Update average (simplified)
    const currentAvg = this.metrics.database.averageQueryTime;
    const count = this.metrics.database.queries;
    this.metrics.database.averageQueryTime = 
      ((currentAvg * (count - 1)) + queryTime) / count;
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(hit = true) {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }

    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 
      ? (this.metrics.cache.hits / total) * 100 
      : 0;
  }

  /**
   * Record error
   */
  recordError(errorType) {
    this.metrics.errors.count++;
    this.metrics.errors.byType[errorType] = 
      (this.metrics.errors.byType[errorType] || 0) + 1;
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    // Memory
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    this.metrics.memory = {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100
    };

    // CPU
    const loadAvg = os.loadavg();
    this.metrics.cpu = {
      usage: loadAvg[0], // 1-minute load average
      loadAverage: loadAvg
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    this.updateSystemMetrics();
    return {
      ...this.metrics,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Get performance summary
   */
  getSummary() {
    this.updateSystemMetrics();
    
    return {
      requests: {
        total: this.metrics.requests.total,
        successRate: this.metrics.requests.total > 0
          ? (this.metrics.requests.successful / this.metrics.requests.total) * 100
          : 0,
        averageResponseTime: this.metrics.requests.averageResponseTime.toFixed(2) + 'ms'
      },
      database: {
        queries: this.metrics.database.queries,
        slowQueries: this.metrics.database.slowQueries,
        averageQueryTime: this.metrics.database.averageQueryTime.toFixed(2) + 'ms'
      },
      cache: {
        hitRate: this.metrics.cache.hitRate.toFixed(2) + '%',
        hits: this.metrics.cache.hits,
        misses: this.metrics.cache.misses
      },
      system: {
        memoryUsage: this.metrics.memory.percentage.toFixed(2) + '%',
        cpuLoad: this.metrics.cpu.usage.toFixed(2),
        uptime: (process.uptime() / 3600).toFixed(2) + ' hours'
      },
      errors: {
        total: this.metrics.errors.count,
        byType: this.metrics.errors.byType
      }
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
      database: { queries: 0, slowQueries: 0, averageQueryTime: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      memory: { used: 0, free: 0, total: 0, percentage: 0 },
      cpu: { usage: 0, loadAverage: [] },
      errors: { count: 0, byType: {} }
    };
    this.responseTimes = [];
    logger.info('Performance metrics reset');
  }
}

const performanceMonitor = new PerformanceMonitor();

// Update system metrics every 30 seconds
setInterval(() => {
  performanceMonitor.updateSystemMetrics();
}, 30000);

module.exports = performanceMonitor;







