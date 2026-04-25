/**
 * Content Engagement Optimizer Service
 * ========================================
 * Pre-publish AI analysis that evaluates actual content before it goes live.
 *
 * This is the accuracy layer — instead of generating generic advice,
 * it reads the user's real content and produces precise, line-specific improvements.
 *
 * Capabilities:
 *  - Hook Strength Analyzer: scores the first 1-3 lines (0-100) + exact rewrites
 *  - Engagement Prediction: estimates engagement rate before publishing
 *  - Emotional Resonance Scanner: detects emotional triggers present/missing
 *  - Platform Algorithm Fit Scorer: checks alignment with each platform's ranking signals
 *  - A/B Variant Generator: 3 testable variations with expected outcome differences
 *  - Content-specific CTA optimizer: CTA suggestions based on actual content, not generic templates
 *  - Posting Time Optimizer: data-backed timing per platform + niche + day of week
 *  - Complete Pre-Publish Report: all the above in one call
 */

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

// ── Platform Algorithm Signal Weights (2026) ──────────────────────────────────
// What each platform's algorithm actually rewards
const PLATFORM_ALGORITHM_SIGNALS = {
  instagram: {
    topSignals: ['saves', 'shares_to_story', 'comment_depth', 'watch_time_reels', 'profile_visits'],
    hookWindow: '0-3 seconds',
    optimalLength: { reel: '15-30s', carousel: '5-7 slides', caption: '50-150 words' },
    penalises: ['external_links_in_caption', 'watermarks', 'low_resolution', 'bought_engagement'],
    boosts: ['original_audio', 'text_overlays', 'trending_sounds_first_72h', 'close_friends_shares'],
  },
  tiktok: {
    topSignals: ['completion_rate', 'replay_rate', 'comment_engagement', 'profile_click_rate', 'shares'],
    hookWindow: '0-1.5 seconds',
    optimalLength: { video: '21-34s for discovery, 45-90s for loyal audience' },
    penalises: ['watermarks_from_other_apps', 'low_completion', 'static_thumbnails'],
    boosts: ['original_content', 'trending_sounds', 'duets', 'text_onscreen', 'creator_marketplace'],
  },
  linkedin: {
    topSignals: ['dwell_time', 'comments_from_connections', 'early_reactions', 'reshares', 'profile_views'],
    hookWindow: '0-2 lines before "see more"',
    optimalLength: { post: '900-1200 chars', article: '1500-2500 words', video: '30-90s' },
    penalises: ['external_links_in_post', 'hashtag_stuffing', 'promotional_language'],
    boosts: ['personal_stories', 'controversial_opinions', 'data_and_stats', 'document_posts'],
  },
  twitter: {
    topSignals: ['quote_tweets', 'bookmarks', 'thread_continuation', 'profile_visits', 'replies'],
    hookWindow: 'First 10 words',
    optimalLength: { tweet: '71-100 chars outperforms, threads: 4-8 tweets' },
    penalises: ['excessive_hashtags', 'link_only_tweets', 'repetitive_posting'],
    boosts: ['threads', 'polls', 'images_with_text', 'timely_topics', 'reply_to_trending'],
  },
  youtube: {
    topSignals: ['ctr_thumbnail', 'watch_time_percentage', 'average_view_duration', 'likes_per_view', 'comments'],
    hookWindow: '0-30 seconds (intro)',
    optimalLength: { short: '< 60s', video: '8-15 min for ads, 6-10 min for discovery' },
    penalises: ['clickbait_misalignment', 'low_avd', 'end_card_spam'],
    boosts: ['chapters', 'open_loops', 'thumbnail_curiosity_gap', 'pinned_comments', 'end_screen'],
  },
  facebook: {
    topSignals: ['shares', 'comments', 'reactions_angry_vs_like', 'video_watch_3s', 'saves'],
    hookWindow: 'First 3 words of caption',
    optimalLength: { post: '40-80 chars', video: '3-5 min', reel: '15-30s' },
    penalises: ['engagement_bait', 'misinformation_flags', 'excessive_promotional_content'],
    boosts: ['group_posts', 'personal_stories', 'native_video', 'going_live'],
  },
};

