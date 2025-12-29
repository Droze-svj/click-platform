// Custom Benchmark Service
// Manages user-defined benchmarks

const CustomBenchmark = require('../models/CustomBenchmark');
const logger = require('../utils/logger');

/**
 * Create custom benchmark
 */
async function createCustomBenchmark(userId, benchmarkData) {
  try {
    const benchmark = new CustomBenchmark({
      userId,
      name: benchmarkData.name,
      platform: benchmarkData.platform || 'all',
      metrics: benchmarkData.metrics || {},
      isActive: true
    });

    await benchmark.save();
    logger.info('Custom benchmark created', { benchmarkId: benchmark._id, userId });
    return benchmark;
  } catch (error) {
    logger.error('Error creating custom benchmark', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's custom benchmarks
 */
async function getUserBenchmarks(userId) {
  try {
    const benchmarks = await CustomBenchmark.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return benchmarks;
  } catch (error) {
    logger.error('Error getting user benchmarks', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update custom benchmark
 */
async function updateCustomBenchmark(benchmarkId, userId, updates) {
  try {
    const benchmark = await CustomBenchmark.findOne({
      _id: benchmarkId,
      userId
    });

    if (!benchmark) {
      throw new Error('Benchmark not found');
    }

    Object.assign(benchmark, updates);
    await benchmark.save();

    return benchmark;
  } catch (error) {
    logger.error('Error updating custom benchmark', { error: error.message, benchmarkId });
    throw error;
  }
}

/**
 * Delete custom benchmark
 */
async function deleteCustomBenchmark(benchmarkId, userId) {
  try {
    const benchmark = await CustomBenchmark.findOneAndDelete({
      _id: benchmarkId,
      userId
    });

    if (!benchmark) {
      throw new Error('Benchmark not found');
    }

    return benchmark;
  } catch (error) {
    logger.error('Error deleting custom benchmark', { error: error.message, benchmarkId });
    throw error;
  }
}

/**
 * Evaluate content against custom benchmarks
 */
async function evaluateAgainstCustomBenchmarks(userId, contentId, performanceData) {
  try {
    const benchmarks = await CustomBenchmark.find({
      userId,
      isActive: true,
      $or: [
        { platform: 'all' },
        { platform: performanceData.platform }
      ]
    }).lean();

    if (benchmarks.length === 0) {
      return {
        hasCustomBenchmarks: false,
        message: 'No custom benchmarks defined'
      };
    }

    const evaluations = benchmarks.map(benchmark => {
      const evaluation = {
        benchmarkId: benchmark._id,
        benchmarkName: benchmark.name,
        platform: benchmark.platform,
        passed: true,
        metrics: {}
      };

      // Evaluate each metric
      ['engagement', 'engagementRate', 'impressions'].forEach(metric => {
        const benchmarkMetric = benchmark.metrics[metric];
        if (!benchmarkMetric) return;

        const currentValue = performanceData.metrics[metric] || 0;
        const target = benchmarkMetric.target;
        const min = benchmarkMetric.min;
        const max = benchmarkMetric.max;

        let passed = true;
        let status = 'meets';

        if (target !== null) {
          const diff = Math.abs(currentValue - target) / target;
          if (diff > 0.1) { // 10% tolerance
            passed = false;
            status = currentValue < target ? 'below' : 'above';
          }
        }

        if (min !== null && currentValue < min) {
          passed = false;
          status = 'below';
        }

        if (max !== null && currentValue > max) {
          passed = false;
          status = 'above';
        }

        evaluation.metrics[metric] = {
          current: currentValue,
          target,
          min,
          max,
          passed,
          status
        };

        if (!passed) {
          evaluation.passed = false;
        }
      });

      return evaluation;
    });

    return {
      hasCustomBenchmarks: true,
      evaluations,
      overallPassed: evaluations.every(e => e.passed)
    };
  } catch (error) {
    logger.error('Error evaluating custom benchmarks', { error: error.message, userId, contentId });
    throw error;
  }
}

module.exports = {
  createCustomBenchmark,
  getUserBenchmarks,
  updateCustomBenchmark,
  deleteCustomBenchmark,
  evaluateAgainstCustomBenchmarks
};


