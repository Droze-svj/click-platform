// AI Report Summary Service
// Generate client-friendly, non-technical narratives

const OpenAI = require('openai');
const logger = require('../utils/logger');

// Lazy initialization - only create client when needed and if API key is available
let openai = null;

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (error) {
      logger.warn('Failed to initialize OpenAI client', { error: error.message });
      return null;
    }
  }
  return openai;
}

/**
 * Generate AI summary for report
 */
async function generateReportSummary(reportData, templateConfig) {
  try {
    const {
      metrics,
      period,
      clientName,
      tone = 'professional',
      length = 'medium',
      includeRecommendations = true
    } = { ...templateConfig, ...reportData };

    // Prepare metrics summary
    const metricsText = formatMetricsForAI(metrics);

    // Build prompt
    const prompt = buildSummaryPrompt(
      metricsText,
      period,
      clientName,
      tone,
      length,
      includeRecommendations
    );

    // Get OpenAI client (lazy initialization)
    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, using fallback summary');
      return generateFallbackSummary(reportData);
    }

    // Generate summary
    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a business communication expert who translates technical metrics into clear, client-friendly language. Write in a professional but accessible tone.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: length === 'short' ? 300 : (length === 'medium' ? 500 : 800)
    });

    const summaryText = response.choices[0].message.content;

    // Extract key highlights and recommendations
    const highlights = extractHighlights(metrics);
    const recommendations = includeRecommendations ? await generateRecommendations(metrics) : [];

    return {
      text: summaryText,
      keyHighlights: highlights,
      recommendations,
      generatedAt: new Date(),
      model: 'gpt-4'
    };
  } catch (error) {
    logger.error('Error generating AI summary', { error: error.message });
    // Fallback to basic summary
    return generateFallbackSummary(reportData);
  }
}

/**
 * Format metrics for AI
 */
function formatMetricsForAI(metrics) {
  const formatted = [];

  metrics.forEach(metric => {
    const change = metric.change || {};
    const trend = change.trend || 'stable';
    const percentage = change.percentage || 0;

    let description = `${metric.label || metric.metricId}: ${metric.formattedValue || metric.value}`;
    
    if (change.value !== undefined) {
      const trendText = trend === 'up' ? 'increased' : (trend === 'down' ? 'decreased' : 'remained stable');
      description += ` (${trendText} by ${Math.abs(percentage)}%)`;
    }

    if (metric.benchmark && metric.benchmark.percentile) {
      description += ` - performing in the ${getPercentileText(metric.benchmark.percentile)} percentile`;
    }

    formatted.push(description);
  });

  return formatted.join('\n');
}

/**
 * Get percentile text
 */
function getPercentileText(percentile) {
  if (percentile >= 90) return 'top 10%';
  if (percentile >= 75) return 'top 25%';
  if (percentile >= 50) return 'top 50%';
  if (percentile >= 25) return 'bottom 50%';
  return 'bottom 25%';
}

/**
 * Build summary prompt
 */
function buildSummaryPrompt(metricsText, period, clientName, tone, length, includeRecommendations) {
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

  return `Generate a ${length} client-friendly summary for ${clientName || 'the client'} covering the period ${formatPeriod(period)}.

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
${includeRecommendations ? '- Include 2-3 actionable recommendations at the end' : ''}

Write the summary:`;
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
  const highlights = [];

  // Find top performers
  const topMetrics = metrics
    .filter(m => m.change && m.change.trend === 'up' && Math.abs(m.change.percentage) > 10)
    .sort((a, b) => Math.abs(b.change.percentage) - Math.abs(a.change.percentage))
    .slice(0, 3);

  topMetrics.forEach(metric => {
    highlights.push(`${metric.label || metric.metricId} increased by ${Math.abs(metric.change.percentage)}%`);
  });

  // Find benchmark leaders
  const benchmarkLeaders = metrics
    .filter(m => m.benchmark && m.benchmark.percentile >= 75)
    .slice(0, 2);

  benchmarkLeaders.forEach(metric => {
    highlights.push(`${metric.label || metric.metricId} is performing in the top ${100 - metric.benchmark.percentile}%`);
  });

  return highlights;
}

