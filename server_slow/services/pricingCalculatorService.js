// Pricing Calculator Service
// Cost calculator, ROI calculator, comparison tool

const UsageBasedTier = require('../models/UsageBasedTier');
const AgencyScalePlan = require('../models/AgencyScalePlan');
const logger = require('../utils/logger');

/**
 * Calculate cost based on usage
 */
async function calculateCost(usageData) {
  try {
    const {
      aiMinutes = 0,
      clients = 0,
      profiles = 0,
      posts = 0,
      videos = 0,
      tierId = null
    } = usageData;

    // Get tier if specified
    let tier = null;
    if (tierId) {
      tier = await UsageBasedTier.findById(tierId).lean();
    }

    // If no tier, find best fit
    if (!tier) {
      tier = await findBestFitTier(usageData);
    }

    if (!tier) {
      throw new Error('No suitable tier found');
    }

    // Calculate base cost
    const baseCost = tier.pricing.monthly.amount;

    // Calculate overage
    const overage = {
      aiMinutes: Math.max(0, aiMinutes - tier.usage.aiMinutes.monthly),
      clients: Math.max(0, clients - tier.usage.clients.max),
      profiles: Math.max(0, profiles - tier.usage.profiles.max)
    };

    const overageCost = 
      (overage.aiMinutes * tier.usage.aiMinutes.overageRate) +
      (overage.clients * tier.usage.clients.overageRate) +
      (overage.profiles * tier.usage.profiles.overageRate);

    const totalCost = baseCost + overageCost;

    // Calculate yearly cost
    const yearlyBaseCost = tier.pricing.yearly.amount;
    const yearlyOverageCost = overageCost * 12;
    const yearlyTotalCost = yearlyBaseCost + yearlyOverageCost;
    const yearlySavings = (baseCost * 12) - yearlyBaseCost;

    return {
      tier: {
        id: tier._id,
        name: tier.name,
        slug: tier.slug
      },
      usage: {
        aiMinutes,
        clients,
        profiles,
        posts,
        videos
      },
      costs: {
        monthly: {
          base: baseCost,
          overage: overageCost,
          total: totalCost
        },
        yearly: {
          base: yearlyBaseCost,
          overage: yearlyOverageCost,
          total: yearlyTotalCost,
          savings: yearlySavings,
          savingsPercent: Math.round((yearlySavings / (baseCost * 12)) * 100)
        }
      },
      overage,
      recommendations: generateCostRecommendations(tier, usageData, overage)
    };
  } catch (error) {
    logger.error('Error calculating cost', { error: error.message });
    throw error;
  }
}

/**
 * Find best fit tier
 */
async function findBestFitTier(usageData) {
  const tiers = await UsageBasedTier.find({ isActive: true })
    .sort({ 'pricing.monthly.amount': 1 })
    .lean();

  for (const tier of tiers) {
    if (
      tier.usage.aiMinutes.monthly >= usageData.aiMinutes &&
      tier.usage.clients.max >= usageData.clients &&
      tier.usage.profiles.max >= usageData.profiles
    ) {
      return tier;
    }
  }

  // Return highest tier if no fit
  return tiers[tiers.length - 1];
}

/**
 * Generate cost recommendations
 */
function generateCostRecommendations(tier, usageData, overage) {
  const recommendations = [];

  if (overage.aiMinutes > 0) {
    recommendations.push({
      type: 'upgrade',
      reason: `You're using ${overage.aiMinutes} more AI minutes than your tier allows`,
      suggestion: 'Consider upgrading to avoid overage charges',
      estimatedSavings: overage.aiMinutes * tier.usage.aiMinutes.overageRate
    });
  }

  if (overage.clients > 0) {
    recommendations.push({
      type: 'upgrade',
      reason: `You're using ${overage.clients} more clients than your tier allows`,
      suggestion: 'Consider upgrading to avoid overage charges',
      estimatedSavings: overage.clients * tier.usage.clients.overageRate
    });
  }

  if (tier.pricing.yearly.amount > 0) {
    const monthlyTotal = tier.pricing.monthly.amount * 12;
    const savings = monthlyTotal - tier.pricing.yearly.amount;
    if (savings > 0) {
      recommendations.push({
        type: 'yearly',
        reason: 'Save money with yearly billing',
        suggestion: `Save $${savings.toFixed(2)} per year with yearly billing`,
        estimatedSavings: savings
      });
    }
  }

  return recommendations;
}

/**
 * Calculate ROI
 */
