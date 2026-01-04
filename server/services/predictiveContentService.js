// Predictive Content Service
// Lightweight heuristics for local dev; can be replaced with ML/LLM later.

const logger = require('../utils/logger');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function estimateFromText(text = '', platform = 'instagram') {
  const len = (text || '').trim().length;
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  const hasQuestion = /\?/.test(text);
  const hasCTA = /\b(follow|subscribe|comment|share|like|save|dm|link in bio)\b/i.test(text);

  // Base score influenced by length and platform norms
  const lengthScore =
    platform === 'twitter'
      ? clamp((len / 240) * 10, 1, 10)
      : clamp((len / 800) * 10, 1, 10);

  let score = lengthScore;
  score += clamp(hashtagCount, 0, 8) * 0.15;
  score += hasQuestion ? 0.7 : 0;
  score += hasCTA ? 0.6 : 0;
  score = clamp(score, 1, 10);

  const performanceScore = Math.round(score * 10); // 10–100

  // Very rough ranges (kept deterministic)
  const expectedEngagementRate = clamp(0.5 + score * 0.25, 0.5, 6.0); // %
  const expectedViewsMin = Math.round(200 + score * 120);
  const expectedViewsMax = Math.round(expectedViewsMin * (1.6 + score / 20));

  const expectedLikes = Math.round((expectedViewsMin * expectedEngagementRate) / 100);
  const expectedShares = Math.round(expectedLikes * 0.12);

  const positiveFactors = [];
  const negativeFactors = [];
  const recommendations = [];

  if (hasQuestion) positiveFactors.push('Includes a question (drives comments)')
  else recommendations.push('Add a question to encourage comments')

  if (hasCTA) positiveFactors.push('Has a clear call-to-action')
  else recommendations.push('Add a clear call-to-action (e.g., “Comment your take”)')

  if (hashtagCount >= 3) positiveFactors.push('Good hashtag density')
  else recommendations.push('Add 3–5 relevant hashtags')

  if (len < 80) negativeFactors.push('Content is very short')
  if (len > 2000) negativeFactors.push('Content is very long')

  return {
    expectedViews: { min: expectedViewsMin, max: expectedViewsMax },
    expectedEngagementRate,
    expectedLikes,
    expectedShares,
    performanceScore,
    positiveFactors,
    negativeFactors,
    recommendations,
  };
}

async function predictContentPerformance(contentData, userId) {
  try {
    const text = `${contentData?.title || ''}\n${contentData?.body || ''}`.trim();
    const platform = contentData?.platform || 'instagram';
    return estimateFromText(text, platform);
  } catch (error) {
    logger.error('predictContentPerformance failed', { error: error.message, userId });
    throw error;
  }
}

async function predictOptimalPostingTime(userId, platform, contentData = {}) {
  // Simple heuristic: platform-based recommended hour blocks
  const defaults = {
    instagram: ['11:00', '13:00', '19:00'],
    twitter: ['08:00', '12:00', '17:00'],
    linkedin: ['09:00', '12:00', '15:00'],
    facebook: ['12:00', '18:00', '20:00'],
    tiktok: ['18:00', '20:00', '22:00'],
    youtube: ['12:00', '16:00', '19:00'],
  };

  return {
    platform,
    timezone: contentData?.timezone || 'local',
    recommendedTimes: defaults[platform] || ['12:00', '18:00'],
  };
}

async function forecastContentTrends(platform = 'instagram', category = null, days = 30) {
  // Placeholder: return empty trends instead of 500 in local dev.
  return {
    platform,
    category,
    days,
    trends: [],
    message: 'Trend forecasting not configured in local dev',
  };
}

module.exports = {
  predictContentPerformance,
  predictOptimalPostingTime,
  forecastContentTrends,
};