/**
 * Generate recommendations
 */
async function generateRecommendations(metrics) {
  const recommendations = [];

  // Find areas for improvement
  const decliningMetrics = metrics.filter(m => 
    m.change && m.change.trend === 'down' && Math.abs(m.change.percentage) > 5
  );

  decliningMetrics.forEach(metric => {
    recommendations.push(`Focus on improving ${metric.label || metric.metricId.toLowerCase()} which decreased by ${Math.abs(metric.change.percentage)}%`);
  });

  // Find low performers vs benchmarks
  const lowBenchmarks = metrics.filter(m => 
    m.benchmark && m.benchmark.percentile < 50
  );

  lowBenchmarks.forEach(metric => {
    recommendations.push(`Optimize ${metric.label || metric.metricId.toLowerCase()} to reach industry benchmarks`);
  });

  // Generic recommendations if none found
  if (recommendations.length === 0) {
    recommendations.push('Continue current strategy to maintain strong performance');
    recommendations.push('Explore new content formats to drive further engagement');
  }

  return recommendations.slice(0, 3);
}

/**
 * Generate fallback summary
 */
function generateFallbackSummary(reportData) {
  const { metrics, period } = reportData;

  const summary = `This report covers ${formatPeriod(period)}. `;
  const highlights = extractHighlights(metrics);
  const recommendations = generateRecommendations(metrics);

  return {
    text: summary + highlights.join('. ') + '.',
    keyHighlights: highlights,
    recommendations,
    generatedAt: new Date(),
    model: 'fallback'
  };
}

/**
 * Generate multi-client rollup summary
 */
async function generateRollupSummary(rollupData, tone = 'professional') {
  try {
    const { totals, riskSummary, topPerformers, period } = rollupData;

    const prompt = `Generate a summary for an agency owner covering ${rollupData.clients.length} clients for the period ${formatPeriod(period)}.

Key Metrics:
- Total Reach: ${totals.totalReach.toLocaleString()}
- Total Engagement: ${totals.totalEngagement.toLocaleString()}
- Average Engagement Rate: ${totals.averageEngagementRate.toFixed(2)}%
- Total Revenue: $${totals.totalRevenue.toLocaleString()}
- Average ROI: ${totals.averageRoi.toFixed(2)}%
- Average Health Score: ${totals.averageHealthScore.toFixed(0)}/100

Risk Summary:
- ${riskSummary.clientsAtRisk} of ${riskSummary.totalClients} clients have risk flags
- ${riskSummary.criticalRisks} critical risks
- ${riskSummary.highRisks} high risks

Top Performers:
- Engagement: ${topPerformers.byEngagement.map(c => c.clientName).join(', ')}
- Growth: ${topPerformers.byGrowth.map(c => c.clientName).join(', ')}
- ROI: ${topPerformers.byRoi.map(c => c.clientName).join(', ')}

Write a ${tone} summary suitable for agency leadership:`;

    // Get OpenAI client (lazy initialization)
    const client = getOpenAIClient();
    if (!client) {
      logger.warn('OpenAI API key not configured, using fallback rollup summary');
      return {
        text: `Agency performance summary for ${rollupData.clients.length} clients.`,
        generatedAt: new Date(),
        model: 'fallback'
      };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a business analyst providing insights to agency leadership.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return {
      text: response.choices[0].message.content,
      generatedAt: new Date(),
      model: 'gpt-4'
    };
  } catch (error) {
    logger.error('Error generating rollup summary', { error: error.message });
    return {
      text: `Agency performance summary for ${rollupData.clients.length} clients.`,
      generatedAt: new Date(),
      model: 'fallback'
    };
  }
}

module.exports = {
  generateReportSummary,
  generateRollupSummary
};


