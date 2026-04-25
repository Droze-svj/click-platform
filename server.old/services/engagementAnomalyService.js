// Engagement Anomaly Detector Service
// Detects unusual engagement patterns and generates LLM-powered actionable advice.

const logger = require('../utils/logger');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');

const ANOMALY_TYPES = {
  VIRALITY_SPIKE: 'virality_spike',
  DROP_OFF: 'drop_off',
  SHADOW_BANNED: 'shadow_banned',
  LOW_COMMENT_RATIO: 'low_comment_ratio',
  NONE: 'none',
};

/**
 * Diagnose an anomaly from a post's metric object.
 * @param {{ views: number, likes: number, comments: number, shares: number, velocity: number, hoursSincePost: number }} metrics
 * @returns {{ type: string, severity: 'low'|'medium'|'high', diagnosis: string }}
 */
function detectAnomalies(metrics = {}) {
  const {
    views = 0,
    likes = 0,
    comments = 0,
    shares = 0,
    velocity = 0,
    hoursSincePost = 24,
  } = metrics;

  // Guard: no data, no anomaly
  if (views === 0) return { type: ANOMALY_TYPES.NONE, severity: 'low', diagnosis: 'No data yet.' };

  const engagementRate = ((likes + comments + shares) / views) * 100;
  const commentToLikeRatio = likes > 0 ? comments / likes : 0;

  // Check: Virality Spike
  if (velocity > 200 && views > 5000) {
    return {
      type: ANOMALY_TYPES.VIRALITY_SPIKE,
      severity: 'high',
      diagnosis: 'Content is entering a virality loop — very high engagement velocity detected.',
    };
  }

  // Check: Possible shadow ban (very low reach despite age)
  if (hoursSincePost > 12 && views < 150 && engagementRate > 8) {
    return {
      type: ANOMALY_TYPES.SHADOW_BANNED,
      severity: 'high',
      diagnosis: 'High engagement rate but very low reach. Possible shadow-ban or suppression detected.',
    };
  }

  // Check: Drop-off (views fell significantly relative to velocity)
  if (hoursSincePost > 6 && velocity < 5 && views > 500) {
    return {
      type: ANOMALY_TYPES.DROP_OFF,
      severity: 'medium',
      diagnosis: 'Engagement velocity has plateaued quickly. The algorithm may have stopped distributing this content.',
    };
  }

  // Check: Low comment-to-like ratio (passive audience, no discussion)
  if (engagementRate > 3 && commentToLikeRatio < 0.02 && views > 1000) {
    return {
      type: ANOMALY_TYPES.LOW_COMMENT_RATIO,
      severity: 'low',
      diagnosis: 'Audience is liking but not commenting. Missing engagement depth signal for algorithm.',
    };
  }

  return { type: ANOMALY_TYPES.NONE, severity: 'low', diagnosis: 'Engagement looks healthy.' };
}

/**
 * Generate a specific, actionable recommendation for a detected anomaly.
 * @param {string} anomalyType - One of the ANOMALY_TYPES values
 * @param {{ platform?: string, niche?: string }} context
 * @returns {Promise<{ action: string, reasoning: string, urgency: string }>}
 */
async function generateAnomalyAdvice(anomalyType, context = {}) {
  const { platform = 'tiktok', niche = 'general' } = context;

  // Instant local fallbacks (do not require AI)
  const fallbacks = {
    [ANOMALY_TYPES.VIRALITY_SPIKE]: {
      action: 'Reply to the top 20 comments immediately to fuel the algorithm further.',
      reasoning: 'Comment replies generate new notifications and keep the engagement loop alive.',
      urgency: 'Act now — you have a ~2-4 hour window.',
    },
    [ANOMALY_TYPES.SHADOW_BANNED]: {
      action: 'Delete and re-upload the video without the flagged hashtags in 24 hours.',
      reasoning: 'Shadow bans often last 24h. Re-uploading with adjusted tags often resets the restriction.',
      urgency: 'High — audience cannot discover you.',
    },
    [ANOMALY_TYPES.DROP_OFF]: {
      action: 'Stitch or duet this video with a controversial hook to re-inject it into feeds.',
      reasoning: 'Stitching creates a new distribution event tied to the original content.',
      urgency: 'Medium — act within 48 hours for best results.',
    },
    [ANOMALY_TYPES.LOW_COMMENT_RATIO]: {
      action: 'Add a text overlay question or a "comment your answer" CTA at the 3-second mark.',
      reasoning: 'The algorithm weights comment velocity heavily. A direct question dramatically increases discussion.',
      urgency: 'Low — update caption now and pin a comment.',
    },
    [ANOMALY_TYPES.NONE]: {
      action: 'Keep going — share to your other platforms to diversify reach.',
      reasoning: 'Cross-platform distribution amplifies organic reach without any editing needed.',
      urgency: 'None.',
    },
  };

  if (!geminiConfigured) {
    return fallbacks[anomalyType] || fallbacks[ANOMALY_TYPES.NONE];
  }

  try {
    const prompt = `You are an expert social media growth advisor specializing in ${platform}.
A creator in the "${niche}" niche has triggered this engagement anomaly: "${anomalyType}".

Give one very specific, immediately actionable piece of advice. Keep it sharp and practical.
Respond in JSON: { "action": "...", "reasoning": "...", "urgency": "..." }`;

    const response = await geminiGenerate(prompt, { temperature: 0.3 });
    return JSON.parse(response);
  } catch (err) {
    logger.warn('Anomaly advice AI call failed, using fallback', { err: err.message });
    return fallbacks[anomalyType] || fallbacks[ANOMALY_TYPES.NONE];
  }
}

/**
 * Full pipeline: detect anomaly + generate advice in one call.
 */
async function analyzePost(metrics, context = {}) {
  const anomaly = detectAnomalies(metrics);
  const advice = await generateAnomalyAdvice(anomaly.type, context);
  return { anomaly, advice };
}

module.exports = {
  detectAnomalies,
  generateAnomalyAdvice,
  analyzePost,
  ANOMALY_TYPES,
};