async function calculateROI(usageData, businessMetrics) {
  try {
    const {
      timeSaved = 0, // hours per month
      revenueGenerated = 0, // dollars per month
      leadsGenerated = 0,
      conversions = 0
    } = businessMetrics;

    // Calculate cost
    const cost = await calculateCost(usageData);
    const monthlyCost = cost.costs.monthly.total;

    // Calculate value
    const hourlyRate = 50; // Average hourly rate
    const timeValue = timeSaved * hourlyRate;
    const totalValue = timeValue + revenueGenerated;

    // Calculate ROI
    const roi = monthlyCost > 0 ? ((totalValue - monthlyCost) / monthlyCost) * 100 : 0;
    const paybackPeriod = monthlyCost > 0 ? monthlyCost / (totalValue / 30) : 0; // days

    return {
      costs: {
        monthly: monthlyCost,
        yearly: cost.costs.yearly.total
      },
      value: {
        timeSaved: {
          hours: timeSaved,
          value: timeValue
        },
        revenue: revenueGenerated,
        total: totalValue
      },
      roi: {
        percentage: Math.round(roi),
        paybackPeriod: Math.round(paybackPeriod),
        breakEven: roi > 0
      },
      metrics: {
        leadsPerDollar: monthlyCost > 0 ? leadsGenerated / monthlyCost : 0,
        conversionsPerDollar: monthlyCost > 0 ? conversions / monthlyCost : 0,
        revenuePerDollar: monthlyCost > 0 ? revenueGenerated / monthlyCost : 0
      }
    };
  } catch (error) {
    logger.error('Error calculating ROI', { error: error.message });
    throw error;
  }
}

/**
 * Compare tiers
 */
async function compareTiers(tierIds) {
  try {
    const tiers = await UsageBasedTier.find({
      _id: { $in: tierIds },
      isActive: true
    }).lean();

    if (tiers.length < 2) {
      throw new Error('Need at least 2 tiers to compare');
    }

    const comparison = {
      tiers: tiers.map(tier => ({
        id: tier._id,
        name: tier.name,
        pricing: tier.pricing,
        usage: tier.usage,
        features: tier.features
      })),
      differences: {
        pricing: [],
        usage: [],
        features: []
      }
    };

    // Compare pricing
    tiers.forEach((tier, index) => {
      if (index === 0) return;
      const prev = tiers[index - 1];
      comparison.differences.pricing.push({
        feature: 'Monthly Price',
        [prev.name]: `$${prev.pricing.monthly.amount}`,
        [tier.name]: `$${tier.pricing.monthly.amount}`,
        difference: tier.pricing.monthly.amount - prev.pricing.monthly.amount
      });
    });

    // Compare usage limits
    const usageKeys = ['aiMinutes', 'clients', 'profiles'];
    usageKeys.forEach(key => {
      const values = tiers.map(t => t.usage[key].monthly || t.usage[key].max);
      if (new Set(values).size > 1) {
        const diff = { feature: key };
        tiers.forEach(tier => {
          diff[tier.name] = values[tiers.indexOf(tier)];
        });
        comparison.differences.usage.push(diff);
      }
    });

    return comparison;
  } catch (error) {
    logger.error('Error comparing tiers', { error: error.message });
    throw error;
  }
}

/**
 * Calculate agency cost per client
 */
async function calculateAgencyCostPerClient(planId, clientCount) {
  try {
    const plan = await AgencyScalePlan.findById(planId).lean();
    if (!plan) {
      throw new Error('Plan not found');
    }

    const baseCost = plan.pricing.monthly.amount;
    const clientsIncluded = plan.bundle.clients.included;
    const overageClients = Math.max(0, clientCount - clientsIncluded);
    const overageCost = overageClients * plan.bundle.clients.overageRate;
    const totalCost = baseCost + overageCost;

    const costPerClient = clientCount > 0 ? totalCost / clientCount : 0;
    const costPerClientIncluded = clientsIncluded > 0 ? baseCost / clientsIncluded : 0;

    return {
      plan: {
        id: plan._id,
        name: plan.name
      },
      clients: {
        total: clientCount,
        included: clientsIncluded,
        overage: overageClients
      },
      costs: {
        base: baseCost,
        overage: overageCost,
        total: totalCost,
        perClient: costPerClient,
        perClientIncluded: costPerClientIncluded
      },
      savings: {
        perClient: costPerClientIncluded - costPerClient,
        total: (costPerClientIncluded - costPerClient) * clientCount
      }
    };
  } catch (error) {
    logger.error('Error calculating agency cost per client', { error: error.message });
    throw error;
  }
}

module.exports = {
  calculateCost,
  calculateROI,
  compareTiers,
  calculateAgencyCostPerClient
};


