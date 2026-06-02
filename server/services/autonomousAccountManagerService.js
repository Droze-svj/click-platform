const logger = require('../utils/logger');
const agencyService = require('./agencyService');
const predictiveAnalytics = require('./predictiveAnalyticsService');
const reportingService = require('./reportBuilderService');

/**
 * Autonomous Account Manager Service ("God-Tier")
 * Automatically drafts personalized client reports and communications.
 */
class AutonomousAccountManagerService {
  constructor() {
    this.queuedReports = [];
  }

  /**
   * Generate a weekly autonomous report for a client
   * @param {string} agencyWorkspaceId
   * @param {string} clientWorkspaceId
   */
  async generateAutonomousReport(agencyWorkspaceId, clientWorkspaceId) {
    try {
      logger.info('Starting Autonomous Report Generation', { clientWorkspaceId });

      // Step 1: Aggregate Data
      const performance = await agencyService.getCrossClientBenchmarking(agencyWorkspaceId);
      const churnPrediction = await predictiveAnalytics.predictClientChurn(agencyWorkspaceId, clientWorkspaceId);
      
      // Step 2: Formulate "God-Tier" Insights
      const insights = this.deriveInsights(performance, churnPrediction);

      // Step 3: Build Report
      const reportContent = {
        title: `Weekly Growth Strategy - ${Date.now()}`,
        clientWorkspaceId,
        sections: [
          { header: 'Performance Snapshot', content: performance },
          { header: 'Retention & Health', content: churnPrediction },
          { header: 'AI Strategy Recommendations', content: insights }
        ],
        whiteLabeled: true
      };

      const finalReport = await reportingService.createReport(agencyWorkspaceId, reportContent);

      logger.info('Autonomous Report Drafted', { reportId: finalReport.id });

      return finalReport;
    } catch (error) {
      logger.error('Error in generateAutonomousReport', { error: error.message });
      throw error;
    }
  }

  deriveInsights(performance, churn) {
    const insights = [];

    // Churn-driven insight (real — from predictClientChurn).
    if (churn?.riskLevel === 'high') {
      const score = churn.score ?? churn.churnScore;
      insights.push(`CRITICAL: Churn risk is HIGH${score != null ? ` (${score})` : ''}. Schedule a 1-on-1 strategy call this week.`);
    } else if (churn?.riskLevel === 'medium') {
      insights.push('WATCH: Churn risk is moderate — reinforce recent wins in this report.');
    }

    // Performance-driven insights (real — from cross-client benchmarking).
    try {
      const rows = Array.isArray(performance) ? performance
        : Array.isArray(performance?.platforms) ? performance.platforms
          : Array.isArray(performance?.clients) ? performance.clients
            : Array.isArray(performance?.benchmarks) ? performance.benchmarks : [];
      const eng = (r) => (typeof r.engagement === 'number' ? r.engagement : r.avgEngagement);
      const ranked = rows.filter(r => typeof eng(r) === 'number').sort((a, b) => eng(b) - eng(a));
      if (ranked[0]) {
        const top = ranked[0];
        insights.push(`OPPORTUNITY: ${top.platform || top.name || 'Top channel'} is your strongest channel (engagement ${Math.round(eng(top))}). Double down there.`);
      }
      if (ranked.length > 1) {
        const worst = ranked[ranked.length - 1];
        insights.push(`REALLOCATE: ${worst.platform || worst.name || 'Lowest channel'} is underperforming — shift effort to higher-engagement formats.`);
      }
    } catch { /* fall through to default */ }

    if (insights.length === 0) {
      insights.push('Not enough cross-client data yet — insights sharpen as more posts publish.');
    }
    return insights;
  }
}

module.exports = new AutonomousAccountManagerService();
