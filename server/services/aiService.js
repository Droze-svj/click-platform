/* global geminiConfigured */
const googleAI = require('../utils/googleAI');
const geminiGenerate = (prompt, options) => googleAI.generateContent(prompt, options);
Object.defineProperty(global, 'geminiConfigured', {
  get: () => googleAI.isConfigured,
  configurable: true
});
const logger = require('../utils/logger');
const { buildSystemPrompt, buildCompactGuidance, getTopPerformingPlaybook } = require('./marketingKnowledge');
const personalizationService = require('./personalizationService');
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

function withAgentSpan(agentName, fn, model = 'gemini-2.5-flash') {
  return async (...args) => {
    if (!Sentry || typeof Sentry.startSpan !== 'function') {
      return fn(...args);
    }
    return Sentry.startSpan(
      {
        op: 'gen_ai.invoke_agent',
        name: `invoke_agent ${agentName}`,
        attributes: {
          'gen_ai.agent.name': agentName,
          'gen_ai.request.model': model,
          'gen_ai.operation.name': 'invoke_agent',
        },
      },
      () => fn(...args)
    );
  };
}

const { safeJsonParse, applyClicheShield } = require('../utils/aiHelper');
// Bound user-supplied text before it goes into a prompt — prevents the input from
// eating Gemini's token budget and silently truncating the real output, plus a
// light prompt-injection defuse. See utils/promptSafe.
const { capForPrompt } = require('../utils/promptSafe');

// Generate captions for video clips
// `userId` (optional) — when provided, we pull the creator's top-performing
// caption styles + hook angles from their post history and bias the prompt
// toward what's worked. Cold-start users (no history yet) get pure-playbook
// generation; the learning kicks in after ~3 posts have synced analytics.
async function generateCaptions(text, niche, platform = 'tiktok', language = 'en', userId = null) {
  let targetPlatform = platform;
  let targetLanguage = language;
  let targetUserId = userId;

  if (platform && typeof platform === 'object') {
    targetPlatform = platform.platform || 'tiktok';
    targetLanguage = platform.language || 'en';
    targetUserId = platform.userId || null;
  }

  const adaptiveFeedback = require('./UserAdaptiveFeedbackService');
  const goal = targetUserId ? adaptiveFeedback.getStrategicGoal(targetUserId) : 'viral';
  let strategicAim = 'Strategic Aim: Maximize pattern-interrupts';
  if (goal === 'sales') {
    strategicAim = 'Strategic Aim: Prioritize benefit-driven clarity over visual flair.';
  } else if (goal === 'education') {
    strategicAim = 'Strategic Aim: Prioritize clear explanation and structure.';
  }

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback caption');
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }

  try {
    const topPerformers = targetUserId && process.env.NODE_ENV !== 'test'
      ? await getTopPerformingPlaybook(targetUserId, niche, targetPlatform).catch(() => null)
      : null;

    // Pull the user's most recent captions on this platform so the model
    // can be told NOT to echo them. Cold-start users get an empty list.
    const recentCaptions = targetUserId && process.env.NODE_ENV !== 'test'
      ? await fetchRecentCaptions(targetUserId, targetPlatform, 8).catch(() => [])
      : [];

    // Personalized when we know the creator (folds in their learned style +
    // saved voice/brand on top of topPerformers); base prompt otherwise.
    const system = targetUserId
      ? await personalizationService.buildPersonalizedSystemPrompt({ userId: targetUserId, niche, platform: targetPlatform, role: 'caption-writer', stage: 'script', language: targetLanguage })
      : buildSystemPrompt({ persona: 'caption-writer', niche, platform: targetPlatform, stage: 'script', language: targetLanguage, topPerformers });
    const dedupeBlock = recentCaptions.length > 0
      ? `\n── Do not repeat these recent captions ──\n${recentCaptions.map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join('\n')}\nWrite something with a meaningfully different hook, angle, or sentence structure than ALL of the above.\n`
      : '';

    const prompt = `${system}

── Strategic Aim ──
${strategicAim}

── Grounding rules ──
- Only reference content described in "Content context" below. Do not invent statistics, dates, prices, brand names, study citations, or numerical claims (views, follower counts, percentages).
- If the content context doesn't provide a fact, leave it out — don't guess.
- Stay neutral on gender/race/age/body unless the content context explicitly calls for one.
${dedupeBlock}
── Task ──
Write ONE caption for the post below. Constraints:
- Hook-first; first 4 words must stop the scroll.
- Maximum 150 characters total (including hashtags).
- Include 3–5 hashtags chosen from the niche/platform playbook above.
- Match the niche voice exactly. Do not flatten it.

Content context: ${capForPrompt(text)}

Return only the caption text — no preamble, no explanation.`;

    const content = await geminiGenerate(prompt, { maxTokens: 1200 });
    const caption = content || `Check this out! 🔥 #${niche} #viral #trending`;

    // Post-generation dedupe — if the model still echoes a recent caption
    // (Jaccard similarity > 0.7 on word sets), re-roll once with a
    // stronger "say something different" nudge. Single retry; we don't
    // want to spend tokens forever chasing perfect novelty.
    if (recentCaptions.length > 0 && isTooSimilar(caption, recentCaptions, 0.7)) {
      logger.info('Caption too similar to recent; re-rolling once', { niche, platform });
      const retryPrompt = `${prompt}\n\nThe first attempt was too similar to caption #${1 + recentCaptions.findIndex((c) => isTooSimilar(caption, [c], 0.7))}. Rewrite with a completely different opening verb and a different angle from the playbook.`;
      const retry = await geminiGenerate(retryPrompt, { maxTokens: 1200 }).catch(() => null);
      if (retry && !isTooSimilar(retry, recentCaptions, 0.7)) return retry;
    }
    return caption;
  } catch (error) {
    logger.error('Caption generation error', { error: error.message, niche });
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }
}