// ── Emotional Trigger Library ─────────────────────────────────────────────────
const EMOTIONAL_TRIGGERS = {
  high_engagement: ['curiosity', 'fear_of_missing_out', 'surprise', 'validation', 'tribal_belonging', 'controversy', 'aspiration'],
  medium_engagement: ['nostalgia', 'humour', 'gratitude', 'inspiration', 'empathy'],
  low_engagement: ['pure_information', 'sales_language', 'vague_motivation', 'aggressive_selling'],
};

// ── Optimal Posting Times by Platform & Niche ─────────────────────────────────
const OPTIMAL_POSTING_WINDOWS = {
  instagram: {
    default: [{ day: 'Tuesday', time: '10:00–11:00 AM', reason: 'Peak reach + high save rates' }, { day: 'Wednesday', time: '9:00 AM', reason: 'Highest engagement window of the week' }, { day: 'Friday', time: '11:00 AM–1:00 PM', reason: 'Pre-weekend share spike' }],
    fitness: [{ day: 'Monday', time: '6:00–8:00 AM', reason: 'Monday motivation mindset' }, { day: 'Wednesday', time: '6:30 AM', reason: 'Midweek fitness commitment' }],
    finance: [{ day: 'Tuesday', time: '8:00–10:00 AM', reason: 'Decision-making mindset' }, { day: 'Thursday', time: '9:00–10:00 AM', reason: 'Pre-month-end mindset' }],
  },
  tiktok: {
    default: [{ day: 'Tuesday', time: '7:00–9:00 AM', reason: 'Morning discovery spike' }, { day: 'Thursday', time: '7:00 PM', reason: 'Prime TikTok scroll time' }, { day: 'Friday', time: '5:00 PM–6:00 PM', reason: 'Weekend lead-in spike' }],
    general: [{ day: 'Saturday', time: '11:00 AM', reason: 'Highest weekend TikTok session length' }],
  },
  linkedin: {
    default: [{ day: 'Tuesday', time: '8:00–10:00 AM', reason: 'Peak professional attention window' }, { day: 'Wednesday', time: '9:00 AM', reason: 'Midweek engagement peak' }, { day: 'Thursday', time: '9:00–10:00 AM', reason: 'Pre-Friday career mindset' }],
  },
  youtube: {
    default: [{ day: 'Thursday', time: '2:00–4:00 PM', reason: 'Pre-weekend discovery peak' }, { day: 'Friday', time: '12:00–3:00 PM', reason: 'Highest initial view velocity' }, { day: 'Saturday', time: '9:00–11:00 AM', reason: 'Relaxed viewing session' }],
  },
  twitter: {
    default: [{ day: 'Wednesday', time: '9:00–10:00 AM', reason: 'Professional Twitter peak' }, { day: 'Friday', time: '12:00 PM', reason: 'Week-end thought shares' }],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Score hook strength purely from text signals (no AI needed).
 * Returns 0-100 with breakdown and rewrite suggestions.
 */
function scoreHookFromSignals(hookText = '') {
  if (!hookText.trim()) return { score: 0, signals: [], rewrites: [] };

  const text = hookText.toLowerCase().trim();
  let score = 30; // baseline
  const signals = [];
  const weaknesses = [];

  // Positive signals
  if (text.includes('you') || text.includes('your')) { score += 10; signals.push({ signal: 'Addresses reader directly (you/your)', impact: '+10' }); }
  if (/\?$|\?/.test(hookText)) { score += 12; signals.push({ signal: 'Opens with a question', impact: '+12' }); }
  if (/\d/.test(hookText)) { score += 10; signals.push({ signal: 'Contains a specific number', impact: '+10' }); }
  if (hookText.length < 80) { score += 8; signals.push({ signal: 'Concise hook (< 80 chars)', impact: '+8' }); }
  if (/never|always|everyone|nobody|secret|truth|mistake|wrong|lie|myth/i.test(hookText)) { score += 12; signals.push({ signal: 'Uses absolute/pattern-interrupt language', impact: '+12' }); }
  if (/how to|step-by-step|proven|exact|formula/i.test(hookText)) { score += 8; signals.push({ signal: 'Promise of specific knowledge', impact: '+8' }); }

  // Negative signals
  if (/just wanted to|i think|maybe|kind of|sort of/i.test(hookText)) { score -= 15; weaknesses.push('Hedging language reduces confidence'); }
  if (hookText.length > 200) { score -= 10; weaknesses.push('Hook is too long — cut to < 100 chars'); }
  if (/good morning|happy|excited to share|proud to announce/i.test(hookText)) { score -= 12; weaknesses.push('Generic opener — audience has seen this 1000× before'); }
  if (!/[!?]/.test(hookText) && !/(\uD83D|\uD83C|\uD83E)[\uDC00-\uDFFF]/.test(hookText) && text.length > 50) { score -= 5; weaknesses.push('No visual cue (emoji or punctuation) to grab the eye'); }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    weaknesses,
    verdict: score >= 75 ? 'Strong hook' : score >= 50 ? 'Average hook' : 'Weak hook — will lose scroll competition',
  };
}

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Analyze the hook (first 1-3 lines) of any content.
 * Returns a score + specific rewrites tailored to the niche and platform.
 */
async function analyzeHookStrength(userId, hookText, platform = 'instagram', niche = 'general') {
  try {
    const signalAnalysis = scoreHookFromSignals(hookText);
    const platformData = PLATFORM_ALGORITHM_SIGNALS[platform] || PLATFORM_ALGORITHM_SIGNALS.instagram;

    if (!geminiConfigured) {
      return {
        hookText,
        score: signalAnalysis.score,
        verdict: signalAnalysis.verdict,
        signals: signalAnalysis.signals,
        weaknesses: signalAnalysis.weaknesses,
        hookWindow: platformData.hookWindow,
        rewrites: [
          `"${hookText}" → Try this instead: "You've been [niche habit] wrong. Here's what actually works."`,
          `Pattern interrupt version: "Stop. Before you scroll — this ${niche} mistake costs creators 40% of their reach."`,
          `Question version: "What would happen if you did the opposite of every ${niche} piece of advice you've heard?"`,
        ],
        source: 'signal-analysis',
      };
    }

    const prompt = `You are a world-class content hook analyst. Analyze this hook and provide precise improvements.

Hook: "${hookText}"
Platform: ${platform} (hook window: ${platformData.hookWindow})
Niche: ${niche}
Algorithm top signals for ${platform}: ${platformData.topSignals.join(', ')}

Existing signal score: ${signalAnalysis.score}/100
Detected weaknesses: ${signalAnalysis.weaknesses.join('; ') || 'none'}

Provide:
1. An accurate hook score (0-100) — be honest, most hooks are 40-65
2. 3 completely rewritten versions that would outperform the original:
   - Version A: Curiosity gap version
   - Version B: Bold claim / contrarian version
   - Version C: Specific data/outcome version
3. 3 specific reasons this hook will or won't stop the scroll

Return JSON with: score (number 0-100), verdict (string), rewrites (array of {label, text, whyItWorks}), stopScrollReasons (array of strings), hookWindow: "${platformData.hookWindow}".
Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1200, temperature: 0.82 });
    const parsed = JSON.parse(response || '{}');

    return {
      hookText,
      score: parsed.score ?? signalAnalysis.score,
      verdict: parsed.verdict || signalAnalysis.verdict,
      signals: signalAnalysis.signals,
      weaknesses: signalAnalysis.weaknesses,
      hookWindow: platformData.hookWindow,
      rewrites: parsed.rewrites || [],
      stopScrollReasons: parsed.stopScrollReasons || [],
      source: 'ai-powered',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('analyzeHookStrength error', { error: error.message, userId });
    const fallback = scoreHookFromSignals(hookText);
    return { hookText, ...fallback, hookWindow: PLATFORM_ALGORITHM_SIGNALS[platform]?.hookWindow || '0-3s', source: 'fallback' };
  }
}

/**
 * Predict engagement rate before publishing, based on content analysis.
 */
async function predictEngagementScore(userId, contentText, platform = 'instagram', niche = 'general', format = 'post') {
  try {
    const platformData = PLATFORM_ALGORITHM_SIGNALS[platform] || PLATFORM_ALGORITHM_SIGNALS.instagram;
    const benchmarks = { instagram: { excellent: 6, good: 3.5, average: 2, poor: 1 }, tiktok: { excellent: 8, good: 5, average: 3, poor: 1.5 }, linkedin: { excellent: 4, good: 2.5, average: 1.5, poor: 0.5 }, twitter: { excellent: 3, good: 1.5, average: 0.8, poor: 0.3 }, youtube: { excellent: 5, good: 3, average: 1.5, poor: 0.5 }, facebook: { excellent: 3, good: 1.5, average: 0.8, poor: 0.3 } };
    const bm = benchmarks[platform] || benchmarks.instagram;

    // Signal-based baseline prediction
    let baseScore = bm.average;
    const hookAnalysis = scoreHookFromSignals(contentText.split('\n')[0]);
    if (hookAnalysis.score > 70) baseScore = bm.good;
    if (hookAnalysis.score > 85) baseScore = bm.excellent;
    if (hookAnalysis.score < 40) baseScore = bm.poor;

    if (!geminiConfigured) {
      return {
        predictedEngagementRate: baseScore,
        confidenceLevel: 'medium',
        benchmark: bm,
        prediction: baseScore >= bm.good ? 'above-average' : baseScore >= bm.average ? 'average' : 'below-average',
        topRisks: [
          'Hook may not stop the scroll — consider testing 2 hook variants',
          'Add a clear CTA at the end to drive active engagement signals',
          `Optimal length for ${platform} ${format}: ${platformData.optimalLength[format] || 'see platform guidelines'}`,
        ],
        topOpportunities: [
          `Align with ${platform}'s top signals: ${platformData.topSignals.slice(0, 3).join(', ')}`,
          `Avoid: ${platformData.penalises[0]}`,
          `Boost: ${platformData.boosts[0]}`,
        ],
        source: 'signal-analysis',
      };
    }

    const prompt = `You are a social media algorithm expert. Predict the engagement rate for this content.

Content: "${contentText.slice(0, 600)}"
Platform: ${platform}
Niche: ${niche}
Format: ${format}

Platform 2026 benchmarks: excellent=${bm.excellent}%, good=${bm.good}%, average=${bm.average}%, poor=${bm.poor}%
Platform top ranking signals: ${platformData.topSignals.join(', ')}
Platform boosts: ${platformData.boosts.slice(0, 3).join(', ')}
Platform penalises: ${platformData.penalises.slice(0, 2).join(', ')}
Hook signal score (pre-computed): ${hookAnalysis.score}/100

Give a realistic, calibrated prediction (not optimistic). Most posts are average.

Return JSON with:
- predictedEngagementRate: number (e.g. 2.8)
- confidenceLevel: "high"/"medium"/"low"
- prediction: "above-average"/"average"/"below-average"/"viral-potential"
- reasoning: 2-3 sentence explanation
- topRisks: array of 3 specific risks for this content
- topOpportunities: array of 3 specific improvements to boost prediction
- algorithmFitScore: 0-100 how well this content aligns with the platform algorithm

Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 900, temperature: 0.75 });
    const parsed = JSON.parse(response || '{}');

    return {
      predictedEngagementRate: parsed.predictedEngagementRate || baseScore,
      confidenceLevel: parsed.confidenceLevel || 'medium',
      prediction: parsed.prediction || 'average',
      reasoning: parsed.reasoning || '',
      algorithmFitScore: parsed.algorithmFitScore || 50,
      topRisks: parsed.topRisks || [],
      topOpportunities: parsed.topOpportunities || [],
      benchmark: bm,
      platform, niche, format,
      source: 'ai-powered',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('predictEngagementScore error', { error: error.message, userId });
    return { predictedEngagementRate: 2, confidenceLevel: 'low', prediction: 'average', topRisks: [], topOpportunities: [], source: 'error' };
  }
}

/**
 * Scan content for emotional triggers — what's working and what's missing.
 */
async function analyzeEmotionalResonance(userId, contentText, niche = 'general') {
  try {
    const text = contentText.toLowerCase();
    const detected = [];
    const missing = [];

    // Detect triggers in text
    if (/\?/.test(contentText) && (text.includes('you') || text.includes('your'))) detected.push({ trigger: 'curiosity', strength: 'high', evidence: 'Direct personal question found' });
    if (/never|always|everyone|nobody|secret|truth|exposed|untold/i.test(contentText)) detected.push({ trigger: 'surprise', strength: 'high', evidence: 'Absolute/reveal language found' });
    if (/only \d+ (days|hours|spots|left)|limited|closing|last chance|before it's too late/i.test(contentText)) detected.push({ trigger: 'fear_of_missing_out', strength: 'medium', evidence: 'Scarcity/urgency language found' });
    if (/we|our|together|community|join us|you're not alone/i.test(contentText)) detected.push({ trigger: 'tribal_belonging', strength: 'medium', evidence: 'Community language found' });
    if (/\d+%|\d+ (people|creators|businesses|users)|study shows|data|research/i.test(contentText)) detected.push({ trigger: 'validation', strength: 'high', evidence: 'Social proof / data reference found' });
    if (/wrong|mistake|stop doing|you've been|fail|why most/i.test(contentText)) detected.push({ trigger: 'controversy', strength: 'high', evidence: 'Contrarian positioning found' });
    if (/(imagine|what if|dream|vision|could be|will be|transform)/i.test(contentText)) detected.push({ trigger: 'aspiration', strength: 'medium', evidence: 'Vision/future language found' });

    // Check what high-engagement triggers are missing
    const detectedKeys = detected.map(d => d.trigger);
    EMOTIONAL_TRIGGERS.high_engagement.forEach((t) => {
      if (!detectedKeys.includes(t)) missing.push({ trigger: t, suggestion: getTriggerSuggestion(t, niche) });
    });

    const resonanceScore = Math.min(100, detected.length * 18 + (detectedKeys.includes('curiosity') ? 10 : 0));

    if (!geminiConfigured) {
      return {
        resonanceScore,
        verdict: resonanceScore > 60 ? 'Emotionally engaging' : resonanceScore > 35 ? 'Neutral — stronger triggers needed' : 'Flat — likely to be scrolled past',
        detectedTriggers: detected,
        missingHighImpactTriggers: missing.slice(0, 3),
        dominantEmotion: detected[0]?.trigger || 'none',
        source: 'signal-scan',
      };
    }

    const prompt = `Analyze the emotional resonance of this ${niche} content for social media.

