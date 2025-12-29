// Advanced Attribution Service
// Multi-touch attribution models

const Conversion = require('../models/Conversion');
const ConversionPath = require('../models/ConversionPath');
const ClickTracking = require('../models/ClickTracking');
const logger = require('../utils/logger');

/**
 * Calculate attribution using different models
 */
async function calculateAttribution(conversionId, model = 'last_touch') {
  try {
    const conversion = await Conversion.findById(conversionId).lean();
    if (!conversion) {
      throw new Error('Conversion not found');
    }

    // Get conversion path
    let path = await ConversionPath.findOne({ conversionId }).lean();
    
    if (!path) {
      // Build path from touchpoints
      path = await buildConversionPath(conversion);
    }

    // Calculate attribution based on model
    const attribution = await calculateAttributionByModel(path, model, conversion);

    // Update conversion path
    await ConversionPath.findOneAndUpdate(
      { conversionId },
      {
        $set: {
          attribution: {
            model,
            credits: attribution.credits
          },
          analysis: attribution.analysis
        }
      },
      { upsert: true }
    );

    return attribution;
  } catch (error) {
    logger.error('Error calculating attribution', { error: error.message, conversionId });
    throw error;
  }
}

/**
 * Build conversion path from touchpoints
 */
async function buildConversionPath(conversion) {
  try {
    const touchpoints = [];

    // Get click that led to conversion
    if (conversion.clickId) {
      const click = await ClickTracking.findById(conversion.clickId).lean();
      if (click) {
        touchpoints.push({
          postId: click.postId,
          platform: click.platform,
          interaction: 'click',
          timestamp: click.click.timestamp,
          value: 0
        });
      }
    }

    // Get other touchpoints (would need to query for customer's other interactions)
    // This is simplified - in production would track all customer interactions

    const firstTouch = touchpoints[0]?.timestamp || conversion.conversionData.timestamp;
    const lastTouch = conversion.conversionData.timestamp;

    return {
      touchpoints,
      totalTouchpoints: touchpoints.length,
      pathLength: (lastTouch - firstTouch) / (1000 * 60 * 60 * 24), // Days
      firstTouch,
      lastTouch
    };
  } catch (error) {
    logger.error('Error building conversion path', { error: error.message });
    throw error;
  }
}

/**
 * Calculate attribution by model
 */
