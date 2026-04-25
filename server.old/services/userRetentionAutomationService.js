/**
 * User Retention Automation Service
 * ====================================
 * AI-driven retention flywheel for 2026.
 *
 * Capabilities:
 *  - Identify at-risk audience segments (declining engagement patterns)
 *  - AI-generated 5-post re-engagement drip sequences
 *  - One-click retention campaign scheduling
 *  - Retention health score with improvement roadmap
 *  - Personalised win-back messaging per audience segment
 */

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

// ── Retention Thresholds ──────────────────────────────────────────────────────
const RISK_THRESHOLDS = {
  critical: { engagementDrop: 60, daysInactive: 21 },  // >60% drop over 21d
  high:     { engagementDrop: 40, daysInactive: 14 },  // >40% drop over 14d
  medium:   { engagementDrop: 20, daysInactive:  7 },  // >20% drop over  7d
  healthy:  { engagementDrop:  0, daysInactive:  0 },  // Stable / growing
};

// ── Re-engagement Message Templates (fallback if AI is not configured) ────────
const REENGAGEMENT_TEMPLATES = {
  curiosity: [
    'We found something surprising in your {niche} data this week...',
    'You won\'t believe what your audience is craving right now in {niche}',
    'The {niche} strategy that\'s quietly outperforming everything else right now',
  ],
  fomo: [
    '{niche} creators who did this 30 days ago are now 3× ahead. Here\'s what they did.',
    'Your competitors in {niche} made a move this week. Are you ready to respond?',
    'The {niche} window is open for exactly 14 more days. Don\'t miss it.',
  ],
  value: [
    'Here\'s your free {niche} audit: 3 things to fix this week',
    'Free template: The {niche} content calendar that drove 40% more saves',
    'Quick win for {niche} creators: one post, 3 platforms, 2× the reach',
  ],
  social_proof: [
    '{niche} creators using this one tactic saw 2.4× more shares last month',
    '127 {niche} creators changed their hook strategy this week. Here\'s the outcome.',
    'What the top 1% of {niche} creators post on Wednesdays (and why it works)',
  ],
};

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Calculate audience retention health score (0–100).
 * 100 = perfectly engaged audience, 0 = critically at-risk.
 */
