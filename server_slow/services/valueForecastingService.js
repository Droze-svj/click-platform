// Value Forecasting Service
// Predict future value and ROI

const ClientValueTracking = require('../models/ClientValueTracking');
const logger = require('../utils/logger');

/**
 * Forecast value for future period
 */
async function forecastValue(clientWorkspaceId, period, options = {}) {
  try {
    const {
      monthsOfHistory = 6,
      includeTrends = true
    } = options;

    // Get historical data
    const endDate = new Date(period.startDate);
    endDate.setMonth(endDate.getMonth() - 1);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - monthsOfHistory);

    const historical = await ClientValueTracking.find({
      clientWorkspaceId,
      'period.startDate': { $gte: startDate, $lte: endDate }
    })
      .sort({ 'period.startDate': 1 })
      .lean();

    if (historical.length === 0) {
      throw new Error('Insufficient historical data for forecasting');
    }

    // Calculate averages and trends
    const averages = {
      cost: 0,
      impressions: 0,
      engagement: 0,
      leads: 0,
      conversions: 0,
      revenue: 0,
      roi: 0
    };

    historical.forEach(record => {
      averages.cost += record.cost.total;
      averages.impressions += record.value.impressions;
      averages.engagement += record.value.engagement;
      averages.leads += record.value.leads;
      averages.conversions += record.value.conversions;
      averages.revenue += record.value.revenue;
      averages.roi += record.metrics.roi;
    });

    const count = historical.length;
    Object.keys(averages).forEach(key => {
      averages[key] = averages[key] / count;
    });

    // Calculate trends if enabled
    let trends = {};
    if (includeTrends && historical.length >= 2) {
      const recent = historical.slice(-3);
      const older = historical.slice(0, -3);

      if (older.length > 0) {
        const recentAvg = {
          cost: recent.reduce((sum, r) => sum + r.cost.total, 0) / recent.length,
          impressions: recent.reduce((sum, r) => sum + r.value.impressions, 0) / recent.length,
          engagement: recent.reduce((sum, r) => sum + r.value.engagement, 0) / recent.length,
          roi: recent.reduce((sum, r) => sum + r.metrics.roi, 0) / recent.length
        };

        const olderAvg = {
          cost: older.reduce((sum, r) => sum + r.cost.total, 0) / older.length,
          impressions: older.reduce((sum, r) => sum + r.value.impressions, 0) / older.length,
          engagement: older.reduce((sum, r) => sum + r.value.engagement, 0) / older.length,
          roi: older.reduce((sum, r) => sum + r.metrics.roi, 0) / older.length
        };

        trends = {
          cost: olderAvg.cost !== 0 ? ((recentAvg.cost - olderAvg.cost) / olderAvg.cost) * 100 : 0,
          impressions: olderAvg.impressions !== 0 ? ((recentAvg.impressions - olderAvg.impressions) / olderAvg.impressions) * 100 : 0,
          engagement: olderAvg.engagement !== 0 ? ((recentAvg.engagement - olderAvg.engagement) / olderAvg.engagement) * 100 : 0,
          roi: olderAvg.roi !== 0 ? ((recentAvg.roi - olderAvg.roi) / Math.abs(olderAvg.roi)) * 100 : 0
        };
      }
    }

    // Apply trends to forecast
    const forecast = {
      cost: averages.cost * (1 + (trends.cost || 0) / 100),
      impressions: averages.impressions * (1 + (trends.impressions || 0) / 100),
      engagement: averages.engagement * (1 + (trends.engagement || 0) / 100),
      leads: averages.leads * (1 + (trends.impressions || 0) / 100 * 0.5), // Leads trend slower
      conversions: averages.conversions * (1 + (trends.impressions || 0) / 100 * 0.5),
      revenue: averages.revenue * (1 + (trends.impressions || 0) / 100 * 0.5)
    };

    forecast.roi = forecast.cost > 0 ? ((forecast.revenue - forecast.cost) / forecast.cost) * 100 : 0;

    return {
      period: {
        startDate: period.startDate,
        endDate: period.endDate
      },
      forecast: {
        cost: Math.round(forecast.cost),
        impressions: Math.round(forecast.impressions),
        engagement: Math.round(forecast.engagement),
        leads: Math.round(forecast.leads),
        conversions: Math.round(forecast.conversions),
        revenue: Math.round(forecast.revenue),
        roi: Math.round(forecast.roi * 10) / 10
      },
      basedOn: {
        monthsOfHistory,
        dataPoints: historical.length,
        average: averages,
        trends: includeTrends ? trends : null
      },
      confidence: calculateConfidence(historical.length, trends)
    };
  } catch (error) {
    logger.error('Error forecasting value', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Calculate forecast confidence
 */
function calculateConfidence(dataPoints, trends) {
  let confidence = 50; // Base confidence

  // More data points = higher confidence
  if (dataPoints >= 6) confidence += 20;
  else if (dataPoints >= 3) confidence += 10;

  // Stable trends = higher confidence
  if (trends) {
    const trendVariance = Math.abs(trends.cost) + Math.abs(trends.impressions) + Math.abs(trends.engagement);
    if (trendVariance < 10) confidence += 20; // Very stable
    else if (trendVariance < 20) confidence += 10; // Stable
  }

  return Math.min(100, confidence);
}

module.exports = {
  forecastValue
};


