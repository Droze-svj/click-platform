// Agency Business Dashboard Service
// Aggregate all agency business metrics

const { getRetentionMetrics } = require('./clientRetentionService');
const { getSatisfactionMetrics } = require('./clientSatisfactionService');
const { getCampaignCPAMetrics } = require('./campaignCPAService');
const { getInternalEfficiencyMetrics } = require('./internalEfficiencyService');
const logger = require('../utils/logger');

/**
 * Get agency business dashboard
 */
async function getAgencyBusinessDashboard(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    // Get all metrics
    const [retention, satisfaction, cpa, efficiency] = await Promise.all([
      getRetentionMetrics(agencyWorkspaceId, { startDate, endDate }),
      getSatisfactionMetrics(agencyWorkspaceId, { startDate, endDate }),
      getCampaignCPAMetrics(agencyWorkspaceId, { startDate, endDate }),
      getInternalEfficiencyMetrics(agencyWorkspaceId, { startDate, endDate, period: 'monthly' })
    ]);

    // Calculate overall health score
    const healthScore = calculateAgencyHealthScore(retention, satisfaction, cpa, efficiency);

    return {
      overview: {
        healthScore,
        summary: {
          retentionRate: retention.summary.retentionRate,
          nps: satisfaction.nps.nps,
          averageCPA: cpa.averages.cpa,
          utilizationRate: efficiency.summary?.current?.team.utilizationRate || 0
        }
      },
      retention,
      satisfaction,
      cpa,
      efficiency,
      insights: generateInsights(retention, satisfaction, cpa, efficiency)
    };
  } catch (error) {
    logger.error('Error getting agency business dashboard', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Calculate agency health score
 */
function calculateAgencyHealthScore(retention, satisfaction, cpa, efficiency) {
  let score = 0;

  // Retention (30%)
  const retentionScore = retention.summary.retentionRate;
  score += (retentionScore / 100) * 30;

  // NPS (25%)
  const npsScore = satisfaction.nps.nps;
  const normalizedNPS = ((npsScore + 100) / 200) * 100; // Normalize -100 to 100 to 0-100
  score += (normalizedNPS / 100) * 25;

  // Efficiency (25%)
  const efficiencyScore = efficiency.summary?.current?.efficiency.efficiencyScore || 0;
  score += (efficiencyScore / 100) * 25;

  // CPA/CLTV (20%)
  const cltvToCAC = cpa.averages.cltvToCAC || 0;
  const cpaScore = Math.min(100, (cltvToCAC / 3) * 100); // 3:1 ratio = 100
  score += (cpaScore / 100) * 20;

  return Math.round(score);
}

/**
 * Generate insights
 */
function generateInsights(retention, satisfaction, cpa, efficiency) {
  const insights = [];

  // Retention insights
  if (retention.summary.retentionRate < 80) {
    insights.push({
      type: 'warning',
      category: 'retention',
      message: `Retention rate is ${retention.summary.retentionRate}%. Focus on client engagement and satisfaction.`,
      priority: 'high'
    });
  }

  if (retention.summary.atRiskClients > 0) {
    insights.push({
      type: 'warning',
      category: 'retention',
      message: `${retention.summary.atRiskClients} clients are at risk of churning. Take proactive action.`,
      priority: 'high'
    });
  }

  // Satisfaction insights
  if (satisfaction.nps.nps < 0) {
    insights.push({
      type: 'warning',
      category: 'satisfaction',
      message: `NPS is negative (${satisfaction.nps.nps}). Focus on improving client experience.`,
      priority: 'high'
    });
  }

  // CPA insights
  if (cpa.averages.cltvToCAC < 3) {
    insights.push({
      type: 'warning',
      category: 'cpa',
      message: `CLTV to CAC ratio is ${cpa.averages.cltvToCAC.toFixed(2)}. Aim for at least 3:1.`,
      priority: 'medium'
    });
  }

  // Efficiency insights
  const utilization = efficiency.summary?.current?.team.utilizationRate || 0;
  if (utilization < 70) {
    insights.push({
      type: 'warning',
      category: 'efficiency',
      message: `Utilization rate is ${utilization.toFixed(1)}%. Consider optimizing team capacity.`,
      priority: 'medium'
    });
  }

  // Positive insights
  if (retention.summary.retentionRate >= 90) {
    insights.push({
      type: 'success',
      category: 'retention',
      message: `Excellent retention rate of ${retention.summary.retentionRate}%!`,
      priority: 'low'
    });
  }

  if (satisfaction.nps.nps >= 50) {
    insights.push({
      type: 'success',
      category: 'satisfaction',
      message: `Strong NPS of ${satisfaction.nps.nps}!`,
      priority: 'low'
    });
  }

  return insights;
}

module.exports = {
  getAgencyBusinessDashboard
};


