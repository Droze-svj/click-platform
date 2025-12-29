// Resource Management Service

const os = require('os');
const logger = require('../utils/logger');

/**
 * Monitor system resources
 */
function monitorResources() {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercent = (usedMemory / totalMemory) * 100;

    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + (1 - idle / total);
    }, 0) / cpus.length * 100;

    const loadAvg = os.loadavg();

    return {
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percent: Math.round(memoryPercent * 100) / 100,
        unit: 'bytes',
      },
      cpu: {
        cores: cpus.length,
        usage: Math.round(cpuUsage * 100) / 100,
        loadAverage: loadAvg.map(load => Math.round(load * 100) / 100),
      },
      uptime: os.uptime(),
      platform: os.platform(),
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Monitor resources error', { error: error.message });
    throw error;
  }
}

/**
 * Check resource thresholds
 */
function checkResourceThresholds() {
  try {
    const resources = monitorResources();
    const alerts = [];

    // Memory threshold (90%)
    if (resources.memory.percent > 90) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `High memory usage: ${resources.memory.percent}%`,
        value: resources.memory.percent,
      });
    } else if (resources.memory.percent > 80) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Elevated memory usage: ${resources.memory.percent}%`,
        value: resources.memory.percent,
      });
    }

    // CPU threshold (90%)
    if (resources.cpu.usage > 90) {
      alerts.push({
        type: 'cpu',
        severity: 'critical',
        message: `High CPU usage: ${resources.cpu.usage}%`,
        value: resources.cpu.usage,
      });
    } else if (resources.cpu.usage > 80) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `Elevated CPU usage: ${resources.cpu.usage}%`,
        value: resources.cpu.usage,
      });
    }

    // Load average threshold
    const loadAvg1min = resources.cpu.loadAverage[0];
    if (loadAvg1min > resources.cpu.cores * 2) {
      alerts.push({
        type: 'load',
        severity: 'critical',
        message: `High load average: ${loadAvg1min}`,
        value: loadAvg1min,
      });
    }

    return {
      resources,
      alerts,
      healthy: alerts.filter(a => a.severity === 'critical').length === 0,
    };
  } catch (error) {
    logger.error('Check resource thresholds error', { error: error.message });
    throw error;
  }
}

/**
 * Get resource recommendations
 */
function getResourceRecommendations() {
  try {
    const status = checkResourceThresholds();
    const recommendations = [];

    if (status.resources.memory.percent > 80) {
      recommendations.push({
        type: 'memory',
        action: 'increase_memory',
        message: 'Consider increasing server memory or optimizing memory usage',
        priority: status.resources.memory.percent > 90 ? 'high' : 'medium',
      });
    }

    if (status.resources.cpu.usage > 80) {
      recommendations.push({
        type: 'cpu',
        action: 'scale_horizontal',
        message: 'Consider horizontal scaling or optimizing CPU-intensive operations',
        priority: status.resources.cpu.usage > 90 ? 'high' : 'medium',
      });
    }

    if (status.resources.cpu.loadAverage[0] > status.resources.cpu.cores) {
      recommendations.push({
        type: 'load',
        action: 'add_servers',
        message: 'Load average exceeds CPU cores - consider adding servers',
        priority: 'high',
      });
    }

    return {
      recommendations,
      currentStatus: status,
    };
  } catch (error) {
    logger.error('Get resource recommendations error', { error: error.message });
    throw error;
  }
}

module.exports = {
  monitorResources,
  checkResourceThresholds,
  getResourceRecommendations,
};