/**
 * Fetch the last N captions this user posted on a platform. Used to
 * suppress repetition when generating the next one. Returns plain strings.
 */
async function fetchRecentCaptions(userId, platform, limit = 8) {
  try {
    const ScheduledPost = require('../models/ScheduledPost');
    const rows = await ScheduledPost.find({
      userId,
      platform,
      $or: [
        { status: 'posted' },
        { status: 'published' },
        { status: 'publishing' },
      ],
    })
      .sort({ postedAt: -1, scheduledTime: -1, createdAt: -1 })
      .limit(limit)
      .select('content.text')
      .lean();
    return rows.map((r) => r?.content?.text).filter((t) => typeof t === 'string' && t.trim().length > 0);
  } catch (err) {
    // Mongo ObjectId cast errors are expected for Supabase UUID userIds —
    // just return empty so the dedupe path no-ops for those users.
    return [];
  }
}

/**
 * Jaccard similarity on lowercased word sets. Threshold-based dedupe is
 * good enough for catching obvious re-rolls of the same caption without
 * blocking legitimately similar variants (e.g. the same hook with
 * different hashtags).
 */
function isTooSimilar(candidate, others, threshold = 0.7) {
  const norm = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean));
  const a = norm(candidate);
  if (a.size === 0) return false;
  for (const other of others) {
    const b = norm(other);
    if (b.size === 0) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter += 1;
    const union = a.size + b.size - inter;
    const jaccard = union === 0 ? 0 : inter / union;
    if (jaccard >= threshold) return true;
  }
  return false;
}

// Detect highlights in transcript
async function detectHighlights(transcript, duration) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback highlights');
    const highlights = [];
    const interval = duration / 5;
    for (let i = 0; i < 5; i++) {
      highlights.push({
        startTime: i * interval,
        text: transcript.substring(i * 100, (i + 1) * 100) || 'Engaging moment',
        platform: 'tiktok',
        reason: 'Auto-detected highlight'
      });
    }
    return highlights;
  }

  try {
    const guidance = buildCompactGuidance({ niche: 'other', platform: 'tiktok', stage: 'edit' });
    const prompt = `${guidance}

Analyze this transcript and identify the most engaging, shareable moments per the retention rules above. Return a JSON object with a "highlights" array. Each highlight has:
- startTime (number, seconds)
- text (the quote or key phrase — verbatim from transcript)
- platform (tiktok, instagram, or youtube)
- reason (which retention principle from above makes it work — be specific)

Transcript: ${capForPrompt(transcript)}
Total duration: ${duration} seconds

Return only valid JSON with a "highlights" array.`;

    const rawContent = await geminiGenerate(prompt, { maxTokens: 1500 });

    const result = safeJsonParse(rawContent, { highlights: [] });
    if (result.highlights && result.highlights.length > 0) return result.highlights;
    return buildFallbackHighlights(transcript, duration);
  } catch (error) {
    logger.error('Highlight detection error', { error: error.message, duration });
    return buildFallbackHighlights(transcript, duration);
  }
}

