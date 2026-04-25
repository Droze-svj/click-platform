// Health Forecasting Service
// Predict future health scores

const ClientHealthScore = require('../models/ClientHealthScore');
const logger = require('../utils/logger');

/**
 * Forecast client health score
 */
async function forecastClientHealth(clientWorkspaceId, days = 30) {
  try {
    // Get historical health scores (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const historicalScores = await ClientHealthScore.find({
      clientWorkspaceId,
      'period.startDate': { $gte: startDate, $lte: endDate }
    })
      .sort({ 'period.startDate': 1 })
      .lean();

    if (historicalScores.length < 2) {
      return {
        forecast: null,
        confidence: 0,
        message: 'Insufficient historical data for forecasting'
      };
    }

    // Calculate trend
    const scores = historicalScores.map(h => h.healthScore);
    const trend = calculateTrend(scores);

    // Generate forecast
    const forecast = [];
    const lastScore = scores[scores.length - 1];
    const daysPerPeriod = 30; // Assuming monthly periods

    for (let i = 1; i <= Math.ceil(days / daysPerPeriod); i++) {
      const forecastDate = new Date(endDate);
      forecastDate.setDate(forecastDate.getDate() + (i * daysPerPeriod));

      // Simple linear projection
      const projectedScore = lastScore + (trend * i);
      const confidence = Math.max(50, 100 - (i * 10)); // Decreases over time

      forecast.push({
        date: forecastDate,
        score: Math.max(0, Math.min(100, Math.round(projectedScore))),
        confidence: Math.round(confidence),
        status: getStatusFromScore(projectedScore)
      });
    }

    // Calculate overall confidence
    const averageConfidence = forecast.reduce((sum, f) => sum + f.confidence, 0) / forecast.length;

    return {
      forecast,
      confidence: Math.round(averageConfidence),
      trend,
      assumptions: [
        'Based on historical trend',
        'Assumes current strategy continues',
        'Does not account for external factors'
      ]
    };
  } catch (error) {
    logger.error('Error forecasting client health', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate trend
 */
function calculateTrend(scores) {
  if (scores.length < 2) return 0;

  const n = scores.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  scores.forEach((score, index) => {
    const x = index + 1;
    sumX += x;
    sumY += score;
    sumXY += x * score;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

/**
 * Get status from score
 */
function getStatusFromScore(score) {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 35) return 'needs_attention';
  return 'critical';
}

module.exports = {
  forecastClientHealth
};


