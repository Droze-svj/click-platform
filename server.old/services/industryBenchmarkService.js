// Industry Benchmark Service
// Compare agency metrics against industry standards

const logger = require('../utils/logger');

/**
 * Get industry benchmarks
 */
function getIndustryBenchmarks() {
  return {
    retention: {
      averageRetentionRate: 85, // Percentage
      topQuartileRetentionRate: 92,
      averageChurnRate: 15,
      averageLTV: 50000,
      averageLifetime: 18 // Months
    },
    satisfaction: {
      averageNPS: 30,
      topQuartileNPS: 50,
      averageCSAT: 4.2,
      averageOverallSatisfaction: 75
    },
    cpa: {
      averageCPA: 75,
      topQuartileCPA: 50,
      averageCLTV: 5000,
      averageCLTVToCAC: 3.5,
      averageROAS: 300,
      averageROI: 200
    },
    efficiency: {
      averageUtilization: 75, // Percentage
      topQuartileUtilization: 85,
      averagePostsPerFTE: 50,
      topQuartilePostsPerFTE: 70,
      averageRevenuePerFTE: 150000,
      topQuartileRevenuePerFTE: 200000,
      averageRevenuePerHour: 200,
      topQuartileRevenuePerHour: 250
    }
  };
}

/**
 * Compare metrics against industry benchmarks
 */