async function calculateAttributionByModel(path, model, conversion) {
  const touchpoints = path.touchpoints || [];
  const conversionValue = conversion.conversionValue || 0;
  const credits = [];
  let analysis = {
    mostInfluentialTouchpoint: null,
    pathEfficiency: 0,
    conversionProbability: 0,
    bottlenecks: []
  };

  if (touchpoints.length === 0) {
    return { credits, analysis };
  }

  switch (model) {
    case 'first_touch':
      // First touchpoint gets 100% credit
      credits.push({
        postId: touchpoints[0].postId,
        platform: touchpoints[0].platform,
        credit: 100,
        value: conversionValue
      });
      analysis.mostInfluentialTouchpoint = {
        postId: touchpoints[0].postId,
        platform: touchpoints[0].platform,
        reason: 'First touch attribution'
      };
      break;

    case 'last_touch':
      // Last touchpoint gets 100% credit
      const lastTouchpoint = touchpoints[touchpoints.length - 1];
      credits.push({
        postId: lastTouchpoint.postId,
        platform: lastTouchpoint.platform,
        credit: 100,
        value: conversionValue
      });
      analysis.mostInfluentialTouchpoint = {
        postId: lastTouchpoint.postId,
        platform: lastTouchpoint.platform,
        reason: 'Last touch attribution'
      };
      break;

    case 'linear':
      // Equal credit to all touchpoints
      const creditPerTouchpoint = 100 / touchpoints.length;
      touchpoints.forEach(touchpoint => {
        credits.push({
          postId: touchpoint.postId,
          platform: touchpoint.platform,
          credit: creditPerTouchpoint,
          value: (conversionValue * creditPerTouchpoint) / 100
        });
      });
      break;

    case 'time_decay':
      // More recent touchpoints get more credit
      const totalWeight = touchpoints.reduce((sum, tp, index) => {
        return sum + (index + 1); // Weight increases with recency
      }, 0);

      touchpoints.forEach((touchpoint, index) => {
        const weight = index + 1;
        const credit = (weight / totalWeight) * 100;
        credits.push({
          postId: touchpoint.postId,
          platform: touchpoint.platform,
          credit,
          value: (conversionValue * credit) / 100
        });
      });
      break;

    case 'position_based':
      // First and last get 40% each, middle get 20% split
      const firstLastCredit = 40;
      const middleCredit = touchpoints.length > 2 ? 20 / (touchpoints.length - 2) : 0;

      touchpoints.forEach((touchpoint, index) => {
        let credit;
        if (index === 0 || index === touchpoints.length - 1) {
          credit = firstLastCredit;
        } else {
          credit = middleCredit;
        }
        credits.push({
          postId: touchpoint.postId,
          platform: touchpoint.platform,
          credit,
          value: (conversionValue * credit) / 100
        });
      });
      break;

    case 'data_driven':
      // Simplified data-driven model (would use ML in production)
      // For now, use time decay with engagement weighting
      touchpoints.forEach((touchpoint, index) => {
        const recencyWeight = (touchpoints.length - index) / touchpoints.length;
        const engagementWeight = 1; // Would calculate from actual engagement
        const credit = (recencyWeight * engagementWeight * 100) / touchpoints.length;
        credits.push({
          postId: touchpoint.postId,
          platform: touchpoint.platform,
          credit,
          value: (conversionValue * credit) / 100
        });
      });
      break;
  }

  // Calculate path efficiency
  analysis.pathEfficiency = calculatePathEfficiency(path);
  analysis.conversionProbability = calculateConversionProbability(path);

  // Find most influential touchpoint
  if (credits.length > 0) {
    const topCredit = credits.reduce((max, credit) => 
      credit.credit > max.credit ? credit : max
    );
    analysis.mostInfluentialTouchpoint = {
      postId: topCredit.postId,
      platform: topCredit.platform,
      reason: `${model} attribution - highest credit (${topCredit.credit.toFixed(1)}%)`
    };
  }

  return { credits, analysis };
}

/**
 * Calculate path efficiency
 */
function calculatePathEfficiency(path) {
  // Shorter paths with fewer touchpoints are more efficient
  const lengthScore = Math.max(0, 100 - (path.pathLength * 10)); // Penalize longer paths
  const touchpointScore = Math.max(0, 100 - (path.totalTouchpoints * 5)); // Penalize more touchpoints
  return (lengthScore + touchpointScore) / 2;
}

/**
 * Calculate conversion probability
 */
function calculateConversionProbability(path) {
  // Simplified - would use ML model in production
  // Factors: path length, touchpoints, time between touches
  let probability = 50; // Base probability

  // Shorter paths = higher probability
  if (path.pathLength < 1) probability += 20;
  else if (path.pathLength < 7) probability += 10;

  // Fewer touchpoints = higher probability (less friction)
  if (path.totalTouchpoints <= 2) probability += 15;
  else if (path.totalTouchpoints <= 5) probability += 5;

  return Math.min(100, probability);
}

/**
 * Get attribution comparison
 */
async function getAttributionComparison(conversionId) {
  try {
    const models = ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based'];
    const comparisons = {};

    for (const model of models) {
      const attribution = await calculateAttribution(conversionId, model);
      comparisons[model] = {
        totalAttributed: attribution.credits.reduce((sum, c) => sum + c.value, 0),
        touchpoints: attribution.credits.length,
        topTouchpoint: attribution.credits[0] || null
      };
    }

    return comparisons;
  } catch (error) {
    logger.error('Error getting attribution comparison', { error: error.message, conversionId });
    throw error;
  }
}

module.exports = {
  calculateAttribution,
  getAttributionComparison
};


