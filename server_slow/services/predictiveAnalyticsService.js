// Predictive Analytics Service
// Churn prediction, revenue forecasting, satisfaction forecasting

const ClientRetention = require('../models/ClientRetention');
const ClientSatisfaction = require('../models/ClientSatisfaction');
const CampaignCPA = require('../models/CampaignCPA');
const InternalEfficiency = require('../models/InternalEfficiency');
const logger = require('../utils/logger');

/**
 * Predict client churn
 */
async function predictClientChurn(agencyWorkspaceId, clientWorkspaceId) {
  try {
    const retention = await ClientRetention.findOne({
      agencyWorkspaceId,
      clientWorkspaceId
    }).lean();

    if (!retention) {
      throw new Error('Client retention record not found');
    }

    // Get satisfaction data
    const satisfaction = await ClientSatisfaction.findOne({
      agencyWorkspaceId,
      clientWorkspaceId
    })
      .sort({ 'survey.date': -1 })
      .lean();

    // Calculate churn probability
    let churnProbability = 0;

    // Engagement factors (40%)
    if (retention.engagement.activityScore < 30) churnProbability += 40;
    else if (retention.engagement.activityScore < 50) churnProbability += 20;
    else if (retention.engagement.activityScore < 70) churnProbability += 10;

    // Login frequency (20%)
    if (retention.engagement.loginFrequency < 2) churnProbability += 20;
    else if (retention.engagement.loginFrequency < 5) churnProbability += 10;

    // Satisfaction (20%)
    if (satisfaction) {
      if (satisfaction.nps && satisfaction.nps.score < 6) churnProbability += 20;
      else if (satisfaction.nps && satisfaction.nps.score < 8) churnProbability += 10;
      
      if (satisfaction.overallSatisfaction && satisfaction.overallSatisfaction.score < 50) {
        churnProbability += 10;
      }
    }

    // Lifetime (10%)
    if (retention.retention.monthsActive < 3) churnProbability += 10;
    else if (retention.retention.monthsActive < 6) churnProbability += 5;

    // Revenue trend (10%)
    // Would check revenue trends if available
    churnProbability += 5;

    const probability = Math.min(100, Math.round(churnProbability));
    const riskLevel = probability >= 70 ? 'high' : (probability >= 40 ? 'medium' : 'low');

    return {
      churnProbability: probability,
      riskLevel,
      timeframe: probability >= 70 ? '30 days' : (probability >= 40 ? '60 days' : '90+ days'),
      factors: {
        engagement: retention.engagement.activityScore < 50,
        loginFrequency: retention.engagement.loginFrequency < 5,
        satisfaction: satisfaction?.nps?.score < 7,
        lifetime: retention.retention.monthsActive < 6
      },
      recommendations: generateChurnPreventionRecommendations(probability, retention, satisfaction)
    };
  } catch (error) {
    logger.error('Error predicting client churn', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Forecast revenue
 */
async function forecastRevenue(agencyWorkspaceId, months = 6) {
  try {
    // Get historical revenue data
    const ClientRetention = require('../models/ClientRetention');
    const clients = await ClientRetention.find({
      agencyWorkspaceId,
      'subscription.status': 'active'
    }).lean();

    const currentRevenue = clients.reduce((sum, c) => sum + (c.subscription.monthlyRevenue || 0), 0);

    // Get historical efficiency data
    const efficiency = await InternalEfficiency.find({
      agencyWorkspaceId
    })
      .sort({ 'period.startDate': -1 })
      .limit(6)
      .lean();

    // Calculate growth trend
    let growthRate = 0;
    if (efficiency.length >= 2) {
      const recent = efficiency[0].revenue.totalRevenue;
      const previous = efficiency[1].revenue.totalRevenue;
      if (previous > 0) {
        growthRate = ((recent - previous) / previous) * 100;
      }
    }

    // Forecast
    const forecast = [];
    for (let i = 1; i <= months; i++) {
      const projectedRevenue = currentRevenue * Math.pow(1 + (growthRate / 100), i);
      forecast.push({
        month: i,
        revenue: Math.round(projectedRevenue * 100) / 100,
        confidence: Math.max(50, 100 - (i * 5)) // Decreases over time
      });
    }

    return {
      currentRevenue: Math.round(currentRevenue * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100,
      forecast,
      assumptions: [
        'Based on historical growth trend',
        'Assumes current client retention',
        'Does not account for new client acquisition'
      ]
    };
  } catch (error) {
    logger.error('Error forecasting revenue', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Forecast satisfaction
 */
async function forecastSatisfaction(agencyWorkspaceId, months = 3) {
  try {
    const satisfaction = await ClientSatisfaction.find({
      agencyWorkspaceId,
      'survey.status': 'completed'
    })
      .sort({ 'survey.date': -1 })
      .limit(12)
      .lean();

    if (satisfaction.length < 2) {
      return {
        forecast: null,
        message: 'Insufficient historical data for forecasting'
      };
    }

    // Calculate NPS trend
    const npsScores = satisfaction
      .filter(s => s.nps && s.nps.score !== undefined)
      .map(s => s.nps.score);

    if (npsScores.length < 2) {
      return {
        forecast: null,
        message: 'Insufficient NPS data for forecasting'
      };
    }

    // Simple trend calculation
    const trend = (npsScores[0] - npsScores[npsScores.length - 1]) / npsScores.length;
    const currentNPS = npsScores[0];

    // Forecast
    const forecast = [];
    for (let i = 1; i <= months; i++) {
      const projectedNPS = currentNPS + (trend * i);
      forecast.push({
        month: i,
        nps: Math.round(projectedNPS * 100) / 100,
        confidence: Math.max(50, 100 - (i * 10))
      });
    }

    return {
      currentNPS: Math.round(currentNPS * 100) / 100,
      trend: Math.round(trend * 100) / 100,
      forecast
    };
  } catch (error) {
    logger.error('Error forecasting satisfaction', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Generate churn prevention recommendations
 */
function generateChurnPreventionRecommendations(probability, retention, satisfaction) {
  const recommendations = [];

  if (probability >= 70) {
    recommendations.push({
      action: 'immediate_outreach',
      description: 'Schedule immediate call with client to address concerns',
      priority: 'critical',
      expectedImpact: 'High - prevent churn'
    });
  }

  if (retention.engagement.activityScore < 50) {
    recommendations.push({
      action: 'increase_engagement',
      description: 'Increase client engagement through more frequent communication and value delivery',
      priority: 'high',
      expectedImpact: 'Medium - improve engagement'
    });
  }

  if (satisfaction && satisfaction.nps && satisfaction.nps.score < 7) {
    recommendations.push({
      action: 'satisfaction_intervention',
      description: 'Address satisfaction issues identified in NPS survey',
      priority: 'high',
      expectedImpact: 'High - improve satisfaction'
    });
  }

  if (retention.retention.monthsActive < 6) {
    recommendations.push({
      action: 'onboarding_check',
      description: 'Review onboarding process and ensure client is getting value',
      priority: 'medium',
      expectedImpact: 'Medium - improve onboarding'
    });
  }

  return recommendations;
}

module.exports = {
  predictClientChurn,
  forecastRevenue,
  forecastSatisfaction
};
