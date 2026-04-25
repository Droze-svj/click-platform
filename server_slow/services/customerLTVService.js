// Customer LTV Service
// Calculate and track customer lifetime value

const CustomerLTV = require('../models/CustomerLTV');
const Conversion = require('../models/Conversion');
const logger = require('../utils/logger');

/**
 * Update customer LTV
 */
async function updateCustomerLTV(workspaceId, customerId, conversion) {
  try {
    let customerLTV = await CustomerLTV.findOne({ workspaceId, customerId }).lean();

    if (!customerLTV) {
      // Create new customer LTV record
      customerLTV = new CustomerLTV({
        workspaceId,
        customerId,
        firstConversion: {
          postId: conversion.postId,
          platform: conversion.platform,
          conversionType: conversion.conversionType,
          timestamp: conversion.conversionData.timestamp,
          value: conversion.conversionValue
        },
        attribution: {
          source: conversion.attribution.source,
          medium: conversion.attribution.medium,
          campaign: conversion.attribution.campaign,
          firstTouch: {
            postId: conversion.postId,
            platform: conversion.platform,
            timestamp: conversion.conversionData.timestamp
          },
          lastTouch: {
            postId: conversion.postId,
            platform: conversion.platform,
            timestamp: conversion.conversionData.timestamp
          },
          touchpoints: [{
            postId: conversion.postId,
            platform: conversion.platform,
            timestamp: conversion.conversionData.timestamp,
            interaction: 'conversion'
          }]
        },
        revenue: {
          total: conversion.conversionValue || 0,
          purchaseCount: 1,
          firstPurchase: conversion.conversionValue || 0,
          lastPurchase: conversion.conversionValue || 0
        },
        cohort: {
          month: new Date(conversion.conversionData.timestamp).toISOString().slice(0, 7),
          year: new Date(conversion.conversionData.timestamp).getFullYear()
        }
      });
    } else {
      // Update existing customer LTV
      customerLTV = await CustomerLTV.findById(customerLTV._id);

      // Update revenue
      customerLTV.revenue.total += conversion.conversionValue || 0;
      customerLTV.revenue.purchaseCount += 1;
      customerLTV.revenue.lastPurchase = conversion.conversionValue || 0;

      // Update last touch
      customerLTV.attribution.lastTouch = {
        postId: conversion.postId,
        platform: conversion.platform,
        timestamp: conversion.conversionData.timestamp
      };

      // Add touchpoint
      customerLTV.attribution.touchpoints.push({
        postId: conversion.postId,
        platform: conversion.platform,
        timestamp: conversion.conversionData.timestamp,
        interaction: 'conversion'
      });
    }

    // Calculate LTV
    customerLTV.ltv = calculateLTV(customerLTV);

    await customerLTV.save();

    logger.info('Customer LTV updated', { workspaceId, customerId, ltv: customerLTV.ltv.current });
    return customerLTV;
  } catch (error) {
    logger.error('Error updating customer LTV', { error: error.message, workspaceId, customerId });
    throw error;
  }
}

/**
 * Calculate LTV
 */
function calculateLTV(customerLTV) {
  const { revenue, metrics, firstConversion } = customerLTV;

  // Historical LTV (current total revenue)
  const historicalLTV = revenue.total;

  // Predictive LTV (based on purchase patterns)
  let predictedLTV = historicalLTV;

  if (revenue.purchaseCount > 1 && metrics.averageDaysBetweenPurchases > 0) {
    // Calculate average purchase frequency
    const daysSinceFirst = metrics.daysSinceFirstPurchase || 1;
    const purchaseFrequency = daysSinceFirst / revenue.purchaseCount;
    
    // Predict future purchases (assume customer lifetime of 2 years)
    const customerLifetimeDays = 730;
    const remainingDays = Math.max(0, customerLifetimeDays - daysSinceFirst);
    const predictedPurchases = remainingDays / purchaseFrequency;
    
    predictedLTV = historicalLTV + (revenue.averageOrderValue * predictedPurchases);
  } else if (revenue.purchaseCount === 1) {
    // First purchase - assume 2-3 more purchases
    predictedLTV = historicalLTV * 2.5;
  }

  // Confidence based on data quality
  let confidence = 50;
  if (revenue.purchaseCount >= 3) confidence = 80;
  else if (revenue.purchaseCount >= 2) confidence = 65;
  else if (revenue.purchaseCount === 1) confidence = 50;

  return {
    current: Math.round(historicalLTV * 100) / 100,
    predicted: Math.round(predictedLTV * 100) / 100,
    confidence,
    calculationMethod: revenue.purchaseCount > 1 ? 'predictive' : 'historical'
  };
}