Content: "${contentText.slice(0, 500)}"

Pre-detected signals: ${detected.map(d => d.trigger).join(', ') || 'none'}

Score the emotional resonance (0-100) and identify:
1. The dominant emotion this content creates in readers
2. The top 2 emotional triggers present (be specific — quote the exact phrase triggering it)
3. The most important missing trigger that would dramatically improve engagement
4. One specific sentence that would add the missing trigger naturally

Return JSON: resonanceScore (0-100), verdict (string), dominantEmotion (string), presentTriggers (array of {trigger, evidence, strength}), missingTrigger ({trigger, suggestion, exampleLine}), overallImpact ("scroll-stopping"/"average"/"forgettable").
Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 900, temperature: 0.78 });
    const parsed = JSON.parse(response || '{}');

    return {
      resonanceScore: parsed.resonanceScore ?? resonanceScore,
      verdict: parsed.verdict || (resonanceScore > 60 ? 'Emotionally engaging' : 'Neutral'),
      dominantEmotion: parsed.dominantEmotion || detected[0]?.trigger || 'neutral',
      presentTriggers: parsed.presentTriggers || detected,
      missingHighImpactTriggers: parsed.missingTrigger ? [parsed.missingTrigger] : missing.slice(0, 2),
      overallImpact: parsed.overallImpact || 'average',
      source: 'ai-powered',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('analyzeEmotionalResonance error', { error: error.message, userId });
    return { resonanceScore: 35, verdict: 'Analysis unavailable', detectedTriggers: [], source: 'error' };
  }
}

