// Business Optimization Service
// Generate recommendations for improving business metrics

const { getRetentionMetrics } = require('./clientRetentionService');
const { getSatisfactionMetrics } = require('./clientSatisfactionService');
const { getCampaignCPAMetrics } = require('./campaignCPAService');
const { getInternalEfficiencyMetrics } = require('./internalEfficiencyService');
const { compareAgainstBenchmarks } = require('./industryBenchmarkService');
const logger = require('../utils/logger');

/**
 * Generate optimization recommendations
 */
async function generateOptimizationRecommendations(agencyWorkspaceId) {
  try {
    const recommendations = [];

    // Get all metrics
    const [retention, satisfaction, cpa, efficiency] = await Promise.all([
      getRetentionMetrics(agencyWorkspaceId),
      getSatisfactionMetrics(agencyWorkspaceId),
      getCampaignCPAMetrics(agencyWorkspaceId),
      getInternalEfficiencyMetrics(agencyWorkspaceId)
    ]);

    // Compare against benchmarks
    const benchmarks = await compareAgainstBenchmarks(agencyWorkspaceId, {
      retention,
      satisfaction,
      cpa,
      efficiency
    });

    // Retention recommendations
    if (benchmarks.retention) {
      if (benchmarks.retention.retentionRate.status === 'needs_improvement') {
        recommendations.push({
          category: 'retention',
          priority: 'high',
          title: 'Improve Client Retention',
          description: `Retention rate is ${retention.summary.retentionRate}%, below industry average of ${benchmarks.retention.retentionRate.benchmark}%`,
          actions: [
            'Increase client engagement and communication',
            'Proactively address at-risk clients',
            'Improve onboarding process',
            'Deliver consistent value and results'
          ],
          expectedImpact: `Increase retention rate by 5-10%`,
          timeframe: '3-6 months',
          benchmark: benchmarks.retention.retentionRate
        });
      }

      if (retention.summary.atRiskClients > 0) {
        recommendations.push({
          category: 'retention',
          priority: 'critical',
          title: 'Address At-Risk Clients',
          description: `${retention.summary.atRiskClients} clients are at risk of churning`,
          actions: [
            'Schedule immediate outreach calls',
            'Identify and address specific concerns',
            'Offer retention incentives if appropriate',
            'Improve service delivery for at-risk clients'
          ],
          expectedImpact: `Prevent ${Math.round(retention.summary.atRiskClients * 0.5)} client churns`,
          timeframe: 'Immediate',
          benchmark: null
        });
      }
    }

    // Satisfaction recommendations
    if (benchmarks.satisfaction) {
      if (benchmarks.satisfaction.nps.status === 'needs_improvement') {
        recommendations.push({
          category: 'satisfaction',
          priority: 'high',
          title: 'Improve NPS Score',
          description: `NPS is ${satisfaction.nps.nps}, below industry average of ${benchmarks.satisfaction.nps.benchmark}`,
          actions: [
            'Address detractor concerns immediately',
            'Follow up with passive clients to convert to promoters',
            'Improve overall service quality',
            'Increase value delivery'
          ],
          expectedImpact: `Increase NPS by 10-20 points`,
          timeframe: '2-4 months',
          benchmark: benchmarks.satisfaction.nps
        });
      }
    }

    // CPA recommendations
    if (benchmarks.cpa) {
      if (benchmarks.cpa.averageCPA.status === 'needs_improvement') {
        recommendations.push({
          category: 'cpa',
          priority: 'high',
          title: 'Reduce Cost Per Acquisition',
          description: `Average CPA is $${cpa.averages.cpa}, above industry average of $${benchmarks.cpa.averageCPA.benchmark}`,
          actions: [
            'Optimize campaign targeting and audiences',
            'Improve ad creative and messaging',
            'Test different ad formats and placements',
            'Negotiate better platform rates',
            'Focus on higher-converting campaigns'
          ],
          expectedImpact: `Reduce CPA by 15-25%`,
          timeframe: '1-3 months',
          benchmark: benchmarks.cpa.averageCPA
        });
      }

      if (cpa.averages.cltvToCAC < 3) {
        recommendations.push({
          category: 'cpa',
          priority: 'medium',
          title: 'Improve CLTV to CAC Ratio',
          description: `CLTV to CAC ratio is ${cpa.averages.cltvToCAC.toFixed(2)}, below optimal 3:1 ratio`,
          actions: [
            'Focus on customer retention and lifetime value',
            'Implement upsell and cross-sell strategies',
            'Improve customer onboarding and success',
            'Reduce customer acquisition costs'
          ],
          expectedImpact: `Improve ratio to 3:1 or better`,
          timeframe: '3-6 months',
          benchmark: benchmarks.cpa.cltvToCAC
        });
      }
    }

    // Efficiency recommendations
    if (benchmarks.efficiency) {
      if (benchmarks.efficiency.utilization.status === 'needs_improvement') {
        recommendations.push({
          category: 'efficiency',
          priority: 'medium',
          title: 'Improve Team Utilization',
          description: `Utilization rate is ${efficiency.summary.current.team.utilizationRate.toFixed(1)}%, below industry average of ${benchmarks.efficiency.utilization.benchmark}%`,
          actions: [
            'Optimize team capacity and workload',
            'Improve project planning and resource allocation',
            'Reduce non-billable time',
            'Automate repetitive tasks'
          ],
          expectedImpact: `Increase utilization to 75-85%`,
          timeframe: '2-3 months',
          benchmark: benchmarks.efficiency.utilization
        });
      }

      if (benchmarks.efficiency.revenuePerFTE.status === 'needs_improvement') {
        recommendations.push({
          category: 'efficiency',
          priority: 'high',
          title: 'Increase Revenue Per FTE',
          description: `Revenue per FTE is $${efficiency.summary.current.revenue.revenuePerFTE}, below industry average of $${benchmarks.efficiency.revenuePerFTE.benchmark}`,
          actions: [
            'Increase client rates and pricing',
            'Focus on higher-value clients',
            'Improve team productivity',
            'Reduce overhead costs',
            'Optimize service mix'
          ],
          expectedImpact: `Increase revenue per FTE by 20-30%`,
          timeframe: '6-12 months',
          benchmark: benchmarks.efficiency.revenuePerFTE
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return {
      recommendations,
      summary: {
        total: recommendations.length,
        critical: recommendations.filter(r => r.priority === 'critical').length,
        high: recommendations.filter(r => r.priority === 'high').length,
        medium: recommendations.filter(r => r.priority === 'medium').length
      },
      benchmarks
    };
  } catch (error) {
    logger.error('Error generating optimization recommendations', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  generateOptimizationRecommendations
};


