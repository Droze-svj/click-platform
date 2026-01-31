/**
 * Application Performance Monitoring (APM)
 * Comprehensive server-side performance tracking and analysis
 */

const os = require('os');
const v8 = require('v8');
const { performance, PerformanceObserver } = require('perf_hooks');

class APMMonitor {
  constructor() {
    this.metrics = {
      responseTimes: [],
      errorRates: [],
      memoryUsage: [],
      cpuUsage: [],
      databaseQueries: [],
      apiCalls: [],
      customMetrics: new Map()
    };

    this.thresholds = {
      responseTime: parseInt(process.env.PERFORMANCE_RESPONSE_TIME_THRESHOLD) || 1000, // ms
      errorRate: parseFloat(process.env.PERFORMANCE_ERROR_RATE_THRESHOLD) || 0.05, // 5%
      memoryUsage: parseFloat(process.env.PERFORMANCE_MEMORY_THRESHOLD) || 0.90, // 90% of heap (was 80%, too aggressive)
      memoryCritical: parseFloat(process.env.PERFORMANCE_MEMORY_CRITICAL_THRESHOLD) || 0.98, // 98% critical threshold
      cpuUsage: parseFloat(process.env.PERFORMANCE_CPU_THRESHOLD) || 0.7 // 70%
    };

    this.alerts = [];
    this.isCollecting = false;

    this.initializeMonitoring();
  }

  /**
   * Initialize APM monitoring
   */
  initializeMonitoring() {
    // Memory monitoring - check less frequently to reduce overhead
    // Skip in test environment or if explicitly disabled
    const memoryCheckInterval = process.env.APM_MEMORY_CHECK_INTERVAL 
      ? parseInt(process.env.APM_MEMORY_CHECK_INTERVAL) 
      : (process.env.NODE_ENV === 'production' ? 60000 : 120000); // 1 min in prod, 2 min in dev
    
    if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_APM_MEMORY_MONITORING !== 'true') {
      this.memoryMonitor = setInterval(() => {
        this.collectMemoryMetrics();
      }, memoryCheckInterval);
    }

    // CPU monitoring
    this.cpuMonitor = setInterval(() => {
      this.collectCpuMetrics();
    }, 60000); // Every minute

