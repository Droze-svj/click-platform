// Model Version Testing Service
// A/B testing and performance validation for model versions

const logger = require('../utils/logger');
const ModelVersion = require('../models/ModelVersion');
const ModelLearning = require('../models/ModelLearning');
const { generateWithFreeModel } = require('./freeAIModelService');

// Version testing cache
const versionTests = new Map();

/**
 * A/B test two model versions
 */
async function abTestVersions(provider, model, version1, version2, testPrompts = []) {
  try {
    const testId = `${provider}:${model}:${version1}:vs:${version2}`;
    
    // Use cached results if available
    if (versionTests.has(testId)) {
      const cached = versionTests.get(testId);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
        return cached.results;
      }
    }

    const results = {
      version1: {
        version: version1,
        tests: [],
        avgQuality: 0,
        avgResponseTime: 0,
        avgTokens: 0,
        wins: 0,
      },
      version2: {
        version: version2,
        tests: [],
        avgQuality: 0,
        avgResponseTime: 0,
        avgTokens: 0,
        wins: 0,
      },
      comparison: {
        qualityDelta: 0,
        responseTimeDelta: 0,
        recommendation: null,
      },
    };

    // Default test prompts if none provided
    if (testPrompts.length === 0) {
      testPrompts = [
        'Create a viral TikTok caption about AI',
        'Write an engaging LinkedIn post about productivity',
        'Generate 5 hashtags for a tech startup',
        'Create a short Instagram caption for a product launch',
        'Write a Twitter thread about innovation',
      ];
    }

    // Test both versions
    for (const prompt of testPrompts) {
      const [result1, result2] = await Promise.all([
        testVersion(provider, model, version1, prompt),
        testVersion(provider, model, version2, prompt),
      ]);

      results.version1.tests.push(result1);
      results.version2.tests.push(result2);

      // Determine winner for this test
      if (result1.qualityScore > result2.qualityScore) {
        results.version1.wins++;
      } else if (result2.qualityScore > result1.qualityScore) {
        results.version2.wins++;
      }
    }

    // Calculate averages
    results.version1.avgQuality = results.version1.tests.reduce((sum, t) => sum + t.qualityScore, 0) / testPrompts.length;
    results.version1.avgResponseTime = results.version1.tests.reduce((sum, t) => sum + t.responseTime, 0) / testPrompts.length;
    results.version1.avgTokens = results.version1.tests.reduce((sum, t) => sum + t.tokens, 0) / testPrompts.length;

    results.version2.avgQuality = results.version2.tests.reduce((sum, t) => sum + t.qualityScore, 0) / testPrompts.length;
    results.version2.avgResponseTime = results.version2.tests.reduce((sum, t) => sum + t.responseTime, 0) / testPrompts.length;
    results.version2.avgTokens = results.version2.tests.reduce((sum, t) => sum + t.tokens, 0) / testPrompts.length;

    // Calculate deltas
    results.comparison.qualityDelta = results.version2.avgQuality - results.version1.avgQuality;
    results.comparison.responseTimeDelta = results.version2.avgResponseTime - results.version1.avgResponseTime;

    // Make recommendation
    if (results.comparison.qualityDelta > 0.1 && results.version2.wins > results.version1.wins) {
      results.comparison.recommendation = {
        action: 'upgrade',
        version: version2,
        confidence: 'high',
        reason: `Version ${version2} shows ${(results.comparison.qualityDelta * 100).toFixed(1)}% better quality`,
      };
    } else if (results.comparison.qualityDelta < -0.1) {
      results.comparison.recommendation = {
        action: 'keep',
        version: version1,
        confidence: 'high',
        reason: `Version ${version1} performs better`,
      };
    } else {
      results.comparison.recommendation = {
        action: 'neutral',
        version: null,
        confidence: 'low',
        reason: 'Versions perform similarly',
      };
    }

    // Cache results
    versionTests.set(testId, {
      results,
      timestamp: Date.now(),
    });

    logger.info('A/B test completed', {
      provider,
      model,
      version1,
      version2,
      recommendation: results.comparison.recommendation.action,
    });

    return results;
  } catch (error) {
    logger.error('A/B test versions error', { error: error.message });
    throw error;
  }
}

/**
 * Test a specific version
 */
async function testVersion(provider, model, version, prompt) {
  const startTime = Date.now();

  try {
    // Use version-specific model identifier
    const modelWithVersion = version ? `${model}:${version}` : model;

    const result = await generateWithFreeModel(prompt, {
      provider,
      model: modelWithVersion,
      taskType: 'content-generation',
      maxTokens: 200,
    });

    const responseTime = Date.now() - startTime;

    // Calculate quality score
    const qualityScore = calculateTestQuality(result.content, responseTime, result.tokens);

    return {
      prompt: prompt.substring(0, 50) + '...',
      content: result.content,
      qualityScore,
      responseTime,
      tokens: result.tokens,
      success: true,
    };
  } catch (error) {
    logger.warn('Version test failed', { provider, model, version, error: error.message });
    return {
      prompt: prompt.substring(0, 50) + '...',
      qualityScore: 0,
      responseTime: Date.now() - startTime,
      tokens: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate quality score for test
 */
function calculateTestQuality(content, responseTime, tokens) {
  let score = 0.5;

  // Length score (optimal range)
  if (content && content.length > 20 && content.length < 500) {
    score += 0.2;
  }

  // Response time score
  if (responseTime < 3000 && responseTime > 500) {
    score += 0.2;
  } else if (responseTime > 10000) {
    score -= 0.1;
  }

  // Content quality indicators
  if (content) {
    // Proper formatting
    if (content.includes('\n') || content.includes('. ')) {
      score += 0.1;
    }

    // No obvious errors
    if (!content.includes('ERROR') && !content.includes('undefined')) {
      score += 0.1;
    }
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Validate version before upgrade
 */
async function validateVersionBeforeUpgrade(provider, model, newVersion, options = {}) {
  try {
    const {
      testPrompts = [],
      minQualityImprovement = 0.1,
      minTests = 5,
    } = options;

    // Get current version
    const currentVersion = await ModelVersion.findOne({
      provider,
      model,
      current: true,
    });

    if (!currentVersion) {
      // No current version, can upgrade
      return {
        valid: true,
        reason: 'No current version to compare',
      };
    }

    // A/B test versions
    const testResults = await abTestVersions(
      provider,
      model,
      currentVersion.version,
      newVersion,
      testPrompts
    );

    const qualityDelta = testResults.comparison.qualityDelta;

    if (qualityDelta >= minQualityImprovement) {
      return {
        valid: true,
        reason: `Quality improvement of ${(qualityDelta * 100).toFixed(1)}%`,
        testResults,
        recommendation: 'upgrade',
      };
    } else if (qualityDelta < -0.05) {
      return {
        valid: false,
        reason: `Quality decreased by ${(Math.abs(qualityDelta) * 100).toFixed(1)}%`,
        testResults,
        recommendation: 'do_not_upgrade',
      };
    } else {
      return {
        valid: true,
        reason: 'Similar performance, safe to upgrade',
        testResults,
        recommendation: 'neutral',
      };
    }
  } catch (error) {
    logger.error('Validate version before upgrade error', { error: error.message });
    return {
      valid: false,
      reason: `Validation error: ${error.message}`,
    };
  }
}

module.exports = {
  abTestVersions,
  testVersion,
  validateVersionBeforeUpgrade,
  calculateTestQuality,
};


