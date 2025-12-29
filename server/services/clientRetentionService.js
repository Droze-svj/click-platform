// Client Retention Service
// Track and analyze client retention and churn

const ClientRetention = require('../models/ClientRetention');
const logger = require('../utils/logger');

/**
 * Create or update client retention record
 */
async function upsertClientRetention(agencyWorkspaceId, clientWorkspaceId, data) {
  try {
    const {
      client,
      onboarding,
      subscription,
      engagement
    } = data;

    const retention = await ClientRetention.findOneAndUpdate(
      { agencyWorkspaceId, clientWorkspaceId },
      {
        $set: {
          agencyWorkspaceId,
          clientWorkspaceId,
          client,
          onboarding,
          subscription,
          engagement
        }
      },
      { upsert: true, new: true }
    );

    logger.info('Client retention updated', { agencyWorkspaceId, clientWorkspaceId });
    return retention;
  } catch (error) {
    logger.error('Error upserting client retention', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Record churn
 */
async function recordChurn(agencyWorkspaceId, clientWorkspaceId, churnData) {
  try {
    const {
      date,
      reason,
      reasonDetails,
      churnType = 'voluntary'
    } = churnData;

    const retention = await ClientRetention.findOneAndUpdate(
      { agencyWorkspaceId, clientWorkspaceId },
      {
        $set: {
          'subscription.status': 'cancelled',
          'churn.date': new Date(date),
          'churn.reason': reason,
          'churn.reasonDetails': reasonDetails,
          'churn.churnType': churnType,
          'retention.isRetained': false,
          'retention.retentionRate': 0
        }
      },
      { new: true }
    );

    if (!retention) {
      throw new Error('Client retention record not found');
    }

    logger.info('Churn recorded', { agencyWorkspaceId, clientWorkspaceId, reason });
    return retention;
  } catch (error) {
    logger.error('Error recording churn', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Calculate churn risk
 */
async function calculateChurnRisk(agencyWorkspaceId, clientWorkspaceId) {
  try {
    const retention = await ClientRetention.findOne({
      agencyWorkspaceId,
      clientWorkspaceId
    }).lean();

    if (!retention) {
      throw new Error('Client retention record not found');
    }

    let riskScore = 0;

    // Low engagement (30%)
    if (retention.engagement.activityScore < 30) {
      riskScore += 30;
    } else if (retention.engagement.activityScore < 50) {
      riskScore += 15;
    }

    // Low login frequency (20%)
    if (retention.engagement.loginFrequency < 2) {
      riskScore += 20;
    } else if (retention.engagement.loginFrequency < 5) {
      riskScore += 10;
    }

    // Low feature usage (20%)
    const activeFeatures = retention.engagement.featureUsage.filter(
      f => new Date(f.lastUsed) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    if (activeFeatures < 2) {
      riskScore += 20;
    } else if (activeFeatures < 4) {
      riskScore += 10;
    }

    // Low satisfaction (15%)
    // Would integrate with satisfaction data
    // For now, assume medium risk
    riskScore += 7.5;

    // Recent issues (15%)
    // Would check for support tickets, complaints, etc.
    // For now, assume low risk
    riskScore += 5;

    // Update churn risk
    await ClientRetention.findByIdAndUpdate(retention._id, {
      $set: {
        'churn.churnRiskScore': Math.min(100, Math.round(riskScore)),
        'churn.predictedChurn': riskScore > 50
      }
    });

    return {
      riskScore: Math.min(100, Math.round(riskScore)),
      predictedChurn: riskScore > 50,
      factors: {
        engagement: retention.engagement.activityScore < 30,
        loginFrequency: retention.engagement.loginFrequency < 2,
        featureUsage: activeFeatures < 2
      }
    };
  } catch (error) {
    logger.error('Error calculating churn risk', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get retention metrics
 */
async function getRetentionMetrics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate
    } = filters;

    const query = { agencyWorkspaceId };
    if (startDate || endDate) {
      query['subscription.startDate'] = {};
      if (startDate) query['subscription.startDate'].$gte = new Date(startDate);
      if (endDate) query['subscription.startDate'].$lte = new Date(endDate);
    }

    const clients = await ClientRetention.find(query).lean();

    const active = clients.filter(c => c.subscription.status === 'active');
    const churned = clients.filter(c => c.subscription.status === 'cancelled' || c.subscription.status === 'expired');

    // Calculate retention rate
    const total = clients.length;
    const retentionRate = total > 0 ? (active.length / total) * 100 : 0;

    // Calculate churn rate
    const churnRate = total > 0 ? (churned.length / total) * 100 : 0;

    // Calculate average lifetime value
    const averageLTV = clients.length > 0
      ? clients.reduce((sum, c) => sum + (c.retention.lifetimeValue || 0), 0) / clients.length
      : 0;

    // Calculate average lifetime (months)
    const averageLifetime = clients.length > 0
      ? clients.reduce((sum, c) => sum + (c.retention.monthsActive || 0), 0) / clients.length
      : 0;

    // Churn by reason
    const churnByReason = {};
    churned.forEach(c => {
      if (c.churn.reason) {
        churnByReason[c.churn.reason] = (churnByReason[c.churn.reason] || 0) + 1;
      }
    });

    // At-risk clients
    const atRisk = clients.filter(c => c.churn.churnRiskScore > 50);

    return {
      summary: {
        totalClients: total,
        activeClients: active.length,
        churnedClients: churned.length,
        retentionRate: Math.round(retentionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        averageLTV: Math.round(averageLTV * 100) / 100,
        averageLifetime: Math.round(averageLifetime * 100) / 100,
        atRiskClients: atRisk.length
      },
      churnByReason,
      trends: {
        retentionRate,
        churnRate,
        averageLTV,
        averageLifetime
      }
    };
  } catch (error) {
    logger.error('Error getting retention metrics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  upsertClientRetention,
  recordChurn,
  calculateChurnRisk,
  getRetentionMetrics
};