function buildFallbackHighlights(transcript, duration) {
  const highlights = [];
  const interval = duration / 5;
  for (let i = 0; i < 5; i++) {
    highlights.push({
      startTime: i * interval,
      text: transcript.substring(i * 100, (i + 1) * 100) || 'Engaging moment',
      platform: 'tiktok',
      reason: 'Auto-detected highlight'
    });
  }
  return highlights;
}

// Generate social media content from text
async function generateSocialContent(text, niche, platforms = ['twitter', 'linkedin', 'instagram']) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback content');
    const fallback = {};
    platforms.forEach((platform) => {
      fallback[platform] = {
        text: `Check out this ${niche} content! ${text.substring(0, 100)}...`,
        hashtags: [`#${niche}`, '#content', '#social'],
        platform
      };
    });
    return fallback;
  }

  try {
    const content = {};

    for (const platform of platforms) {
      const prompt = `You are a social media growth engineer. 
Transform this ${niche} content into a HIGH-CONVERSION ${platform} post.

CREATIVE RULES:
- Use a platform-native opening that stops the scroll.
- Do NOT be generic. Use a unique angle from the content.
- Include a specific call-to-value (not just "like this").
- Match the ${niche} expertise level.

Original content: ${capForPrompt(text)}`;

      const response = await geminiGenerate(prompt, { temperature: 0.9, maxTokens: 400 });
      content[platform] = {
        text: response || `Check out this ${niche} content!`,
        hashtags: extractHashtags(response || ''),
        platform
      };
    }

    return content;
  } catch (error) {
    logger.error('Social content generation error', { error: error.message, niche, platforms });
    return {};
  }
}

// Generate blog summary
async function generateBlogSummary(text, niche) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback summary');
    return `Summary: ${text.substring(0, 300)}...`;
  }

  try {
    const prompt = `Create a concise, engaging blog summary (200-300 words) for this ${niche} content. Include:
- Key takeaways
- Actionable insights
- Engaging introduction
- Clear conclusion

Content: ${capForPrompt(text)}`;

    const response = await geminiGenerate(prompt, { maxTokens: 500 });
    return response || `Summary: ${text.substring(0, 300)}...`;
  } catch (error) {
    logger.error('Blog summary error', { error: error.message, niche });
    return 'Summary generation failed. Please try again.';
  }
}