async function getRetentionHealthScore(userId, analyticsData = {}) {
  try {
    const {
      currentEngagement = 0,
      previousEngagement = 0,
      avgCompletionRate = 0,
      followerGrowthRate = 0,
      commentRate = 0,
      saveRate = 0,
    } = analyticsData;

    // ── Sub-scores (each 0–100) ──
    // 1. Engagement trend (0-40 pts)
    let engagementScore = 40;
    if (previousEngagement > 0) {
      const changePct = ((currentEngagement - previousEngagement) / previousEngagement) * 100;
      if (changePct < -60) engagementScore = 0;
      else if (changePct < -40) engagementScore = 10;
      else if (changePct < -20) engagementScore = 20;
      else if (changePct < 0) engagementScore = 30;
      else engagementScore = Math.min(40, 30 + changePct);
    }

    // 2. Content completion rate (0-30 pts)
    const completionScore = Math.min(30, (avgCompletionRate / 100) * 30);

    // 3. Active engagement signals (0-20 pts) — comments + saves
    const activeScore = Math.min(20, commentRate * 10 + saveRate * 5);

    // 4. Follower growth (0-10 pts)
    const growthScore = Math.min(10, Math.max(0, followerGrowthRate * 2));

    const totalScore = Math.round(engagementScore + completionScore + activeScore + growthScore);

    // ── Risk level ──
    let riskLevel = 'healthy';
    if (totalScore < 25) riskLevel = 'critical';
    else if (totalScore < 45) riskLevel = 'high';
    else if (totalScore < 65) riskLevel = 'medium';

    // ── Improvement steps ──
    const improvements = [];
    if (completionScore < 15) improvements.push('Improve content retention arc — use 3-Act structure to keep viewers past the 50% mark');
    if (engagementScore < 20) improvements.push('Re-engage dormant audience with a 5-post re-engagement sequence');
    if (activeScore < 10) improvements.push('Add a strong specific CTA (question, poll, or "save this") to every post');
    if (growthScore < 5) improvements.push('Collaborate with 2 aligned creators this month to reignite growth');

    return {
      score: totalScore,
      riskLevel,
      breakdown: { engagementScore, completionScore, activeScore, growthScore },
      improvements,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('getRetentionHealthScore error', { error: error.message, userId });
    return { score: 50, riskLevel: 'medium', breakdown: {}, improvements: [], generatedAt: new Date().toISOString() };
  }
}

/**
 * Identify at-risk audience segments based on engagement patterns.
 */
async function identifyAtRiskAudience(userId, postsData = []) {
  try {
    const segments = [];

    // Analyse recent vs older posts engagement
    const recent = postsData.slice(0, 10);
    const older = postsData.slice(10, 20);

    const recentAvgEng = recent.reduce((s, p) => s + (p.analytics?.engagement || 0), 0) / Math.max(recent.length, 1);
    const olderAvgEng = older.reduce((s, p) => s + (p.analytics?.engagement || 0), 0) / Math.max(older.length, 1);
    const engDropPct = olderAvgEng > 0 ? ((recentAvgEng - olderAvgEng) / olderAvgEng) * 100 : 0;

    // Determine platform-level risk
    const platformEngagement = {};
    postsData.forEach((p) => {
      if (!platformEngagement[p.platform]) platformEngagement[p.platform] = { posts: 0, eng: 0 };
      platformEngagement[p.platform].posts++;
      platformEngagement[p.platform].eng += p.analytics?.engagement || 0;
    });

    Object.entries(platformEngagement).forEach(([platform, data]) => {
      const avgEng = data.posts > 0 ? data.eng / data.posts : 0;
      if (avgEng < 50 && data.posts >= 3) {
        segments.push({
          segment: `${platform} audience`,
          platform,
          risk: avgEng < 10 ? 'critical' : avgEng < 30 ? 'high' : 'medium',
          avgEngagement: Math.round(avgEng),
          recommendation: `Re-engage ${platform} audience with platform-native format`,
        });
      }
    });

    // Overall trend
    if (engDropPct < -20) {
      segments.push({
        segment: 'Overall Audience',
        platform: 'all',
        risk: engDropPct < -40 ? 'critical' : 'high',
        engagementDrop: Math.round(engDropPct),
        recommendation: 'Launch a 5-post re-engagement sequence across all platforms',
      });
    }

    return {
      atRiskSegments: segments,
      overallEngagementTrend: engDropPct,
      totalSegmentsAtRisk: segments.length,
      requiresImmediateAction: segments.some((s) => s.risk === 'critical'),
    };
  } catch (error) {
    logger.error('identifyAtRiskAudience error', { error: error.message, userId });
    return { atRiskSegments: [], overallEngagementTrend: 0, totalSegmentsAtRisk: 0, requiresImmediateAction: false };
  }
}

/**
 * Generate a 5-post AI-written re-engagement drip sequence.
 */
async function generateRetentionSequence(userId, niche = 'general', platform = 'instagram', audienceSegment = {}) {
  try {
    if (!geminiConfigured) {
      // Fallback: use template library
      const hooks = [
        'curiosity', 'fomo', 'value', 'social_proof', 'curiosity'
      ];
      return {
        posts: hooks.map((type, i) => ({
          postNumber: i + 1,
          dayOffset: i * 3,  // post every 3 days
          hook: (REENGAGEMENT_TEMPLATES[type][0] || '').replace('{niche}', niche),
          format: ['carousel', 'reel', 'single-image', 'video', 'text-post'][i],
          platform,
          cta: `Tell me: what's your biggest ${niche} challenge right now?`,
          psychTrigger: type,
          objective: i < 2 ? 'Reactivate dormant segment' : i < 4 ? 'Deepen engagement' : 'Convert to loyal fan',
        })),
        sequenceName: `${niche} Win-Back Sequence`,
        estimatedReachRate: '45–65% of inactive segment',
        bestStartDay: 'Monday',
        source: 'template-library',
      };
    }

    const prompt = `You are a 2026 master retention marketer. Generate a 5-post social media re-engagement sequence.

Context:
- Niche: ${niche}
- Platform: ${platform}
- Audience Risk Level: ${audienceSegment.risk || 'high'}
- Strategy: Use progressive psychological triggers — start with curiosity, build to value, close with social proof

Return a JSON object with:
- posts: array of 5 objects, each with:
  - postNumber (1-5)
  - dayOffset (0, 3, 6, 9, 12 — post every 3 days)
  - hook (the first 2 sentences of the post — must be scroll-stopping)
  - bodyPreview (next 3-4 sentences)
  - cta (specific call-to-action)
  - format (reel/carousel/single-image/text-post)
  - psychTrigger (curiosity/fomo/value/social_proof/belonging)
  - objective (reactivate/deepen/convert)
- sequenceName: catchy name for this sequence
- estimatedReachRate: realistic reach estimate
- bestStartDay: best day to begin the sequence

Make each post distinctly different in format and tone. Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 2000, temperature: 0.88 });
    const parsed = JSON.parse(response || '{}');
    return { ...parsed, generatedAt: new Date().toISOString(), niche, platform, source: 'ai-generated' };
  } catch (error) {
    logger.error('generateRetentionSequence error', { error: error.message, userId, niche });
    return { posts: [], sequenceName: 'Re-engagement Sequence', source: 'error' };
  }
}

/**
 * Build a complete auto-schedule plan for a retention campaign.
 * Returns scheduling metadata ready to pass to the scheduler service.
 */
async function buildRetentionCampaignPlan(userId, niche, platform, analyticsData = {}) {
  try {
    const healthScore = await getRetentionHealthScore(userId, analyticsData);
    const sequence = await generateRetentionSequence(userId, niche, platform, { risk: healthScore.riskLevel });

    // Determine best posting times based on platform
    const platformOptimalTimes = {
      instagram: ['10:00', '14:00', '19:00'],
      tiktok:    ['07:00', '12:00', '21:00'],
      linkedin:  ['08:00', '12:00', '17:00'],
      twitter:   ['09:00', '15:00', '20:00'],
      youtube:   ['14:00', '16:00', '20:00'],
      facebook:  ['13:00', '15:00', '20:00'],
    };

    const times = platformOptimalTimes[platform] || ['12:00', '17:00', '20:00'];
    const now = new Date();

    const scheduledPosts = (sequence.posts || []).map((post, i) => {
      const postDate = new Date(now);
      postDate.setDate(postDate.getDate() + (post.dayOffset || i * 3));
      const [hour, minute] = times[i % times.length].split(':');
      postDate.setHours(parseInt(hour), parseInt(minute), 0, 0);

      return {
        ...post,
        scheduledAt: postDate.toISOString(),
        platform,
        status: 'pending',
        campaignTag: `retention-${Date.now()}`,
      };
    });

    return {
      campaignName: sequence.sequenceName || `${niche} Retention Campaign`,
      healthScoreAtLaunch: healthScore.score,
      riskLevel: healthScore.riskLevel,
      platform,
      niche,
      scheduledPosts,
      totalPosts: scheduledPosts.length,
      campaignDurationDays: 12,
      expectedOutcome: `Estimated recovery of ${Math.round(20 + healthScore.score * 0.3)}% of dormant engagement`,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('buildRetentionCampaignPlan error', { error: error.message, userId });
    return { campaignName: 'Retention Campaign', scheduledPosts: [], totalPosts: 0 };
  }
}

module.exports = {
  getRetentionHealthScore,
  identifyAtRiskAudience,
  generateRetentionSequence,
  buildRetentionCampaignPlan,
  RISK_THRESHOLDS,
};
