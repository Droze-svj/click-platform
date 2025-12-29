// Monitoring Middleware

const { recordRequest, recordSystemMetric } = require('../services/monitoringService');
const os = require('os');

/**
 * Record system metrics periodically
 */
function startSystemMetricsCollection() {
  setInterval(() => {
    try {
      // Memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryPercent = (usedMemory / totalMemory) * 100;

      recordSystemMetric('memory', memoryPercent);

      // CPU usage (simplified)
      const cpus = os.cpus();
      const cpuUsage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + (1 - idle / total);
      }, 0) / cpus.length * 100;

      recordSystemMetric('cpu', cpuUsage);
    } catch (error) {
      // Silently fail metrics collection
    }
  }, 60000); // Every minute
}

// Start metrics collection
startSystemMetricsCollection();

module.exports = {};






