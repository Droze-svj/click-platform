// Predictive Content Service — AI-Upgraded via aiRouter (Gemini → OpenAI →
// Anthropic → heuristic). Uses the niche-aware playbook from
// marketingKnowledge so predictions reflect platform retention curves and
// niche voice instead of generic text-length heuristics.

const logger = require('../utils/logger');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function estimateFromText(text = '', platform = 'instagram') {
  const len = (text || '').trim().length;
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  const hasQuestion = /\?/.test(text);
  const hasCTA = /\b(follow|subscribe|comment|share|like|save|dm|link in bio)\b/i.test(text);
  const hasEmoji = /\p{Emoji}/u.test(text);

  const lengthScore = platform === 'twitter'
    ? clamp((len / 240) * 10, 1, 10)
    : clamp((len / 800) * 10, 1, 10);

  let score = lengthScore;
  score += clamp(hashtagCount, 0, 8) * 0.15;
  score += hasQuestion ? 0.7 : 0;
  score += hasCTA ? 0.6 : 0;
  score += hasEmoji ? 0.3 : 0;
  score = clamp(score, 1, 10);

  const performanceScore = Math.round(score * 10);
  const expectedEngagementRate = clamp(0.5 + score * 0.25, 0.5, 6.0);
  const expectedViewsMin = Math.round(200 + score * 120);
  const expectedViewsMax = Math.round(expectedViewsMin * (1.6 + score / 20));
  const expectedLikes = Math.round((expectedViewsMin * expectedEngagementRate) / 100);
  const expectedShares = Math.round(expectedLikes * 0.12);

  const positiveFactors = [];
  const negativeFactors = [];
  const recommendations = [];

  if (hasQuestion) positiveFactors.push('Includes a question (drives comments)');
  else recommendations.push('Add a question to encourage comments');

  if (hasCTA) positiveFactors.push('Has a clear call-to-action');
  else recommendations.push('Add a clear CTA (e.g., "Comment your take")');

  if (hashtagCount >= 3) positiveFactors.push('Good hashtag density');
  else recommendations.push('Add 3-5 relevant hashtags');

  if (hasEmoji) positiveFactors.push('Emojis improve visual scannability');
  else recommendations.push('Add 1-2 emojis to improve click-through rate');

  if (len < 80) negativeFactors.push('Content is very short');
  if (len > 2000) negativeFactors.push('Content is very long');

  return {
    expectedViews: { min: expectedViewsMin, max: expectedViewsMax },
    expectedEngagementRate,
    expectedLikes,
    expectedShares,
    performanceScore,
    positiveFactors,
    negativeFactors,
    recommendations,
    source: 'heuristic',
  };
}

