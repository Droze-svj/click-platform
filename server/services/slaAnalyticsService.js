// SLA Analytics Service
// SLA performance analytics and reporting

const ApprovalSLA = require('../models/ApprovalSLA');
const ContentApproval = require('../models/ContentApproval');
const logger = require('../utils/logger');

/**
 * Get SLA analytics for client
 */
async function getSLAAnalytics(clientWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    // Get all approvals for client
    const approvals = await ContentApproval.find({
      'metadata.clientId': clientWorkspaceId
    }).lean();

    const approvalIds = approvals.map(a => a._id);

    // Get SLAs
    const query = { approvalId: { $in: approvalIds } };
    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) query.startedAt.$gte = new Date(startDate);
      if (endDate) query.startedAt.$lte = new Date(endDate);
    }

    const slas = await ApprovalSLA.find(query).lean();

    // Calculate metrics
    const total = slas.length;
    const completed = slas.filter(s => s.status === 'completed').length;
    const onTime = slas.filter(s => s.status === 'on_time').length;
    const atRisk = slas.filter(s => s.status === 'at_risk').length;
    const overdue = slas.filter(s => s.status === 'overdue').length;

    // Calculate average completion time
    const completedSLAs = slas.filter(s => s.completedAt);
    const averageCompletionTime = completedSLAs.length > 0
      ? completedSLAs.reduce((sum, s) => {
          const hours = (new Date(s.completedAt) - new Date(s.startedAt)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / completedSLAs.length
      : 0;

    // Calculate on-time rate
    const onTimeRate = completed > 0 ? (onTime / completed) * 100 : 0;

    // By stage
    const byStage = {};
    slas.forEach(sla => {
      if (!byStage[sla.stageName]) {
        byStage[sla.stageName] = {
          total: 0,
          completed: 0,
          onTime: 0,
          atRisk: 0,
          overdue: 0,
          averageHours: 0
        };
      }
      byStage[sla.stageName].total++;
      if (sla.status === 'completed') byStage[sla.stageName].completed++;
      if (sla.status === 'on_time') byStage[sla.stageName].onTime++;
      if (sla.status === 'at_risk') byStage[sla.stageName].atRisk++;
      if (sla.status === 'overdue') byStage[sla.stageName].overdue++;
    });

    // Calculate average hours per stage
    Object.keys(byStage).forEach(stage => {
      const stageSLAs = slas.filter(s => s.stageName === stage && s.completedAt);
      if (stageSLAs.length > 0) {
        byStage[stage].averageHours = stageSLAs.reduce((sum, s) => {
          const hours = (new Date(s.completedAt) - new Date(s.startedAt)) / (1000 * 60 * 60);
          return sum + hours;
        }, 0) / stageSLAs.length;
      }
    });

    // Trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSLAs = slas.filter(s => new Date(s.startedAt) >= thirtyDaysAgo);
    const dailyTrends = {};

    recentSLAs.forEach(sla => {
      const date = new Date(sla.startedAt).toISOString().split('T')[0];
      if (!dailyTrends[date]) {
        dailyTrends[date] = { total: 0, completed: 0, overdue: 0 };
      }
      dailyTrends[date].total++;
      if (sla.status === 'completed') dailyTrends[date].completed++;
      if (sla.status === 'overdue') dailyTrends[date].overdue++;
    });

    return {
      summary: {
        total,
        completed,
        onTime,
        atRisk,
        overdue,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        averageCompletionTime: Math.round(averageCompletionTime * 100) / 100
      },
      byStage,
      trends: {
        daily: Object.entries(dailyTrends).map(([date, data]) => ({
          date,
          ...data
        })).sort((a, b) => a.date.localeCompare(b.date))
      }
    };
  } catch (error) {
    logger.error('Error getting SLA analytics', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get SLA performance predictions
 */
async function getSLAPredictions(clientWorkspaceId) {
  try {
    // Get historical SLA data
    const approvals = await ContentApproval.find({
      'metadata.clientId': clientWorkspaceId
    }).lean();

    const approvalIds = approvals.map(a => a._id);
    const slas = await ApprovalSLA.find({
      approvalId: { $in: approvalIds },
      status: 'completed'
    }).lean();

    // Calculate average completion times by stage
    const stageAverages = {};
    slas.forEach(sla => {
      if (!stageAverages[sla.stageName]) {
        stageAverages[sla.stageName] = [];
      }
      const hours = (new Date(sla.completedAt) - new Date(sla.startedAt)) / (1000 * 60 * 60);
      stageAverages[sla.stageName].push(hours);
    });

    const predictions = {};
    Object.keys(stageAverages).forEach(stage => {
      const times = stageAverages[stage];
      const average = times.reduce((sum, t) => sum + t, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - average, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);

      predictions[stage] = {
        averageHours: Math.round(average * 100) / 100,
        predictedHours: Math.round((average + stdDev) * 100) / 100, // Conservative estimate
        confidence: times.length >= 10 ? 'high' : (times.length >= 5 ? 'medium' : 'low')
      };
    });

    return predictions;
  } catch (error) {
    logger.error('Error getting SLA predictions', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  getSLAAnalytics,
  getSLAPredictions
};


