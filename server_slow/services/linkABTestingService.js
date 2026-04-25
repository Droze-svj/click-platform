// Link A/B Testing Service
// A/B test different link variations

const BrandedLink = require('../models/BrandedLink');
const LinkClick = require('../models/LinkClick');
const logger = require('../utils/logger');

/**
 * Create A/B test for links
 */
async function createABTest(agencyWorkspaceId, testData) {
  try {
    const {
      name,
      description,
      variantA,
      variantB,
      trafficSplit = 50, // Percentage for variant A
      testDuration = 7, // Days
      successMetric = 'clicks' // 'clicks', 'conversions', 'engagement'
    } = testData;

    // Create variant A link
    const linkA = await BrandedLink.findById(variantA);
    if (!linkA) {
      throw new Error('Variant A link not found');
    }

    // Create variant B link
    const linkB = await BrandedLink.findById(variantB);
    if (!linkB) {
      throw new Error('Variant B link not found');
    }

    // Mark links as part of A/B test
    linkA.metadata.abTest = {
      testId: null, // Will be set after test creation
      variant: 'A',
      trafficSplit
    };
    linkB.metadata.abTest = {
      testId: null,
      variant: 'B',
      trafficSplit: 100 - trafficSplit
    };

    await linkA.save();
    await linkB.save();

    // Create test record (would use LinkGroup with type 'ab_test')
    const LinkGroup = require('../models/LinkGroup');
    const test = new LinkGroup({
      name,
      description,
      agencyWorkspaceId,
      type: 'ab_test',
      links: [variantA, variantB],
      metadata: {
        trafficSplit,
        testDuration,
        successMetric,
        startDate: new Date(),
        endDate: new Date(Date.now() + testDuration * 24 * 60 * 60 * 1000)
      }
    });

    await test.save();

    // Update links with test ID
    linkA.metadata.abTest.testId = test._id;
    linkB.metadata.abTest.testId = test._id;
    await linkA.save();
    await linkB.save();

    logger.info('A/B test created', { testId: test._id, variantA, variantB });

    return test;
  } catch (error) {
    logger.error('Error creating A/B test', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get A/B test results
 */
async function getABTestResults(testId) {
  try {
    const LinkGroup = require('../models/LinkGroup');
    const test = await LinkGroup.findById(testId).populate('links');
    if (!test || test.type !== 'ab_test') {
      throw new Error('A/B test not found');
    }

    const [linkA, linkB] = test.links;

    // Get clicks for each variant
    const clicksA = await LinkClick.countDocuments({ linkId: linkA._id });
    const clicksB = await LinkClick.countDocuments({ linkId: linkB._id });

    // Get unique clicks
    const uniqueClicksA = await LinkClick.distinct('ipAddress', {
      linkId: linkA._id,
      ipAddress: { $ne: null }
    });
    const uniqueClicksB = await LinkClick.distinct('ipAddress', {
      linkId: linkB._id,
      ipAddress: { $ne: null }
    });

    // Calculate conversion rates (if applicable)
    const conversionRateA = clicksA > 0 ? (uniqueClicksA.length / clicksA) * 100 : 0;
    const conversionRateB = clicksB > 0 ? (uniqueClicksB.length / clicksB) * 100 : 0;

    // Determine winner
    let winner = null;
    let confidence = 'low';
    const totalClicks = clicksA + clicksB;

    if (totalClicks >= 100) {
      // Statistical significance (simplified)
      const difference = Math.abs(clicksA - clicksB);
      const percentage = (difference / totalClicks) * 100;

      if (percentage > 10) {
        confidence = 'high';
        winner = clicksA > clicksB ? 'A' : 'B';
      } else if (percentage > 5) {
        confidence = 'medium';
        winner = clicksA > clicksB ? 'A' : 'B';
      }
    }

    return {
      test: {
        id: test._id,
        name: test.name,
        startDate: test.metadata.startDate,
        endDate: test.metadata.endDate,
        status: new Date() > new Date(test.metadata.endDate) ? 'completed' : 'active'
      },
      variantA: {
        linkId: linkA._id,
        clicks: clicksA,
        uniqueClicks: uniqueClicksA.length,
        conversionRate: Math.round(conversionRateA * 100) / 100
      },
      variantB: {
        linkId: linkB._id,
        clicks: clicksB,
        uniqueClicks: uniqueClicksB.length,
        conversionRate: Math.round(conversionRateB * 100) / 100
      },
      winner,
      confidence,
      totalClicks,
      trafficSplit: test.metadata.trafficSplit
    };
  } catch (error) {
    logger.error('Error getting A/B test results', { error: error.message, testId });
    throw error;
  }
}

/**
 * Route traffic to A/B test variant
 */
async function routeABTestTraffic(testId, userIdentifier = null) {
  try {
    const LinkGroup = require('../models/LinkGroup');
    const test = await LinkGroup.findById(testId).populate('links');
    if (!test || test.type !== 'ab_test') {
      throw new Error('A/B test not found');
    }

    // Check if test is still active
    if (new Date() > new Date(test.metadata.endDate)) {
      // Test ended, return winner
      const results = await getABTestResults(testId);
      const winnerLink = results.winner === 'A' ? test.links[0] : test.links[1];
      return winnerLink;
    }

    // Use consistent routing based on user identifier
    let variantIndex = 0; // Default to variant A
    if (userIdentifier) {
      // Hash user identifier to get consistent variant
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(userIdentifier).digest('hex');
      const hashInt = parseInt(hash.substring(0, 8), 16);
      variantIndex = hashInt % 100 < test.metadata.trafficSplit ? 0 : 1;
    } else {
      // Random routing
      variantIndex = Math.random() * 100 < test.metadata.trafficSplit ? 0 : 1;
    }

    return test.links[variantIndex];
  } catch (error) {
    logger.error('Error routing A/B test traffic', { error: error.message, testId });
    throw error;
  }
}

module.exports = {
  createABTest,
  getABTestResults,
  routeABTestTraffic
};