// Generate viral post ideas (Consolidated for Phase 11/12)
async function generateViralIdeas(topic, niche, count = 3, options = {}) {
  // Bound + sanitize the caller-supplied topic before it goes into the prompt
  // (was interpolated raw — unbounded text starves the token budget and a
  // crafted topic could inject instructions). capForPrompt strips control chars
  // and defuses "ignore previous instructions"-style overrides.
  const safeTopic = capForPrompt(String(topic == null ? '' : topic), 500);
  const framework = await getUniversalStrategicFramework(niche, options.contentType || 'video');
  const predictionService = require('./predictionService');
  const marketTrends = await predictionService.ingestMarketTrends();

  const varianceSeed = Math.random().toString(36).substring(7);

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback ideas');
    return Array(count).fill(0).map((_, i) => ({
      title: `${niche} Idea ${i + 1}`,
      description: `Engaging strategy for "${safeTopic}"`,
      platform: ['tiktok', 'instagram', 'twitter'][i % 3],
      potential: 75,
      integrityVerified: false
    }));
  }

  const trendingTopicsList = marketTrends.trendingTopics || (Array.isArray(marketTrends) ? marketTrends.map(t => t.topic || t) : []);
  try {
    const prompt = `Generate ${count} viral content ideas for the ${niche} niche about "${safeTopic}".
    Strategic Framework: ${JSON.stringify(framework)}
    Market Trends: ${trendingTopicsList.join(', ')}
    Generative Seed: ${varianceSeed}

    Grounding rules:
    - Do NOT invent statistics, study citations, dollar figures, dates, brand names, or named experts. If the topic doesn't supply a fact, leave it out.
    - "potential" is a RELATIVE score (0-100) derived from how strongly the idea matches the framework's proven patterns — it is NOT a real-world view-count prediction.
    - "velocityMultiplier" is a RELATIVE growth-rate estimate, not a guarantee.
    - Stay neutral on gender / race / age / body type unless the topic explicitly calls for one.
    - All ${count} ideas must be meaningfully distinct from each other (different hook angle AND different format) — no near-duplicates.

    Return a JSON object with an "ideas" array. Each idea has:
    - title (punchy hook title)
    - description (brief execution format)
    - hook (the first 3 seconds)
    - platform (suggested: tiktok, instagram, youtube, twitter, linkedin)
    - potential (relative 0-100 score per the rules above)
    - velocityMultiplier (relative growth estimate, not a guarantee)
    - reason (why it matches the framework — be specific about WHICH pattern)
    - originalityScore (0-100)

    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1200, temperature: 0.9 });
    const result = safeJsonParse(response, { ideas: [] });
    let ideas = result.ideas || [];

    // Phase 12: Sovereignty Refinement & Cliche Shield
    const refinedIdeas = await validateAndRefineOutput(ideas, safeTopic, 'viral-ideas');
    
    return refinedIdeas.map(id => ({
      ...id,
      title: applyClicheShield(id.title),
      description: applyClicheShield(id.description),
      integrityVerified: true
    }));
  } catch (error) {
    logger.error('Idea generation error', { error: error.message, niche, topic });
    return [];
  }
}

/**
 * Cortex Cross-Validation (Phase 12)
 * Validates AI output against source material to eliminate hallucinations.
 */
async function validateAndRefineOutput(generatedContent, sourceMaterial, type = 'general') {
  if (process.env.NODE_ENV === 'test' || !geminiConfigured) return generatedContent;

  try {
    const prompt = `System: You are the Sovereignty Engine (Integrity Agent).
    Task: Review this generated ${type} and cross-validate it against the source material.
    
    Rules:
    1. Eliminate hallucinations (facts not present in source).
    2. Remove repetitive or circular logic.
    3. Maximize originality by replacing generic phrasing.
    4. Ensure zero repetition with previous sections.

    Source Material: ${sourceMaterial.substring(0, 2000)}
    Generated Content: ${JSON.stringify(generatedContent)}

    Return a refined JSON object of the same structure. Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000, temperature: 0.1 }); // Low temp for validation
    return safeJsonParse(response, generatedContent);
  } catch (error) {
    logger.error('Cross-Validation Error', { error: error.message });
    return generatedContent;
  }
}

/**
 * Omni-Niche Strategic Framework Engine (Phase 11)
 * Generates bespoke marketing strategies for any niche and content type.
 */
