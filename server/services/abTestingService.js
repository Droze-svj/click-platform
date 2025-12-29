// A/B Testing Service

const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Create A/B test
 */
async function createABTest(userId, testData) {
  try {
    const {
      name,
      variantA,
      variantB,
      platform,
      targetMetric = 'engagement',
      duration = 7, // days
    } = testData;

    // Create content for both variants
    const contentA = new Content({
      userId,
      title: variantA.title,
      body: variantA.body,
      platform,
      status: 'draft',
      abTest: {
        testId: null,
        variant: 'A',
      },
    });

    const contentB = new Content({
      userId,
      title: variantB.title,
      body: variantB.body,
      platform,
      status: 'draft',
      abTest: {
        testId: null,
        variant: 'B',
      },
    });

    const [savedA, savedB] = await Promise.all([
      contentA.save(),
      contentB.save(),
    ]);

    // Generate test ID
    const testId = `ab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update content with test ID
    await Promise.all([
      Content.updateOne({ _id: savedA._id }, { 'abTest.testId': testId }),
      Content.updateOne({ _id: savedB._id }, { 'abTest.testId': testId }),
    ]);

    const test = {
      id: testId,
      name,
      userId,
      platform,
      targetMetric,
      duration,
      variantA: {
        contentId: savedA._id,
        title: variantA.title,
      },
      variantB: {
        contentId: savedB._id,
        title: variantB.title,
      },
      status: 'active',
      createdAt: new Date(),
      endsAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000),
    };

    logger.info('A/B test created', { testId, userId, platform });
    return test;
  } catch (error) {
    logger.error('Create A/B test error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get A/B test results
 */
async function getABTestResults(testId, userId) {
  try {
    const contents = await Content.find({
      'abTest.testId': testId,
      userId,
    })
      .select('abTest views likes shares comments createdAt')
      .lean();

    if (contents.length !== 2) {
      throw new Error('A/B test not found or incomplete');
    }

    const variantA = contents.find(c => c.abTest.variant === 'A');
    const variantB = contents.find(c => c.abTest.variant === 'B');

    const metricsA = calculateMetrics(variantA);
    const metricsB = calculateMetrics(variantB);

    const winner = determineWinner(metricsA, metricsB);

    return {
      testId,
      variantA: {
        contentId: variantA._id,
        metrics: metricsA,
      },
      variantB: {
        contentId: variantB._id,
        metrics: metricsB,
      },
      comparison: {
        winner,
        improvement: winner === 'A'
          ? calculateImprovement(metricsA, metricsB)
          : calculateImprovement(metricsB, metricsA),
        significance: calculateSignificance(metricsA, metricsB),
      },
    };
  } catch (error) {
    logger.error('Get A/B test results error', { error: error.message, testId });
    throw error;
  }
}

/**
 * Calculate metrics
 */
function calculateMetrics(content) {
  const views = content.views || 0;
  const likes = content.likes || 0;
  const shares = content.shares || 0;
  const comments = content.comments || 0;

  const engagement = likes + shares * 2 + comments * 3;
  const engagementRate = views > 0 ? (engagement / views) * 100 : 0;

  return {
    views,
    likes,
    shares,
    comments,
    engagement,
    engagementRate: Math.round(engagementRate * 100) / 100,
  };
}

/**
 * Determine winner
 */
function determineWinner(metricsA, metricsB) {
  // Compare by engagement rate
  if (metricsA.engagementRate > metricsB.engagementRate) {
    return 'A';
  } else if (metricsB.engagementRate > metricsA.engagementRate) {
    return 'B';
  } else {
    // Tie - compare by total engagement
    return metricsA.engagement > metricsB.engagement ? 'A' : 'B';
  }
}

/**
 * Calculate improvement percentage
 */
function calculateImprovement(winnerMetrics, loserMetrics) {
  if (loserMetrics.engagementRate === 0) {
    return 100;
  }

  const improvement = ((winnerMetrics.engagementRate - loserMetrics.engagementRate) / loserMetrics.engagementRate) * 100;
  return Math.round(improvement * 100) / 100;
}

/**
 * Calculate statistical significance (simplified)
 */
function calculateSignificance(metricsA, metricsB) {
  // Simplified significance calculation
  const diff = Math.abs(metricsA.engagementRate - metricsB.engagementRate);
  const avg = (metricsA.engagementRate + metricsB.engagementRate) / 2;

  if (avg === 0) {
    return 'insufficient_data';
  }

  const percentDiff = (diff / avg) * 100;

  if (percentDiff > 20) {
    return 'high';
  } else if (percentDiff > 10) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * List user's A/B tests
 */
async function listABTests(userId, options = {}) {
  try {
    const { status = null, platform = null } = options;

    // Get all content with A/B tests
    const query = {
      userId,
      'abTest.testId': { $exists: true },
    };

    if (platform) {
      query.platform = platform;
    }

    const contents = await Content.find(query)
      .select('abTest platform createdAt views likes shares')
      .lean();

    // Group by test ID
    const tests = {};
    contents.forEach(content => {
      const testId = content.abTest.testId;
      if (!tests[testId]) {
        tests[testId] = {
          testId,
          platform: content.platform,
          variants: [],
          createdAt: content.createdAt,
        };
      }

      tests[testId].variants.push({
        variant: content.abTest.variant,
        contentId: content._id,
        metrics: calculateMetrics(content),
      });
    });

    // Convert to array and filter by status
    let testArray = Object.values(tests);

    if (status === 'active') {
      testArray = testArray.filter(test => {
        const daysSinceCreation = (Date.now() - new Date(test.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation < 7; // Active if less than 7 days old
      });
    }

    return testArray;
  } catch (error) {
    logger.error('List A/B tests error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  createABTest,
  getABTestResults,
  listABTests,
};






