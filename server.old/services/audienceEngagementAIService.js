/**
 * Audience Engagement AI Service
 * ================================
 * Turns passive followers into active community members using AI-powered engagement intelligence.
 *
 * - Score engagement quality (passive likes vs. active comments/saves/shares)
 * - AI-written CTAs, polls, question hooks for each platform
 * - Identify top fans and power users for community-building
 * - Design 3-touchpoint engagement loops around specific posts
 */

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

// ── Platform-specific engagement benchmarks (2026 standards) ─────────────────
const ENGAGEMENT_BENCHMARKS = {
  instagram: { excellent: 6, good: 3.5, average: 2, poor: 1 },
  tiktok:    { excellent: 8, good: 5,   average: 3, poor: 1.5 },
  linkedin:  { excellent: 4, good: 2.5, average: 1.5, poor: 0.5 },
  twitter:   { excellent: 3, good: 1.5, average: 0.8, poor: 0.3 },
  youtube:   { excellent: 5, good: 3,   average: 1.5, poor: 0.5 },
  facebook:  { excellent: 3, good: 1.5, average: 0.8, poor: 0.3 },
};

// ── Engagement prompt templates by platform ───────────────────────────────────
const ENGAGEMENT_CTA_TEMPLATES = {
  instagram: [
    'Drop a 🔥 if you\'ve experienced this before — let\'s see how many of us are in the same boat',
    'Comment your answer: would you rather [A] or [B]? (90% choose wrong)',
    'Save this for later — you\'ll want to come back to this one 📌',
    'Tag someone who needs to see this today 👇',
  ],
  tiktok: [
    'POV: [Relatable scenario]. Comment your version below 👇',
    'Stitch this with your take — I\'ll feature the best ones',
    'This or that: [Option A] vs [Option B]? Comment your pick',
    'Tell me I\'m wrong in the comments. I\'ll wait.',
  ],
  linkedin: [
    'I\'m curious: what\'s your experience with this? Comment below — I read every reply.',
    'Hot take: [Opinion]. Agree or disagree? Let\'s debate in the comments.',
    'Poll: Which approach works best in your experience? [A / B / C / Neither]',
    'What would you add to this? The comments often teach me more than the post.',
  ],
  twitter: [
    'Quote tweet with your hot take 🔁',
    'Retweet if you agree, reply if you disagree',
    'One word to describe this: go 👇',
    'Thread your experience below — let\'s build a resource together',
  ],
  youtube: [
    'Timestamp your favourite part in the comments — I\'ll pin the most popular',
    'Would you like a follow-up video on [specific subtopic]? Let me know below',
    'What should I cover next? Your comment decides the next video',
    'Share this with someone who needs to hear it — you might change their perspective',
  ],
};

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Score engagement quality: differentiates passive (views, likes) vs active (comments, saves, shares).
 * Returns a 0–100 quality score and breakdown.
 */