    // Performance observer for additional metrics
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.recordPerformanceEntry(entry);
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'function'] });

    // Garbage collection monitoring (if available)
    if (typeof v8 !== 'undefined' && v8.getHeapStatistics) {
      this.gcMonitor = setInterval(() => {
        this.collectGCMetrics();
      }, 300000); // Every 5 minutes
    }

    this.isCollecting = true;
    console.log('✅ APM monitoring initialized');
  }

  /**
   * Record API response time
   */
  recordApiCall(method, url, responseTime, statusCode, userId = null) {
    const metric = {
      timestamp: Date.now(),
      method,
      url: url.replace(/\/api\//, '/api/'), // Normalize URLs
      responseTime,
      statusCode,
      userId,
      success: statusCode >= 200 && statusCode < 400
    };

    this.metrics.apiCalls.push(metric);

    // Keep only last 1000 API calls
    if (this.metrics.apiCalls.length > 1000) {
      this.metrics.apiCalls = this.metrics.apiCalls.slice(-1000);
    }

    // Check thresholds
    if (responseTime > this.thresholds.responseTime) {
      this.createAlert('high_response_time', {
        method,
        url,
        responseTime,
        threshold: this.thresholds.responseTime
      });
    }

    // Update response time metrics
    this.metrics.responseTimes.push(responseTime);
    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-100);
    }
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(operation, collection, duration, success = true, error = null) {
    const metric = {
      timestamp: Date.now(),
      operation,
      collection,
      duration,
      success,
      error: error ? error.message : null
    };

    this.metrics.databaseQueries.push(metric);

    // Keep only last 500 queries
    if (this.metrics.databaseQueries.length > 500) {
      this.metrics.databaseQueries = this.metrics.databaseQueries.slice(-500);
    }

    // Alert on slow queries
    if (duration > 5000) { // 5 seconds
      this.createAlert('slow_database_query', {
        operation,
        collection,
        duration,
        threshold: 5000
      });
    }
  }

  /**
   * Record error
   */
  recordError(error, context = {}) {
    const errorMetric = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      severity: this.determineErrorSeverity(error)
    };

    this.metrics.errorRates.push(errorMetric);

    // Keep only last 200 errors
    if (this.metrics.errorRates.length > 200) {
      this.metrics.errorRates = this.metrics.errorRates.slice(-200);
    }

    // Check error rate threshold
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes
    const errorRate = recentErrors.length / 5; // Errors per minute

    if (errorRate > this.thresholds.errorRate) {
      this.createAlert('high_error_rate', {
        errorRate,
        threshold: this.thresholds.errorRate,
        recentErrors: recentErrors.length
      });
    }
  }

  /**
   * Collect memory metrics
   */
  collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const systemMemory = os.totalmem();
    const freeMemory = os.freemem();

    // Calculate heap memory utilization (what Node.js actually uses)
    // This is the correct metric for Node.js applications, not system memory
    const heapUtilization = memUsage.heapTotal > 0 
      ? memUsage.heapUsed / memUsage.heapTotal 
      : 0;

    const metric = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      systemTotal: systemMemory,
      systemFree: freeMemory,
      systemUsed: systemMemory - freeMemory,
      systemUtilization: (systemMemory - freeMemory) / systemMemory,
      utilization: heapUtilization // Use heap utilization for alerts
    };

    this.metrics.memoryUsage.push(metric);

    // Keep only last 100 memory readings
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }

    // Check heap size limit to see if we're close to maximum
    let heapSizeLimit = null;
    let limitUtilization = null;
    try {
      const heapStats = v8.getHeapStatistics();
      heapSizeLimit = heapStats.heap_size_limit;
      limitUtilization = metric.heapUsed / heapSizeLimit;
      
      // Critical alert if we're close to the actual heap size limit (98% of limit)
      if (limitUtilization > this.thresholds.memoryCritical) {
        this.createAlert('critical_memory_usage', {
          utilization: metric.utilization,
          limitUtilization: limitUtilization,
          threshold: this.thresholds.memoryCritical,
          heapUsed: metric.heapUsed,
          heapTotal: metric.heapTotal,
          heapSizeLimit: heapSizeLimit,
          heapUsedMB: Math.round(metric.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(metric.heapTotal / 1024 / 1024),
          heapLimitMB: Math.round(heapSizeLimit / 1024 / 1024)
        });
        
        // Try to trigger garbage collection if available (Node.js with --expose-gc flag)
        // Note: Use --expose-gc flag only if needed; V8's automatic GC is generally better
        if (global.gc && typeof global.gc === 'function') {
          try {
            global.gc();
            console.log('⚠️ Triggered manual GC due to critical memory usage');
          } catch (gcError) {
            console.warn('⚠️ Failed to trigger GC:', gcError.message);
          }
        }
      } else if (limitUtilization > 0.99) {
        // Warn if we're extremely close to limit (99%+) even if not at critical threshold
        console.warn('⚠️ Critical: Memory usage at 99%+ of heap limit. Consider enabling --expose-gc for manual GC if needed.');
      }
    } catch (error) {
      // Heap statistics not available, continue with basic check
    }
    
    // Alert on high heap memory usage relative to allocated heap (only if significant)
    // Skip alerts in development or if heap is very small
    // Use 90% threshold for warnings (95%+ is normal for Node.js under load, but worth monitoring)
    // Only alert if we haven't already triggered a critical alert
    if (memUsage.heapTotal > 50 * 1024 * 1024 && // Only alert if heap > 50MB
        metric.utilization > this.thresholds.memoryUsage &&
        (!limitUtilization || limitUtilization < this.thresholds.memoryCritical)) {
      this.createAlert('high_memory_usage', {
        utilization: metric.utilization,
        threshold: this.thresholds.memoryUsage,
        heapUsed: metric.heapUsed,
        heapTotal: metric.heapTotal,
        heapUsedMB: Math.round(metric.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(metric.heapTotal / 1024 / 1024),
        heapSizeLimitMB: heapSizeLimit ? Math.round(heapSizeLimit / 1024 / 1024) : null,
        limitUtilization: limitUtilization || null
      });
    }
  }

  /**
   * Collect CPU metrics
   */
  collectCpuMetrics() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const utilization = 1 - idle / total;

    const metric = {
      timestamp: Date.now(),
      utilization,
      idle,
      total,
      cores: cpus.length
    };

    this.metrics.cpuUsage.push(metric);

    // Keep only last 60 CPU readings (1 hour)
    if (this.metrics.cpuUsage.length > 60) {
      this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-60);
    }

    // Alert on high CPU usage
    if (utilization > this.thresholds.cpuUsage) {
      this.createAlert('high_cpu_usage', {
        utilization,
        threshold: this.thresholds.cpuUsage,
        cores: cpus.length
      });
    }
  }

  /**
   * Collect garbage collection metrics
   */
  collectGCMetrics() {
    try {
      const heapStats = v8.getHeapStatistics();
      const heapSpaceStats = v8.getHeapSpaceStatistics();

      const metric = {
        timestamp: Date.now(),
        totalHeapSize: heapStats.total_heap_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        totalAvailableSize: heapStats.total_available_size,
        heapSpaces: heapSpaceStats.map(space => ({
          spaceName: space.space_name,
          spaceSize: space.space_size,
          spaceUsedSize: space.space_used_size,
          spaceAvailableSize: space.space_available_size,
          physicalSpaceSize: space.physical_space_size
        }))
      };

      // Store as custom metric
      this.setCustomMetric('gc_stats', metric);

    } catch (error) {
      console.warn('GC monitoring not available:', error.message);
    }
  }

  /**
   * Record performance entry
   */
  recordPerformanceEntry(entry) {
    // Store performance measurements
    const metric = {
      timestamp: Date.now(),
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      detail: entry.detail || {}
    };

    this.setCustomMetric(`perf_${entry.entryType}`, metric);
  }

  /**
   * Set custom metric
   */
  setCustomMetric(key, value) {
    if (!this.metrics.customMetrics.has(key)) {
      this.metrics.customMetrics.set(key, []);
    }

    const metrics = this.metrics.customMetrics.get(key);
    metrics.push({
      timestamp: Date.now(),
      value
    });

    // Keep only last 50 entries per custom metric
    if (metrics.length > 50) {
      this.metrics.customMetrics.set(key, metrics.slice(-50));
    }
  }

  /**
   * Create alert
   */
  createAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      data,
      acknowledged: false,
      severity: this.determineAlertSeverity(type, data)
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log alert
    console.warn(`🚨 APM Alert [${alert.severity.toUpperCase()}]: ${type}`, data);

    // Trigger alerting system
    if (global.alertingSystem) {
      global.alertingSystem.handleAlert(alert).catch(err =>
        console.error('APM alert failed:', err.message)
      )
    }
  }

  /**
   * Determine alert severity
   */
  determineAlertSeverity(type, data) {
    switch (type) {
      case 'high_error_rate':
        return data.errorRate > 0.1 ? 'critical' : 'high';
      case 'high_response_time':
        return data.responseTime > 5000 ? 'critical' : 'high';
      case 'critical_memory_usage':
        return 'critical';
      case 'high_memory_usage':
        // Check if we're very close to the limit
        if (data.limitUtilization && data.limitUtilization > 0.95) {
          return 'critical';
        }
        return 'high';
      case 'high_cpu_usage':
        return 'high';
      case 'slow_database_query':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Determine error severity
   */
  determineErrorSeverity(error) {
    if (error.name === 'MongoError' || error.name === 'ValidationError') {
      return 'high';
    }
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Trigger alert (to be implemented by alerting system)
   */
  triggerAlert(alert) {
    // This will be connected to the automated alerting system
    if (typeof global !== 'undefined' && global.alertingSystem) {
      global.alertingSystem.handleAlert(alert);
    }
  }

  /**
   * Get recent errors within time window
   */
  getRecentErrors(timeWindowMs = 300000) { // 5 minutes default
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.errorRates.filter(error => error.timestamp > cutoff);
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindowMs = 3600000) { // 1 hour default
    const cutoff = Date.now() - timeWindowMs;

    // Filter metrics within time window
    const recentApiCalls = this.metrics.apiCalls.filter(m => m.timestamp > cutoff);
    const recentErrors = this.metrics.errorRates.filter(m => m.timestamp > cutoff);
    const recentMemory = this.metrics.memoryUsage.filter(m => m.timestamp > cutoff);
    const recentCpu = this.metrics.cpuUsage.filter(m => m.timestamp > cutoff);

    // Calculate statistics
    const apiStats = this.calculateApiStats(recentApiCalls);
    const errorStats = this.calculateErrorStats(recentErrors);
    const systemStats = this.calculateSystemStats(recentMemory, recentCpu);

    return {
      timeWindow: timeWindowMs,
      timestamp: Date.now(),
      api: apiStats,
      errors: errorStats,
      system: systemStats,
      alerts: {
        active: this.alerts.filter(a => !a.acknowledged).length,
        total: this.alerts.length,
        recent: this.alerts.filter(a => a.timestamp > cutoff).length
      }
    };
  }

  /**
   * Calculate API statistics
   */
  calculateApiStats(apiCalls) {
    if (apiCalls.length === 0) return { count: 0, avgResponseTime: 0, successRate: 0 };

    const totalCalls = apiCalls.length;
    const successfulCalls = apiCalls.filter(call => call.success).length;
    const avgResponseTime = apiCalls.reduce((sum, call) => sum + call.responseTime, 0) / totalCalls;

    // Response time percentiles
    const sortedTimes = apiCalls.map(call => call.responseTime).sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    return {
      count: totalCalls,
      avgResponseTime: Math.round(avgResponseTime),
      successRate: successfulCalls / totalCalls,
      percentiles: { p50, p95, p99 },
      callsByMethod: this.groupBy(apiCalls, 'method'),
      callsByStatus: this.groupBy(apiCalls, 'statusCode')
    };
  }

  /**
   * Calculate error statistics
   */
  calculateErrorStats(errors) {
    if (errors.length === 0) return { count: 0, rate: 0, bySeverity: {} };

    return {
      count: errors.length,
      rate: errors.length / 5, // per minute over 5-minute window
      bySeverity: this.groupBy(errors, 'severity'),
      recent: errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Calculate system statistics
   */
  calculateSystemStats(memoryMetrics, cpuMetrics) {
    const memory = memoryMetrics.length > 0 ? {
      current: memoryMetrics[memoryMetrics.length - 1],
      avgUtilization: memoryMetrics.reduce((sum, m) => sum + m.utilization, 0) / memoryMetrics.length,
      peakUtilization: Math.max(...memoryMetrics.map(m => m.utilization))
    } : null;

    const cpu = cpuMetrics.length > 0 ? {
      current: cpuMetrics[cpuMetrics.length - 1],
      avgUtilization: cpuMetrics.reduce((sum, m) => sum + m.utilization, 0) / cpuMetrics.length,
      peakUtilization: Math.max(...cpuMetrics.map(m => m.utilization))
    } : null;

    return { memory, cpu };
  }

  /**
   * Group array by key
   */
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics() {
    return {
      ...this.metrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
      stats: this.getStats()
    };
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('✅ APM thresholds updated:', this.thresholds);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.memoryMonitor) clearInterval(this.memoryMonitor);
    if (this.cpuMonitor) clearInterval(this.cpuMonitor);
    if (this.gcMonitor) clearInterval(this.gcMonitor);
    if (this.performanceObserver) this.performanceObserver.disconnect();

    this.isCollecting = false;
    console.log('🛑 APM monitoring stopped');
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: this.isCollecting ? 'healthy' : 'stopped',
      metrics: this.getStats(300000), // Last 5 minutes
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    };
  }
}

// Create singleton instance
const apmMonitor = new APMMonitor();

// Middleware for Express
const apmMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;

    // Record API call
    apmMonitor.recordApiCall(
      req.method,
      req.originalUrl || req.url,
      responseTime,
      res.statusCode,
      req.user?.id
    );

    // Call original end
    originalEnd.apply(this, args);
  };

  next();
};

// Database query monitoring (to be used with mongoose)
const apmDatabaseMiddleware = (schema) => {
  schema.pre('save', function(next) {
    this._startTime = Date.now();
    next();
  });

  schema.post('save', function(doc) {
    const duration = Date.now() - this._startTime;
    apmMonitor.recordDatabaseQuery('save', this.constructor.modelName, duration);
  });

  schema.pre('find', function(next) {
    this._startTime = Date.now();
    next();
  });

  schema.post('find', function(result) {
    const duration = Date.now() - this._startTime;
    apmMonitor.recordDatabaseQuery('find', this.constructor.modelName, duration);
  });

  // Add more hooks as needed for other operations
};

module.exports = {
  apmMonitor,
  apmMiddleware,
  apmDatabaseMiddleware
};