async function getUniversalStrategicFramework(niche, contentType = 'video') {
  const predictionService = require('./predictionService');
  const marketTrends = await predictionService.ingestMarketTrends();
  
  const varianceSeed = Math.random().toString(36).substring(7); // Phase 12 High-Variance Seed
  
  if (!geminiConfigured) {
    return {
      hookPacing: 'Fast-paced, high energy',
      triggers: ['FOMO', 'Value'],
      visualGrammar: 'Split-screens, captions',
      marketAlignment: 'Baseline'
    };
  }

  const trendingTopicsList = marketTrends.trendingTopics || (Array.isArray(marketTrends) ? marketTrends.map(t => t.topic || t) : []);
  try {
    const prompt = `Generate a comprehensive marketing strategic framework for the ${niche} niche, specifically for ${contentType} content.
    Align with these market trends: ${trendingTopicsList.join(', ')}.
    Generative Seed: ${varianceSeed}
    
    Return a JSON object with:
    - hookPacing (millisecond-precise cut advice)
    - psychologicalTriggers (Top 3 triggers for this niche)
    - visualGrammar (specific aesthetic/editing rules)
    - narrativeArc (how to structure the story)
    - verticalInsight (a deeply specific, non-generic expert secret for this niche)
    
    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 800, temperature: 0.9 });
    const framework = safeJsonParse(response, {});
    
    // Apply Cliche Shield to framework insights
    if (framework.verticalInsight) framework.verticalInsight = applyClicheShield(framework.verticalInsight);
    
    return framework;
  } catch (error) {
    logger.error('Strategic Framework Error', { error: error.message, niche });
    return {};
  }
}

// Extract memorable quotes with Strategic weighting (Phase 10/11/12)
async function extractQuotes(text, niche, options = {}) {
  const framework = await getUniversalStrategicFramework(niche, options.contentType || 'video');
  const predictionService = require('./predictionService');
  const marketTrends = await predictionService.ingestMarketTrends();
  
  const varianceSeed = Math.random().toString(36).substring(7);

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback quotes');
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 5).map((sentence) => ({
      quote: sentence.trim(),
      context: 'Auto-extracted',
      impact: 'Memorable statement',
      strategicWeight: 50,
      originalityScore: 60,
      integrityVerified: false
    }));
  }

  const trendingTopicsList = marketTrends.trendingTopics || (Array.isArray(marketTrends) ? marketTrends.map(t => t.topic || t) : []);
  try {
    const prompt = `Extract the most memorable, quotable statements from this ${niche} content. 
    Prioritize statements that align with these trending topics: ${trendingTopicsList.join(', ')}.
    Apply these niche strategic rules: ${JSON.stringify(framework)}.
    Generative Seed: ${varianceSeed}
    
    Return a JSON object with a "quotes" array. Each quote has:
    - quote (the exact text)
    - context (brief explanation)
    - impact (why it's memorable)
    - strategicWeight (0-100 score based on ${niche} market interest)
    - animationSuggested (shake-accent, scale-in, fade-glow, or null)
    - nicheRelevance (why this matters for ${niche} creators)
    - originalityScore (0-100 based on uniqueness of the statement)

    Content: ${capForPrompt(text)}

    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 800, temperature: 0.8 });
    let result = safeJsonParse(response, { quotes: [] });
    let quotes = result.quotes || [];

    // Phase 12: Sovereignty Refinement & Cliche Shield
    const refinedQuotes = await validateAndRefineOutput(quotes, text, 'quotes');
    
    return refinedQuotes.map(q => ({
      ...q,
      quote: applyClicheShield(q.quote),
      integrityVerified: true
    }));
  } catch (error) {
    logger.error('Quote extraction error', { error: error.message, niche });
    return [];
  }
}


// Generate performance insights
async function generatePerformanceInsights(analyticsData, niche) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback insights');
    return 'Performance analysis requires Google AI API key. Please configure GOOGLE_AI_API_KEY.';
  }

  try {
    const prompt = `Analyze this social media performance data and provide insights:
- Best performing content types
- Optimal posting times
- Top niches/topics
- Recommendations for growth

Data: ${JSON.stringify(analyticsData)}
Niche: ${niche}`;

    const response = await geminiGenerate(prompt, { maxTokens: 600 });
    return response || 'Performance analysis unavailable.';
  } catch (error) {
    logger.error('Performance insights error', { error: error.message, niche });
    return 'Performance analysis unavailable.';
  }
}

/**
 * Generate high-fidelity Diagnostic Matrix for a post (Phase 13)
 * Provides heuristic logic, signal analysis, and protocol advice.
 */