async function scoreEngagementQuality(userId, postsAnalytics = []) {
  try {
    if (!postsAnalytics.length) {
      return { qualityScore: 0, passiveScore: 0, activeScore: 0, verdict: 'No data', improvements: [] };
    }

    // Active engagement: comments, saves, shares (weighted higher)
    // Passive: likes, views
    let totalActive = 0, totalPassive = 0, totalReach = 0;

    postsAnalytics.forEach((post) => {
      const a = post.analytics || {};
      totalActive  += (a.comments || 0) * 3 + (a.saves || 0) * 4 + (a.shares || 0) * 5;
      totalPassive += (a.likes || 0) + (a.views || 0) * 0.1;
      totalReach   += a.impressions || a.reach || a.views || 0;
    });

    const activeRate  = totalReach > 0 ? (totalActive  / totalReach) * 100 : 0;
    const passiveRate = totalReach > 0 ? (totalPassive / totalReach) * 100 : 0;

    // Quality score: 70% active engagement, 30% passive
    const qualityScore = Math.min(100, Math.round(Math.min(activeRate * 15, 70) + Math.min(passiveRate * 3, 30)));

    let verdict;
    if (qualityScore >= 75)      verdict = '🏆 Exceptional — your audience is deeply invested';
    else if (qualityScore >= 55) verdict = '💪 Strong — building real community momentum';
    else if (qualityScore >= 35) verdict = '📈 Growing — active engagement is emerging';
    else if (qualityScore >= 15) verdict = '⚠️ Passive — audience is watching, not participating';
    else                         verdict = '🔴 Dormant — immediate re-engagement strategy needed';

    const improvements = [];
    if (activeRate < 1)  improvements.push('Add a specific question or poll to every post — passive audiences need an explicit invitation to engage');
    if (passiveRate < 2) improvements.push('Boost visibility: collaborate with a creator in your niche to reach a fresh audience');
    if (qualityScore < 40) improvements.push('Run a 3-touchpoint engagement loop: reaction → question → action within one week');

    return { qualityScore, activeScore: Math.round(activeRate * 100) / 100, passiveScore: Math.round(passiveRate * 100) / 100, totalReach, verdict, improvements, generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('scoreEngagementQuality error', { error: error.message, userId });
    return { qualityScore: 0, verdict: 'Analysis unavailable', improvements: [] };
  }
}

/**
 * Generate AI-written engagement-driving prompts (CTAs, polls, questions) for a platform.
 */
async function generateEngagementPrompts(userId, platform = 'instagram', niche = 'general', recentTopic = '') {
  try {
    const fallbackTemplates = (ENGAGEMENT_CTA_TEMPLATES[platform] || ENGAGEMENT_CTA_TEMPLATES.instagram)
      .map((t) => ({ prompt: t, type: 'cta', platform, estimated_engagement_lift: '15–35%' }));

    if (!geminiConfigured) {
      return { prompts: fallbackTemplates, platform, niche, source: 'template-library' };
    }

    const prompt = `You are a 2026 community-building specialist. Generate 6 highly specific engagement-driving prompts for a ${niche} creator on ${platform}.

Context:
- Platform: ${platform}
- Niche: ${niche}
- Recent topic: "${recentTopic || 'general ' + niche + ' content'}"
- Goal: transform passive viewers into active commenters/savers/sharers

Generate 6 prompts — 2 questions, 2 CTAs, 1 poll, 1 challenge. Each must be:
- Specific to ${niche} (not generic)
- Natural and conversational (not forced)
- Designed for ${platform}'s engagement mechanics

Return JSON with "prompts" array. Each: text, type (question/cta/poll/challenge), estimatedLift (% engagement increase), psychTrigger.
Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000, temperature: 0.88 });
    const parsed = JSON.parse(response || '{}');
    return { prompts: parsed.prompts || fallbackTemplates, platform, niche, source: 'ai-generated', generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('generateEngagementPrompts error', { error: error.message, userId, platform });
    const fallback = (ENGAGEMENT_CTA_TEMPLATES[platform] || ENGAGEMENT_CTA_TEMPLATES.instagram)
      .map((t) => ({ text: t, type: 'cta', platform }));
    return { prompts: fallback, platform, niche, source: 'fallback' };
  }
}

/**
 * Identify top fans (power users) from engagement data for community cultivation.
 */
async function identifyTopFans(userId, engagementData = []) {
  try {
    if (!engagementData.length) {
      return { topFans: [], totalIdentified: 0, recommended: [] };
    }

    // Score each commenter/engager by activity
    const fanScores = {};
    engagementData.forEach((interaction) => {
      const fan = interaction.username || interaction.userId || 'anonymous';
      if (!fanScores[fan]) fanScores[fan] = { username: fan, comments: 0, saves: 0, shares: 0, score: 0 };
      if (interaction.type === 'comment') { fanScores[fan].comments++; fanScores[fan].score += 3; }
      if (interaction.type === 'save')    { fanScores[fan].saves++;    fanScores[fan].score += 4; }
      if (interaction.type === 'share')   { fanScores[fan].shares++;   fanScores[fan].score += 5; }
    });

    const sorted = Object.values(fanScores).sort((a, b) => b.score - a.score).slice(0, 10);

    const recommended = sorted.slice(0, 3).map((fan) => ({
      username: fan.username,
      action: fan.score > 30 ? 'DM with exclusive early access or thank-you message' : 'Reply to their next comment with a personal question',
      rationale: `${fan.score} engagement points — your most invested community member`,
    }));

    return { topFans: sorted, totalIdentified: sorted.length, recommended, analysedInteractions: engagementData.length, generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('identifyTopFans error', { error: error.message, userId });
    return { topFans: [], totalIdentified: 0, recommended: [] };
  }
}

/**
 * Design a 3-touchpoint engagement loop around a specific post.
 * Touchpoint 1: Reaction trigger (the post itself)
 * Touchpoint 2: Follow-up Story/Reply (24h later)
 * Touchpoint 3: Synthesis + reward (48–72h later)
 */
async function createEngagementLoop(userId, postId, postTopic, niche, platform) {
  try {
    if (!geminiConfigured) {
      return {
        loopId: `loop-${Date.now()}`,
        postId,
        touchpoints: [
          { step: 1, timing: 'At publish', action: 'Post with a specific question CTA', content: `What's your biggest challenge with ${niche} right now? Drop it below 👇`, platform },
          { step: 2, timing: '24h after publish', action: 'Post a Story/Reply featuring top comments', content: `You said [top comment]. Here's my honest response + what I'm doing about it.`, platform },
          { step: 3, timing: '48–72h after publish', action: 'Synthesis post crediting community', content: `The community has spoken. Here are the top 3 ${niche} challenges you shared — and my solution to each.`, platform },
        ],
        estimatedEngagementLift: '2–3× standard post engagement',
        bestFor: niche,
        source: 'template',
      };
    }

    const prompt = `Design a 3-touchpoint engagement loop for a ${niche} creator on ${platform}.

Post topic: "${postTopic}"
Goal: Convert a single post into a 72-hour engagement multiplier

Return JSON with:
- loopId: generate a unique id
- postId: "${postId}"
- touchpoints: array of 3 objects, each with: step, timing, action (what creator does), content (exact copy), psychTrigger
- estimatedEngagementLift: realistic estimate
- communityBuildingOutcome: what this achieves for the creator's community

Make each touchpoint distinctly different. Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000, temperature: 0.85 });
    const parsed = JSON.parse(response || '{}');
    return { ...parsed, postId, niche, platform, generatedAt: new Date().toISOString(), source: 'ai-generated' };
  } catch (error) {
    logger.error('createEngagementLoop error', { error: error.message, userId, postId });
    return { touchpoints: [], postId, source: 'error' };
  }
}

/**
 * Get platform-specific engagement benchmarks for comparison.
 */
function getEngagementBenchmarks(platform) {
  return {
    platform,
    benchmarks: ENGAGEMENT_BENCHMARKS[platform] || ENGAGEMENT_BENCHMARKS.instagram,
    unit: 'engagement rate %',
    note: '2026 industry benchmarks — adjusted for algorithm changes',
  };
}

module.exports = {
  scoreEngagementQuality,
  generateEngagementPrompts,
  identifyTopFans,
  createEngagementLoop,
  getEngagementBenchmarks,
  ENGAGEMENT_BENCHMARKS,
};
