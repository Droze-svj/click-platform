// Multi-Client Rollup Service
// Aggregate performance across all agency clients

const MultiClientRollup = require('../models/MultiClientRollup');
const Workspace = require('../models/Workspace');
const ContentApproval = require('../models/ContentApproval');
const ApprovalSLA = require('../models/ApprovalSLA');
const logger = require('../utils/logger');

/**
 * Generate or update multi-client rollup
 */
async function generateMultiClientRollup(agencyWorkspaceId, period) {
  try {
    // Get all client workspaces for this agency
    const clients = await Workspace.find({
      agencyWorkspaceId,
      isAgency: false
    }).lean();

    const clientSummaries = [];

    for (const client of clients) {
      try {
        const summary = await generateClientSummary(client._id, client.name, period);
        clientSummaries.push(summary);
      } catch (error) {
        logger.warn('Error generating client summary', { clientId: client._id, error: error.message });
      }
    }

    // Calculate totals
    const totals = calculateTotals(clientSummaries);

    // Calculate risk summary
    const riskSummary = calculateRiskSummary(clientSummaries);

    // Get top performers
    const topPerformers = getTopPerformers(clientSummaries);

    // Create or update rollup
    let rollup = await MultiClientRollup.findOne({ agencyWorkspaceId });
    if (!rollup) {
      rollup = new MultiClientRollup({
        agencyWorkspaceId,
        period,
        clients: clientSummaries,
        totals,
        riskSummary,
        topPerformers
      });
    } else {
      rollup.period = period;
      rollup.clients = clientSummaries;
      rollup.totals = totals;
      rollup.riskSummary = riskSummary;
      rollup.topPerformers = topPerformers;
    }

    await rollup.save();

    logger.info('Multi-client rollup generated', { agencyWorkspaceId, clientCount: clientSummaries.length });
    return rollup;
  } catch (error) {
    logger.error('Error generating multi-client rollup', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate client summary
 */
async function generateClientSummary(clientWorkspaceId, clientName, period) {
  // Get performance metrics
  const performance = await getClientPerformance(clientWorkspaceId, period);

  // Get health score
  const healthScore = await getClientHealthScore(clientWorkspaceId);

  // Get risk flags
  const riskFlags = await getClientRiskFlags(clientWorkspaceId);

  // Get benchmarks
  const benchmarks = await getClientBenchmarks(clientWorkspaceId, performance);

  return {
    clientWorkspaceId,
    clientName,
    performance,
    healthScore,
    riskFlags,
    benchmarks,
    period,
    lastUpdated: new Date()
  };
}

/**
 * Get client performance
 */
async function getClientPerformance(clientWorkspaceId, period) {
  // Would query actual performance data
  // For now, return placeholder structure
  return {
    totalReach: 0,
    totalImpressions: 0,
    totalEngagement: 0,
    engagementRate: 0,
    totalClicks: 0,
    ctr: 0,
    totalConversions: 0,
    conversionRate: 0,
    totalRevenue: 0,
    totalCost: 0,
    roi: 0,
    roas: 0
  };
}

/**
 * Get client health score
 */
async function getClientHealthScore(clientWorkspaceId) {
  try {
    // Would use actual health service
    // For now, return placeholder
    return {
      overall: 75,
      awareness: 80,
      engagement: 70,
      growth: 75,
      sentiment: 80,
      trend: 'stable'
    };
  } catch (error) {
    return {
      overall: 0,
      awareness: 0,
      engagement: 0,
      growth: 0,
      sentiment: 0,
      trend: 'stable'
    };
  }
}

/**
 * Get client risk flags
 */
async function getClientRiskFlags(clientWorkspaceId) {
  const flags = [];

  // Check health score
  const healthScore = await getClientHealthScore(clientWorkspaceId);
  if (healthScore.overall < 50) {
    flags.push({
      type: 'low_health_score',
      severity: healthScore.overall < 30 ? 'critical' : 'high',
      message: `Health score is ${healthScore.overall}, below acceptable threshold`,
      detectedAt: new Date()
    });
  }

  // Check SLA overdue
  const overdueSLAs = await ApprovalSLA.countDocuments({
    approvalId: { $in: await getClientApprovalIds(clientWorkspaceId) },
    status: 'overdue'
  });

  if (overdueSLAs > 0) {
    flags.push({
      type: 'sla_overdue',
      severity: overdueSLAs > 5 ? 'critical' : 'high',
      message: `${overdueSLAs} approval(s) are overdue`,
      detectedAt: new Date()
    });
  }

  // Check approval bottlenecks
  const pendingApprovals = await ContentApproval.countDocuments({
    'metadata.clientId': clientWorkspaceId,
    status: { $in: ['pending', 'in_progress'] },
    updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
  });

  if (pendingApprovals > 3) {
    flags.push({
      type: 'approval_bottleneck',
      severity: 'medium',
      message: `${pendingApprovals} approval(s) pending for over 7 days`,
      detectedAt: new Date()
    });
  }

  return flags;
}

/**
 * Get client approval IDs
 */
async function getClientApprovalIds(clientWorkspaceId) {
  const approvals = await ContentApproval.find({
    'metadata.clientId': clientWorkspaceId
  }).select('_id').lean();
  return approvals.map(a => a._id);
}

/**
 * Get client benchmarks
 */
async function getClientBenchmarks(clientWorkspaceId, performance) {
  // Would query industry benchmarks
  return {
    engagementRate: {
      value: performance.engagementRate || 0,
      industryAverage: 0,
      percentile: 0
    },
    ctr: {
      value: performance.ctr || 0,
      industryAverage: 0,
      percentile: 0
    },
    roi: {
      value: performance.roi || 0,
      industryAverage: 0,
      percentile: 0
    }
  };
}

/**
 * Calculate totals
 */
function calculateTotals(clientSummaries) {
  const totals = {
    totalReach: 0,
    totalImpressions: 0,
    totalEngagement: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
    totalCost: 0
  };

  let engagementRateSum = 0;
  let ctrSum = 0;
  let conversionRateSum = 0;
  let roiSum = 0;
  let roasSum = 0;
  let healthScoreSum = 0;
  let count = 0;

  clientSummaries.forEach(client => {
    totals.totalReach += client.performance.totalReach || 0;
    totals.totalImpressions += client.performance.totalImpressions || 0;
    totals.totalEngagement += client.performance.totalEngagement || 0;
    totals.totalClicks += client.performance.totalClicks || 0;
    totals.totalConversions += client.performance.totalConversions || 0;
    totals.totalRevenue += client.performance.totalRevenue || 0;
    totals.totalCost += client.performance.totalCost || 0;

    engagementRateSum += client.performance.engagementRate || 0;
    ctrSum += client.performance.ctr || 0;
    conversionRateSum += client.performance.conversionRate || 0;
    roiSum += client.performance.roi || 0;
    roasSum += client.performance.roas || 0;
    healthScoreSum += client.healthScore.overall || 0;
    count++;
  });

  return {
    ...totals,
    averageEngagementRate: count > 0 ? engagementRateSum / count : 0,
    averageCtr: count > 0 ? ctrSum / count : 0,
    averageConversionRate: count > 0 ? conversionRateSum / count : 0,
    averageRoi: count > 0 ? roiSum / count : 0,
    averageRoas: count > 0 ? roasSum / count : 0,
    averageHealthScore: count > 0 ? healthScoreSum / count : 0
  };
}

/**
 * Calculate risk summary
 */
function calculateRiskSummary(clientSummaries) {
  let clientsAtRisk = 0;
  let criticalRisks = 0;
  let highRisks = 0;
  let mediumRisks = 0;
  let lowRisks = 0;

  clientSummaries.forEach(client => {
    if (client.riskFlags.length > 0) {
      clientsAtRisk++;
    }

    client.riskFlags.forEach(flag => {
      switch (flag.severity) {
        case 'critical':
          criticalRisks++;
          break;
        case 'high':
          highRisks++;
          break;
        case 'medium':
          mediumRisks++;
          break;
        case 'low':
          lowRisks++;
          break;
      }
    });
  });

  return {
    totalClients: clientSummaries.length,
    clientsAtRisk,
    criticalRisks,
    highRisks,
    mediumRisks,
    lowRisks
  };
}

/**
 * Get top performers
 */
function getTopPerformers(clientSummaries) {
  const byEngagement = [...clientSummaries]
    .sort((a, b) => (b.performance.engagementRate || 0) - (a.performance.engagementRate || 0))
    .slice(0, 5)
    .map(c => ({
      clientWorkspaceId: c.clientWorkspaceId,
      clientName: c.clientName,
      value: c.performance.engagementRate || 0
    }));

  const byGrowth = [...clientSummaries]
    .sort((a, b) => (b.healthScore.growth || 0) - (a.healthScore.growth || 0))
    .slice(0, 5)
    .map(c => ({
      clientWorkspaceId: c.clientWorkspaceId,
      clientName: c.clientName,
      value: c.healthScore.growth || 0
    }));

  const byRoi = [...clientSummaries]
    .sort((a, b) => (b.performance.roi || 0) - (a.performance.roi || 0))
    .slice(0, 5)
    .map(c => ({
      clientWorkspaceId: c.clientWorkspaceId,
      clientName: c.clientName,
      value: c.performance.roi || 0
    }));

  return {
    byEngagement,
    byGrowth,
    byRoi
  };
}

/**
 * Get rollup
 */
async function getRollup(agencyWorkspaceId, period = null) {
  try {
    let rollup;

    if (period) {
      rollup = await MultiClientRollup.findOne({
        agencyWorkspaceId,
        'period.startDate': period.startDate,
        'period.endDate': period.endDate
      }).lean();
    } else {
      rollup = await MultiClientRollup.findOne({ agencyWorkspaceId })
        .sort({ generatedAt: -1 })
        .lean();
    }

    if (!rollup) {
      // Generate if doesn't exist
      const defaultPeriod = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date()
      };
      rollup = await generateMultiClientRollup(agencyWorkspaceId, period || defaultPeriod);
    }

    return rollup;
  } catch (error) {
    logger.error('Error getting rollup', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  generateMultiClientRollup,
  getRollup
};