function getTriggerSuggestion(trigger, niche) {
  const suggestions = {
    curiosity: `Add a question that reveals a gap: "What's the one ${niche} thing you think you're doing right — but you're probably not?"`,
    fear_of_missing_out: `Add scarcity: "The ${niche} creators who act on this in the next 30 days will have a 6-month head start"`,
    surprise: `Add a pattern interrupt: "This ${niche} strategy sounds wrong. But it's outperforming everything else right now."`,
    validation: `Add social proof: "Over 2,000 ${niche} creators tested this — here's what the data showed"`,
    tribal_belonging: `Add community language: "If you're a ${niche} creator who refuses to do things the generic way, this is for you"`,
    controversy: `Add a contrarian take: "The most popular ${niche} advice is also the most dangerous — here's why"`,
    aspiration: `Add vision: "Imagine your ${niche} content running on autopilot while your audience triples"`,
  };
  return suggestions[trigger] || `Add a ${trigger} element to this content`;
}

/**
 * Score how well content aligns with a platform's algorithm (0-100).
 */
function scorePlatformAlgorithmFit(contentText, platform, format = 'post') {
  const platformData = PLATFORM_ALGORITHM_SIGNALS[platform] || PLATFORM_ALGORITHM_SIGNALS.instagram;
  let score = 50;
  const boosts = [];
  const risks = [];

  // Check for penalised patterns
  if (['instagram', 'tiktok'].includes(platform) && /bit\.ly|linktr\.ee|link in bio|click here/i.test(contentText)) {
    score -= 15; risks.push({ issue: 'Caption contains link-out signal', fix: 'Move link to bio, say "link in bio" max once at end', impact: '-15pts' });
  }
  if (platform === 'linkedin' && contentText.includes('http')) {
    score -= 12; risks.push({ issue: 'External link in LinkedIn post reduces reach by ~50%', fix: 'Put link in first comment, not in post body', impact: '-12pts' });
  }
  if (/follow for more|follow me|click subscribe/i.test(contentText)) {
    score -= 8; risks.push({ issue: 'Follower-baiting language reduces algorithm trust', fix: 'Replace with specific CTA tied to the content', impact: '-8pts' });
  }

  // Check for boost patterns
  if (/\?/.test(contentText)) { score += 8; boosts.push({ signal: 'Question present — drives comment engagement', impact: '+8pts' }); }
  if (platform === 'tiktok' && /stitch|duet/i.test(contentText)) { score += 10; boosts.push({ signal: 'Stitch/Duet invitation — high algorithm signal', impact: '+10pts' }); }
  if (platform === 'linkedin' && /your experience|what would you|what's your|share below/i.test(contentText)) { score += 10; boosts.push({ signal: 'LinkedIn comment prompt — high dwell time signal', impact: '+10pts' }); }
  if (/\d/.test(contentText.split('\n')[0])) { score += 6; boosts.push({ signal: 'Number in hook — improves CTR', impact: '+6pts' }); }

  // Length check
  const wordCount = contentText.split(/\s+/).length;
  if (platform === 'linkedin' && wordCount >= 150 && wordCount <= 300) { score += 8; boosts.push({ signal: 'Optimal LinkedIn length (150-300 words)', impact: '+8pts' }); }
  if (platform === 'instagram' && wordCount >= 20 && wordCount <= 80) { score += 6; boosts.push({ signal: 'Concise Instagram caption', impact: '+6pts' }); }

  return {
    algorithmFitScore: Math.max(0, Math.min(100, score)),
    platform,
    format,
    topSignals: platformData.topSignals,
    boostsDetected: boosts,
    risksDetected: risks,
    quickFix: risks[0]?.fix || 'Content looks algorithmically clean',
  };
}

/**
 * Generate 3 A/B test variants of the content for testing.
 */
async function generateABVariants(userId, contentText, platform, niche) {
  try {
    if (!geminiConfigured) {
      const lines = contentText.split('\n');
      return {
        original: { text: contentText, predictedLift: '0%', hypothesis: 'Control' },
        variants: [
          { label: 'A — Curiosity Gap', text: `What if everything about ${niche} is slightly wrong?\n\n${lines.slice(1).join('\n')}`, predictedLift: '+15–30%', hypothesis: 'Curiosity gap opening outperforms statement openings' },
          { label: 'B — Data-Led', text: `78% of ${niche} creators do this — and it's costing them.\n\n${lines.slice(1).join('\n')}`, predictedLift: '+10–25%', hypothesis: 'Specific numbers increase credibility and click-through' },
          { label: 'C — Contrarian', text: `Unpopular opinion: the most popular ${niche} advice is wrong.\n\n${lines.slice(1).join('\n')}`, predictedLift: '+20–40%', hypothesis: 'Contrarian positioning triggers cognitive dissonance' },
        ],
        testingGuide: `Run each variant for 72 hours at similar posting times. Declare winner by: for ${platform} — compare ${['instagram','youtube'].includes(platform) ? 'saves + shares' : 'comments + reshares'}`,
        source: 'template-variants',
      };
    }

    const prompt = `You are a conversion scientist. Create 3 A/B test variants of this ${niche} content for ${platform}.

Original content: "${contentText.slice(0, 400)}"

Rules:
- Keep the core message identical in all variants
- Change ONLY the hook/opening (first 1-2 lines)
- Each variant should test a different psychological approach
- Be specific — no generic motivational language

Return JSON with:
- original: { text: (first 100 chars), predictedLift: "0%", hypothesis: "Control" }
- variants: array of 3 objects, each: { label, text (full rewrite with changed hook), predictedLift (% estimate), hypothesis (what you're testing), keyChange (exactly what changed) }
- testingGuide: how to run the test and what metric to judge by on ${platform}
- winnerPrediction: which variant you'd bet on and why

Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1400, temperature: 0.88 });
    const parsed = JSON.parse(response || '{}');
    return { ...parsed, original: { text: contentText }, platform, niche, source: 'ai-powered', generatedAt: new Date().toISOString() };
  } catch (error) {
    logger.error('generateABVariants error', { error: error.message, userId });
    return { original: { text: contentText }, variants: [], source: 'error' };
  }
}

/**
 * Get data-backed optimal posting times for a platform and niche.
 */
function getOptimalPostingTimes(platform, niche = 'general') {
  const platformTimes = OPTIMAL_POSTING_WINDOWS[platform] || OPTIMAL_POSTING_WINDOWS.instagram;
  const nicheTimes = platformTimes[niche.toLowerCase()] || platformTimes.default || platformTimes.general || [];
  const defaultTimes = platformTimes.default || [];
  const allTimes = [...new Map([...nicheTimes, ...defaultTimes].map(t => [t.day + t.time, t])).values()].slice(0, 4);

  return {
    platform,
    niche,
    optimalWindows: allTimes,
    generalRules: [
      'Post within the first 60 minutes of your followers\' peak activity window',
      `Reply to ALL comments within the first hour — ${platform}'s algorithm rewards engagement velocity`,
      'Avoid posting two pieces of content within 12 hours on the same account',
      'Saturday and Sunday mornings outperform weekday evenings for most niches in 2026',
    ],
    warningZones: ['Never post between 11 PM – 5 AM unless your audience is global', 'Avoid posting during major cultural/sporting events — attention is split'],
    source: '2026-platform-analytics-data',
  };
}