async function compareAgainstBenchmarks(agencyWorkspaceId, metrics) {
  try {
    const benchmarks = getIndustryBenchmarks();
    const comparison = {};

    // Retention comparison
    if (metrics.retention) {
      comparison.retention = {
        retentionRate: {
          value: metrics.retention.retentionRate,
          benchmark: benchmarks.retention.averageRetentionRate,
          topQuartile: benchmarks.retention.topQuartileRetentionRate,
          percentile: calculatePercentile(
            metrics.retention.retentionRate,
            benchmarks.retention.averageRetentionRate,
            benchmarks.retention.topQuartileRetentionRate
          ),
          status: getStatus(metrics.retention.retentionRate, benchmarks.retention.averageRetentionRate)
        },
        churnRate: {
          value: metrics.retention.churnRate,
          benchmark: benchmarks.retention.averageChurnRate,
          percentile: calculatePercentile(
            100 - metrics.retention.churnRate,
            100 - benchmarks.retention.averageChurnRate,
            100 - benchmarks.retention.averageChurnRate * 0.5
          ),
          status: getStatus(100 - metrics.retention.churnRate, 100 - benchmarks.retention.averageChurnRate, true)
        },
        averageLTV: {
          value: metrics.retention.averageLTV,
          benchmark: benchmarks.retention.averageLTV,
          percentile: calculatePercentile(
            metrics.retention.averageLTV,
            benchmarks.retention.averageLTV,
            benchmarks.retention.averageLTV * 1.5
          ),
          status: getStatus(metrics.retention.averageLTV, benchmarks.retention.averageLTV)
        }
      };
    }

    // Satisfaction comparison
    if (metrics.satisfaction) {
      comparison.satisfaction = {
        nps: {
          value: metrics.satisfaction.nps.nps,
          benchmark: benchmarks.satisfaction.averageNPS,
          topQuartile: benchmarks.satisfaction.topQuartileNPS,
          percentile: calculatePercentile(
            metrics.satisfaction.nps.nps,
            benchmarks.satisfaction.averageNPS,
            benchmarks.satisfaction.topQuartileNPS
          ),
          status: getStatus(metrics.satisfaction.nps.nps, benchmarks.satisfaction.averageNPS)
        },
        csat: {
          value: metrics.satisfaction.csat.average,
          benchmark: benchmarks.satisfaction.averageCSAT,
          percentile: calculatePercentile(
            metrics.satisfaction.csat.average,
            benchmarks.satisfaction.averageCSAT,
            benchmarks.satisfaction.averageCSAT * 1.1
          ),
          status: getStatus(metrics.satisfaction.csat.average, benchmarks.satisfaction.averageCSAT)
        }
      };
    }

    // CPA comparison
    if (metrics.cpa) {
      comparison.cpa = {
        averageCPA: {
          value: metrics.cpa.averages.cpa,
          benchmark: benchmarks.cpa.averageCPA,
          topQuartile: benchmarks.cpa.topQuartileCPA,
          percentile: calculatePercentile(
            benchmarks.cpa.averageCPA / metrics.cpa.averages.cpa, // Inverse (lower is better)
            benchmarks.cpa.averageCPA / benchmarks.cpa.averageCPA,
            benchmarks.cpa.averageCPA / benchmarks.cpa.topQuartileCPA
          ),
          status: getStatus(benchmarks.cpa.averageCPA / metrics.cpa.averages.cpa, 1, true)
        },
        cltvToCAC: {
          value: metrics.cpa.averages.cltvToCAC,
          benchmark: benchmarks.cpa.averageCLTVToCAC,
          percentile: calculatePercentile(
            metrics.cpa.averages.cltvToCAC,
            benchmarks.cpa.averageCLTVToCAC,
            benchmarks.cpa.averageCLTVToCAC * 1.5
          ),
          status: getStatus(metrics.cpa.averages.cltvToCAC, benchmarks.cpa.averageCLTVToCAC)
        }
      };
    }

    // Efficiency comparison
    if (metrics.efficiency && metrics.efficiency.summary?.current) {
      const eff = metrics.efficiency.summary.current;
      comparison.efficiency = {
        utilization: {
          value: eff.team.utilizationRate,
          benchmark: benchmarks.efficiency.averageUtilization,
          topQuartile: benchmarks.efficiency.topQuartileUtilization,
          percentile: calculatePercentile(
            eff.team.utilizationRate,
            benchmarks.efficiency.averageUtilization,
            benchmarks.efficiency.topQuartileUtilization
          ),
          status: getStatus(eff.team.utilizationRate, benchmarks.efficiency.averageUtilization)
        },
        postsPerFTE: {
          value: eff.content.postsPerFTE,
          benchmark: benchmarks.efficiency.averagePostsPerFTE,
          topQuartile: benchmarks.efficiency.topQuartilePostsPerFTE,
          percentile: calculatePercentile(
            eff.content.postsPerFTE,
            benchmarks.efficiency.averagePostsPerFTE,
            benchmarks.efficiency.topQuartilePostsPerFTE
          ),
          status: getStatus(eff.content.postsPerFTE, benchmarks.efficiency.averagePostsPerFTE)
        },
        revenuePerFTE: {
          value: eff.revenue.revenuePerFTE,
          benchmark: benchmarks.efficiency.averageRevenuePerFTE,
          topQuartile: benchmarks.efficiency.topQuartileRevenuePerFTE,
          percentile: calculatePercentile(
            eff.revenue.revenuePerFTE,
            benchmarks.efficiency.averageRevenuePerFTE,
            benchmarks.efficiency.topQuartileRevenuePerFTE
          ),
          status: getStatus(eff.revenue.revenuePerFTE, benchmarks.efficiency.averageRevenuePerFTE)
        }
      };
    }

    return comparison;
  } catch (error) {
    logger.error('Error comparing against benchmarks', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(value, average, topQuartile) {
  if (value >= topQuartile) return 90;
  if (value >= average) return 50;
  if (value >= average * 0.8) return 25;
  return 10;
}

/**
 * Get status
 */
function getStatus(value, benchmark, inverse = false) {
  if (inverse) {
    // For metrics where lower is better (e.g., churn rate, CPA)
    if (value >= benchmark * 1.2) return 'excellent';
    if (value >= benchmark) return 'good';
    if (value >= benchmark * 0.8) return 'fair';
    return 'needs_improvement';
  } else {
    // For metrics where higher is better
    if (value >= benchmark * 1.2) return 'excellent';
    if (value >= benchmark) return 'good';
    if (value >= benchmark * 0.8) return 'fair';
    return 'needs_improvement';
  }
}

module.exports = {
  getIndustryBenchmarks,
  compareAgainstBenchmarks
};