async function predictContentPerformance(contentData, userId) {
  try {
    const text = `${contentData?.title || ''}\n${contentData?.body || ''}`.trim();
    const platform = contentData?.platform || 'instagram';
    const niche = contentData?.niche || 'general';

    const heuristic = estimateFromText(text, platform);

    const systemPrompt = buildSystemPrompt({
      persona: 'marketing-coach',
      niche,
      platform,
      stage: 'analyze',
      language: contentData?.language || 'en',
      extra: 'Predict performance using the niche playbook + platform retention curve. Return strict JSON only.',
    });
    const userPrompt = [
      `── Task ──`,
      `Predict the performance of this post and surface the single highest-leverage fix.`,
      ``,
      `Content (truncated to 400 chars):`,
      `"${text.substring(0, 400)}"`,
      ``,
      `Return JSON with keys exactly:`,
      `  performanceScore        (0-100)`,
      `  expectedEngagementRate  (decimal % e.g. 4.2)`,
      `  forecastedViews         { min: number, max: number }`,
      `  topStrength             (short phrase)`,
      `  criticalFix             (single most impactful change)`,
    ].join('\n');

    const aiData = await aiCallJson(userPrompt, null, {
      systemPrompt,
      taskType: 'content-performance-prediction',
      maxTokens: 600,
      temperature: 0.3,
    });
    if (!aiData) {
      logger.info('predictiveContent: aiCallJson returned null, using heuristic');
      return heuristic;
    }

    return {
      ...heuristic,
      performanceScore: aiData.performanceScore || heuristic.performanceScore,
      expectedEngagementRate: aiData.expectedEngagementRate || heuristic.expectedEngagementRate,
      forecastedViews: aiData.forecastedViews,
      aiInsight: { topStrength: aiData.topStrength, criticalFix: aiData.criticalFix },
      source: 'ai-enhanced',
    };
  } catch (error) {
    logger.error('predictContentPerformance failed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate platform-specific micro-copy improvements.
 */
async function generateContentOptimizationSuggestions(text, platform = 'instagram', goal = 'engagement') {
  const fallback = {
    suggestions: [
      { type: 'hook', before: text.substring(0, 60), after: 'Start with a number or provocative question for more scroll-stop power.', reason: 'Pattern interrupt' },
      { type: 'cta', before: '', after: `Add "Comment if you agree" to boost reply rate.`, reason: 'Comment triggers boost algorithmic reach' },
    ],
    source: 'heuristic',
  };

  const systemPrompt = buildSystemPrompt({
    persona: 'caption-writer',
    platform,
    niche: 'business',
    stage: 'optimize',
    extra: `Optimize for goal="${goal}". Use the niche + platform playbook above. Return strict JSON only.`,
  });
  const userPrompt = [
    `── Task ──`,
    `Give 3 hyper-specific micro-improvements (hook, cta, hashtags) using the playbook.`,
    ``,
    `Original (truncated to 500 chars):`,
    `"${text.substring(0, 500)}"`,
    ``,
    `Return JSON:`,
    `{ "suggestions": [`,
    `  { "type": "hook",      "before": "...", "after": "...", "reason": "..." },`,
    `  { "type": "cta",       "before": "...", "after": "...", "reason": "..." },`,
    `  { "type": "hashtags",  "before": "...", "after": "...", "reason": "..." }`,
    `] }`,
  ].join('\n');

  const aiData = await aiCallJson(userPrompt, null, {
    systemPrompt,
    taskType: 'content-optimization-suggestions',
    maxTokens: 800,
    temperature: 0.5,
  });
  if (!aiData) return fallback;
  return { ...aiData, source: 'ai' };
}

/**
 * Predict best posting time using platform heuristics + goal optimization.
 */
async function predictOptimalPostingTime(userId, platform, contentData = {}) {
  const goal = contentData?.goal || 'engagement';

  const peakHours = {
    engagement: { tiktok: ['20:00', '22:00', '07:00'], instagram: ['11:00', '19:00', '21:00'], youtube: ['15:00', '20:00'], linkedin: ['09:00', '12:00'], twitter: ['12:00', '17:00'], facebook: ['12:00', '18:00'] },
    viral:      { tiktok: ['22:00', '23:00', '08:00'], instagram: ['12:00', '20:00', '22:00'], youtube: ['16:00', '19:00'], linkedin: ['08:00', '12:00'], twitter: ['08:00', '12:00'], facebook: ['11:00', '20:00'] },
    monetize:   { tiktok: ['18:00', '20:00'], instagram: ['11:00', '13:00', '19:00'], youtube: ['14:00', '17:00'], linkedin: ['09:00', '12:00'], twitter: ['10:00', '14:00'], facebook: ['13:00', '18:00'] },
  };

  const goalHours = peakHours[goal] || peakHours.engagement;
  const times = goalHours[platform] || ['12:00', '18:00'];

  return {
    platform,
    goal,
    timezone: contentData?.timezone || 'local',
    recommendedTimes: times,
    bestTime: times[0],
    reasoning: `Optimized for max "${goal}" on ${platform} based on platform algorithm peak hours.`,
  };
}

async function forecastContentTrends(platform = 'instagram', category = null, days = 30) {
  return { platform, category, days, trends: [], message: 'Trend forecasting not configured in local dev' };
}

module.exports = {
  predictContentPerformance,
  predictOptimalPostingTime,
  forecastContentTrends,
  generateContentOptimizationSuggestions,
};