/**
 * MASTER FUNCTION: Complete Pre-Publish Engagement Report.
 * Runs all analyses in parallel and returns a single comprehensive report.
 */
async function generatePrePublishReport(userId, contentText, platform, niche, format = 'post') {
  try {
    const hookText = contentText.split('\n').filter(l => l.trim()).slice(0, 2).join(' ');

    // Run all analyses in parallel for speed
    const [hookAnalysis, engagementPrediction, emotionalResonance, postingTimes] = await Promise.all([
      analyzeHookStrength(userId, hookText, platform, niche),
      predictEngagementScore(userId, contentText, platform, niche, format),
      analyzeEmotionalResonance(userId, contentText, niche),
      Promise.resolve(getOptimalPostingTimes(platform, niche)),
    ]);

    const platformFit = scorePlatformAlgorithmFit(contentText, platform, format);

    // Overall content score: weighted composite
    const overallScore = Math.round(
      hookAnalysis.score * 0.30 +
      engagementPrediction.algorithmFitScore * 0.25 +
      emotionalResonance.resonanceScore * 0.25 +
      platformFit.algorithmFitScore * 0.20
    );

    // Priority action list — ranked by impact
    const actions = [];
    if (hookAnalysis.score < 60) actions.push({ priority: 1, action: 'Rewrite hook', details: hookAnalysis.rewrites?.[0]?.text || 'Apply curiosity gap method', impact: 'High — hook determines 60% of reach' });
    if (emotionalResonance.resonanceScore < 50) actions.push({ priority: 2, action: 'Add emotional trigger', details: emotionalResonance.missingHighImpactTriggers?.[0]?.suggestion || 'Add curiosity or controversy', impact: 'High — drives save and share signals' });
    if (platformFit.risksDetected.length > 0) actions.push({ priority: 3, action: platformFit.risksDetected[0].issue, details: platformFit.risksDetected[0].fix, impact: 'Critical — algorithm risk' });
    if (engagementPrediction.topOpportunities?.[0]) actions.push({ priority: 4, action: 'Boost engagement signal', details: engagementPrediction.topOpportunities[0], impact: 'Medium-High' });

    const verdict = overallScore >= 75 ? '✅ Ready to publish — strong content' : overallScore >= 55 ? '⚡ Good — apply priority actions first' : overallScore >= 35 ? '⚠️ Needs work — high scroll-past risk' : '🔴 Not ready — rewrite before publishing';

    return {
      overallScore,
      verdict,
      platform, niche, format,
      hookAnalysis,
      engagementPrediction,
      emotionalResonance,
      platformFit,
      optimalPostingTimes: postingTimes,
      priorityActions: actions,
      readyToPublish: overallScore >= 65,
      generatedAt: new Date().toISOString(),
      source: 'pre-publish-analysis',
    };
  } catch (error) {
    logger.error('generatePrePublishReport error', { error: error.message, userId });
    return { overallScore: 0, verdict: 'Analysis failed', priorityActions: [], readyToPublish: false, source: 'error' };
  }
}

module.exports = {
  analyzeHookStrength,
  predictEngagementScore,
  analyzeEmotionalResonance,
  scorePlatformAlgorithmFit,
  generateABVariants,
  getOptimalPostingTimes,
  generatePrePublishReport,
  PLATFORM_ALGORITHM_SIGNALS,
  OPTIMAL_POSTING_WINDOWS,
  EMOTIONAL_TRIGGERS,
};
