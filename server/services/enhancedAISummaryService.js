// Enhanced AI Summary Service
// Custom prompts, multi-language, industry-specific insights

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Generate enhanced AI summary with custom prompts
 */
async function generateEnhancedSummary(reportData, options = {}) {
  try {
    const {
      customPrompt = null,
      language = 'en',
      industry = null,
      tone = 'professional',
      length = 'medium',
      includePredictions = false,
      includeBenchmarks = true
    } = options;

    // Build base prompt
    let prompt = customPrompt || buildDefaultPrompt(reportData, tone, length, industry);

    // Add language instruction
    if (language !== 'en') {
      prompt += `\n\nWrite the summary in ${getLanguageName(language)}.`;
    }

    // Add industry context
    if (industry) {
      prompt += `\n\nProvide industry-specific insights for ${industry}.`;
    }

    // Add predictions if requested
    if (includePredictions) {
      prompt += `\n\nInclude predictions for next period based on current trends.`;
    }

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate enhanced summary');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a business communication expert who translates technical metrics into clear, client-friendly language.\n\n${prompt}`;
    const summaryText = await geminiGenerate(fullPrompt, {
      temperature: 0.7,
      maxTokens: length === 'short' ? 300 : (length === 'medium' ? 500 : 800)
    });

    // Generate additional insights
    const insights = await generateInsights(reportData, industry);
    const predictions = includePredictions ? await generatePredictions(reportData) : null;
    const benchmarks = includeBenchmarks ? await generateBenchmarkInsights(reportData) : null;

    return {
      text: summaryText,
      keyHighlights: extractHighlights(reportData.metrics),
      insights,
      predictions,
      benchmarks,
      recommendations: await generateRecommendations(reportData),
      generatedAt: new Date(),
      model: 'gemini-1.5-flash',
      language,
      industry
    };
  } catch (error) {
    logger.error('Error generating enhanced summary', { error: error.message });
    return generateFallbackSummary(reportData);
  }
}

/**
 * Build default prompt
 */
function buildDefaultPrompt(reportData, tone, length, industry) {
  const metricsText = formatMetricsForAI(reportData.metrics);
  const period = formatPeriod(reportData.period);

  const toneInstructions = {
    professional: 'Use professional business language',
    friendly: 'Use a friendly, approachable tone',
    formal: 'Use formal, corporate language',
    casual: 'Use a casual, conversational tone'
  };

  const lengthInstructions = {
    short: 'Write a brief 2-3 sentence summary',
    medium: 'Write a 4-6 sentence summary',
    long: 'Write a detailed 8-10 sentence summary'
  };

  return `Generate a ${length} client-friendly summary covering the period ${period}.

Metrics:
${metricsText}

Instructions:
- ${toneInstructions[tone]}
- ${lengthInstructions[length]}
- Translate technical metrics into business language
- Focus on what matters to the client (growth, ROI, engagement)
- Use positive framing when possible
- Avoid jargon and technical terms
- Make it suitable for a client presentation deck
${industry ? `- Provide ${industry}-specific context` : ''}

Write the summary:`;
}

/**
 * Generate insights
 */
async function generateInsights(reportData, industry = null) {
  try {
    const insights = [];

    // Find patterns
    const highPerformers = reportData.metrics.filter(m =>
      m.change && m.change.trend === 'up' && Math.abs(m.change.percentage) > 15
    );

    highPerformers.forEach(metric => {
      insights.push({
        type: 'performance',
        metric: metric.label || metric.metricId,
        insight: `${metric.label || metric.metricId} showed exceptional growth of ${metric.change.percentage}%`,
        impact: 'high'
      });
    });

    // Industry-specific insights
    if (industry) {
      insights.push({
        type: 'industry',
        insight: `Based on ${industry} benchmarks, performance is ${getPerformanceStatus(reportData.metrics)}`,
        impact: 'medium'
      });
    }

    return insights;
  } catch (error) {
    return [];
  }
}

/**
 * Generate predictions
 */
async function generatePredictions(reportData) {
  try {
    const predictions = [];

    // Analyze trends
    const trendingUp = reportData.metrics.filter(m =>
      m.change && m.change.trend === 'up' && m.change.percentage > 10
    );

    trendingUp.forEach(metric => {
      const predictedGrowth = metric.change.percentage * 0.8; // Conservative estimate
      predictions.push({
        metric: metric.label || metric.metricId,
        prediction: `Expected to continue growing, potentially reaching ${predictedGrowth.toFixed(1)}% increase next period`,
        confidence: 'medium'
      });
    });

    return predictions;
  } catch (error) {
    return [];
  }
}

/**
 * Generate benchmark insights
 */
async function generateBenchmarkInsights(reportData) {
  const benchmarks = [];

  reportData.metrics.forEach(metric => {
    if (metric.benchmark && metric.benchmark.percentile) {
      const percentile = metric.benchmark.percentile;
      benchmarks.push({
        metric: metric.label || metric.metricId,
        percentile,
        status: percentile >= 75 ? 'excellent' : (percentile >= 50 ? 'good' : 'needs_improvement'),
        insight: `Performing in the ${percentile >= 75 ? 'top 25%' : (percentile >= 50 ? 'top 50%' : 'bottom 50%')} of industry benchmarks`
      });
    }
  });

  return benchmarks;
}

/**
 * Get performance status
 */
function getPerformanceStatus(metrics) {
  const avgChange = metrics
    .filter(m => m.change)
    .reduce((sum, m) => sum + m.change.percentage, 0) / metrics.length;

  if (avgChange > 10) return 'above average';
  if (avgChange > 0) return 'at average';
  return 'below average';
}

/**
 * Get language name
 */
function getLanguageName(code) {
  const languages = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'pt': 'Portuguese',
    'it': 'Italian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean'
  };
  return languages[code] || 'English';
}

/**
 * Format metrics for AI
 */
function formatMetricsForAI(metrics) {
  return metrics.map(m => {
    const change = m.change || {};
    return `${m.label || m.metricId}: ${m.formattedValue || m.value} (${change.trend || 'stable'})`;
  }).join('\n');
}

/**
 * Format period
 */
function formatPeriod(period) {
  if (!period) return 'the reporting period';
  const start = new Date(period.startDate).toLocaleDateString();
  const end = new Date(period.endDate).toLocaleDateString();
  return `${start} to ${end}`;
}

/**
 * Extract highlights
 */
function extractHighlights(metrics) {
  return metrics
    .filter(m => m.change && m.change.trend === 'up' && Math.abs(m.change.percentage) > 10)
    .slice(0, 3)
    .map(m => `${m.label || m.metricId} increased by ${Math.abs(m.change.percentage)}%`);
}

/**
 * Generate recommendations
 */
async function generateRecommendations(reportData) {
  const recommendations = [];

  const declining = reportData.metrics.filter(m =>
    m.change && m.change.trend === 'down' && Math.abs(m.change.percentage) > 5
  );

  declining.forEach(m => {
    recommendations.push(`Focus on improving ${m.label || m.metricId.toLowerCase()}`);
  });

  if (recommendations.length === 0) {
    recommendations.push('Continue current strategy');
  }

  return recommendations.slice(0, 3);
}

/**
 * Generate fallback summary
 */
function generateFallbackSummary(reportData) {
  return {
    text: `Report summary for ${formatPeriod(reportData.period)}.`,
    keyHighlights: extractHighlights(reportData.metrics),
    insights: [],
    recommendations: generateRecommendations(reportData),
    generatedAt: new Date(),
    model: 'fallback'
  };
}

module.exports = {
  generateEnhancedSummary
};