async function generateDiagnosticMatrix(postData, niche = 'general') {
  const startTime = process.hrtime();

  if (!geminiConfigured) {
    // Honest degraded response — `integrityVerified: false` lets the UI
    // suppress or label this as "AI offline" instead of presenting it as
    // a real diagnostic. Plain language only: the previous fallback
    // ("Spectral signal detected", "Manifest kinetic visual spikes")
    // looked like real insight when it was actually a hardcoded mock.
    return {
      success: true,
      headline: 'Performance diagnostic unavailable — AI engine offline.',
      action: 'Reconnect or retry in a moment.',
      opportunity: 'Once the engine is back online, re-run the diagnostic for real insight.',
      potencyScore: null,
      signalGaps: [],
      integrityVerified: false,
    };
  }

  try {
    const prompt = `Analyze this social media post's performance and return a diagnostic in plain English.

    Data: ${JSON.stringify(postData)}
    Niche: ${niche}

    Grounding rules:
    - Only describe what the data actually shows. Do not invent numbers, retention curves, or audience demographics that aren't in the data.
    - Use plain language. Avoid pseudoscientific jargon ("spectral", "diffraction", "neural potency", "kinetic rhythm"). Say what literally happened ("retention dropped at the 8-second mark", not "Sonic Saturation Drop").
    - If the data is insufficient for a confident diagnosis (e.g. <100 views or <1 hour old), say so in the headline and leave signalGaps empty.

    Return a JSON object with:
    - headline (one-sentence summary of how the post performed, grounded in the data)
    - action (one specific change the creator could make next time)
    - opportunity (one growth angle suggested by the data)
    - potencyScore (0-100, an engagement-to-reach quality score)
    - signalGaps (array of specific moments where performance dropped — e.g. ["Retention dropped sharply between 0:08 and 0:12", "CTR on caption was below niche median"]. Empty array if data is too thin to identify gaps.)

    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000, temperature: 0.5 });
    const result = safeJsonParse(response, {});

    const [seconds, nanoseconds] = process.hrtime(startTime);
    const latencyMs = Math.round((seconds * 1000) + (nanoseconds / 1000000));

    logger.info('Diagnostic Matrix synthesized', {
      postId: postData.id,
      latencyMs,
      potencyScore: result.potencyScore,
      niche,
    });

    return {
      ...result,
      headline: applyClicheShield(result.headline || 'Diagnostic complete.'),
      action: applyClicheShield(result.action || 'Review the post performance against the niche playbook.'),
      opportunity: applyClicheShield(result.opportunity || 'Look for patterns across your top-performing posts.'),
      integrityVerified: true,
      performance: { latencyMs },
    };
  } catch (error) {
    logger.error('Diagnostic Matrix synthesis failure', {
      error: error.message,
      postId: postData.id,
    });
    return { success: false, error: error.message, integrityVerified: false };
  }
}

function extractHashtags(text) {
  const hashtagRegex = /#[\p{L}\p{N}_]+/gu;
  return text.match(hashtagRegex) || [];
}

// Generate content adaptation for a platform
async function generateContentAdaptation(data) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback adaptation');
    return {
      content: data.text,
      hashtags: extractHashtags(data.text),
      score: 70,
      suggestions: ['Consider adding platform-specific formatting']
    };
  }

  try {
    const { text, title, platform, rules, examples } = data;

    const prompt = `Adapt this content for ${platform}:

Original Content:
Title: ${title}
Text: ${capForPrompt(text)}

Platform Rules:
- Max length: ${rules.maxLength} characters
- Hashtags: ${rules.hashtags} recommended
- Style: ${rules.professional ? 'Professional' : 'Casual'}
${rules.visual ? '- Visual-focused content' : ''}
${rules.trending ? '- Use trending topics' : ''}

${examples.length > 0 ? `Examples of high-performing ${platform} content:\n${examples.map((e) => `- ${e.content.substring(0, 100)}... (Engagement: ${e.engagement})`).join('\n')}` : ''}

Return a JSON object with: content, hashtags (array), score (0-100), suggestions (array). Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000 });
    const result = safeJsonParse(response, {});
    return {
      content: result.content || text,
      hashtags: result.hashtags || extractHashtags(text),
      score: result.score || 85,
      suggestions: result.suggestions || []
    };
  } catch (error) {
    logger.error('Content adaptation error', { error: error.message, platform: data.platform });
    return {
      content: data.text,
      hashtags: extractHashtags(data.text),
      score: 70,
      suggestions: ['Consider adding platform-specific formatting']
    };
  }
}

// Generate AI insight for growth
async function generateAIInsight(analysisData) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback insight');
    return {
      title: 'Growth Recommendation',
      description: 'Analyze your content performance to identify growth opportunities.',
      action: 'View Analytics',
      impact: 'medium'
    };
  }

  try {
    const prompt = `Analyze this social media performance data and provide ONE key growth insight:

Metrics:
- Engagement change: ${analysisData.metrics.engagement.change.toFixed(1)}%
- Engagement rate: ${analysisData.metrics.engagementRate.current.toFixed(2)}%
- Post count: ${analysisData.postCount}
- Content count: ${analysisData.contentCount}

Top Performing Posts:
${analysisData.topPerforming.map((p) => `- ${p.platform}: ${p.engagement} engagement`).join('\n')}

Return a JSON object with: title, description, action, impact ("high", "medium", or "low"). Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 300 });
    const result = safeJsonParse(response, {});
    return {
      title: result.title || 'Growth Recommendation',
      description: result.description || 'Analyze your content performance.',
      action: result.action || 'View Analytics',
      impact: result.impact || 'medium'
    };
  } catch (error) {
    logger.error('AI insight generation error', { error: error.message });
    return {
      title: 'Growth Recommendation',
      description: 'Analyze your content performance to identify growth opportunities.',
      action: 'View Analytics',
      impact: 'medium'
    };
  }
}

// Generate content idea
async function generateContentIdea(platforms) {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback idea');
    return {
      title: 'Content Idea',
      idea: 'Create engaging content that resonates with your audience.',
      platforms
    };
  }

  try {
    const prompt = `Generate a creative, engaging content idea for these platforms: ${platforms.join(', ')}.

Return a JSON object with: title, idea, platforms (array). Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 300 });
    const result = safeJsonParse(response, {});
    return {
      title: result.title || 'Content Idea',
      idea: result.idea || 'Create engaging content.',
      platforms: result.platforms || platforms
    };
  } catch (error) {
    logger.error('Content idea generation error', { error: error.message });
    return {
      title: 'Content Idea',
      idea: 'Create engaging content that resonates with your audience.',
      platforms
    };
  }
}