/**
 * Get customer LTV analytics
 */
async function getCustomerLTVAnalytics(workspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      cohort = null
    } = filters;

    const query = { workspaceId };
    if (startDate || endDate) {
      query['firstConversion.timestamp'] = {};
      if (startDate) query['firstConversion.timestamp'].$gte = new Date(startDate);
      if (endDate) query['firstConversion.timestamp'].$lte = new Date(endDate);
    }
    if (cohort) {
      query['cohort.month'] = cohort;
    }

    const customers = await CustomerLTV.find(query).lean();

    const analytics = {
      totalCustomers: customers.length,
      averageLTV: 0,
      medianLTV: 0,
      totalLTV: 0,
      byCohort: {},
      byPlatform: {},
      byCampaign: {},
      topCustomers: []
    };

    if (customers.length === 0) {
      return analytics;
    }

    const ltvValues = customers.map(c => c.ltv.current || 0);
    analytics.totalLTV = ltvValues.reduce((sum, ltv) => sum + ltv, 0);
    analytics.averageLTV = analytics.totalLTV / customers.length;
    
    // Median
    const sortedLTV = ltvValues.sort((a, b) => a - b);
    analytics.medianLTV = sortedLTV[Math.floor(sortedLTV.length / 2)] || 0;

    // By cohort
    customers.forEach(customer => {
      const cohortKey = customer.cohort.month;
      if (!analytics.byCohort[cohortKey]) {
        analytics.byCohort[cohortKey] = {
          customers: 0,
          totalLTV: 0,
          averageLTV: 0
        };
      }
      analytics.byCohort[cohortKey].customers++;
      analytics.byCohort[cohortKey].totalLTV += customer.ltv.current || 0;
    });

    Object.keys(analytics.byCohort).forEach(cohort => {
      const data = analytics.byCohort[cohort];
      data.averageLTV = data.totalLTV / data.customers;
    });

    // By platform
    customers.forEach(customer => {
      const platform = customer.firstConversion.platform;
      if (platform) {
        if (!analytics.byPlatform[platform]) {
          analytics.byPlatform[platform] = {
            customers: 0,
            totalLTV: 0,
            averageLTV: 0
          };
        }
        analytics.byPlatform[platform].customers++;
        analytics.byPlatform[platform].totalLTV += customer.ltv.current || 0;
      }
    });

    Object.keys(analytics.byPlatform).forEach(platform => {
      const data = analytics.byPlatform[platform];
      data.averageLTV = data.totalLTV / data.customers;
    });

    // Top customers
    analytics.topCustomers = customers
      .sort((a, b) => (b.ltv.current || 0) - (a.ltv.current || 0))
      .slice(0, 10)
      .map(customer => ({
        customerId: customer.customerId,
        ltv: customer.ltv.current || 0,
        predictedLTV: customer.ltv.predicted || 0,
        purchaseCount: customer.revenue.purchaseCount || 0,
        platform: customer.firstConversion.platform
      }));

    return analytics;
  } catch (error) {
    logger.error('Error getting customer LTV analytics', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  updateCustomerLTV,
  getCustomerLTVAnalytics
};