/**
 * Analyze content health with AI
 */
async function analyzeContentWithAI(content, posts, metadata) {
  if (!geminiConfigured) {
    return {
      summary: 'AI analysis unavailable. Please configure Google AI API key.',
      topInsights: [],
      recommendations: []
    };
  }

  try {
    const prompt = `Analyze this content and performance data to provide health insights:

Content Count: ${content.length}
Posts Count: ${posts.length}
Current Scores: ${JSON.stringify(metadata.scores)}
Gaps Identified: ${JSON.stringify(metadata.gaps)}

Provide a summary of content health, top 3 insights, and 3 actionable recommendations.
Format as JSON: { summary, topInsights (array), recommendations (array) }`;

    const response = await geminiGenerate(prompt, { maxTokens: 800 });
    const result = safeJsonParse(response, {});
    return {
      summary: result.summary || 'Content health looks stable but has room for improvement.',
      topInsights: result.topInsights || [],
      recommendations: result.recommendations || []
    };
  } catch (error) {
    logger.error('AI content health analysis error', { error: error.message });
    return {
      summary: 'Error generating AI insights.',
      topInsights: [],
      recommendations: []
    };
  }
}

/**
 * Predict performance of a content asset
 * @param {string} userId User ID
 * @param {Object} asset Asset data
 * @returns {Promise<Object>} Prediction results
 */
async function predictPerformance(userId, asset) {
  try {
    const predictionService = require('./predictionService');
    // Adapt asset object to what predictionService expects
    const prediction = await predictionService.predictContentPerformance(null, {
      userId,
      title: asset.title || 'Untitled',
      description: asset.content || '',
      type: asset.type || 'video',
      platform: asset.platform,
      tags: asset.hashtags || []
    });

    return {
      engagement: prediction.estimatedEngagement?.expected || 0,
      reach: prediction.estimatedReach?.expected || 0,
      score: prediction.performanceScore || 0,
      recommendations: prediction.recommendations?.map(r => r.message) || []
    };
  } catch (error) {
    logger.warn('Performance prediction failed, using fallback', { error: error.message });
    return { engagement: 50, reach: 500, score: 70, recommendations: [] };
  }
}

module.exports = {
  generateCaptions: withAgentSpan('Caption Agent', generateCaptions),
  detectHighlights: withAgentSpan('Highlight Agent', detectHighlights),
  generateSocialContent: withAgentSpan('Social Content Agent', generateSocialContent),
  generateBlogSummary: withAgentSpan('Blog Summary Agent', generateBlogSummary),
  generateViralIdeas: withAgentSpan('Viral Ideas Agent', generateViralIdeas),
  extractQuotes: withAgentSpan('Quote Extraction Agent', extractQuotes),
  generatePerformanceInsights: withAgentSpan('Performance Insights Agent', generatePerformanceInsights),
  generateContentAdaptation: withAgentSpan('Content Adaptation Agent', generateContentAdaptation),
  generateAIInsight: withAgentSpan('Growth Insight Agent', generateAIInsight),
  generateContentIdea: withAgentSpan('Content Idea Agent', generateContentIdea),
  analyzeContentWithAI: withAgentSpan('Content Health Agent', analyzeContentWithAI),
  getUniversalStrategicFramework: withAgentSpan('Strategic Framework Agent', getUniversalStrategicFramework),
  validateAndRefineOutput: withAgentSpan('Validation Agent', validateAndRefineOutput),
  generateDiagnosticMatrix: withAgentSpan('Diagnostic Matrix Agent', generateDiagnosticMatrix),
  predictPerformance: withAgentSpan('Performance Prediction Agent', predictPerformance)
};

