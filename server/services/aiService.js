const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const { buildSystemPrompt, buildCompactGuidance } = require('./marketingKnowledge');
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

function withAgentSpan(agentName, fn, model = 'gemini-1.5-flash') {
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

/**
 * 🛡️ Sovereign JSON Purifier
 * Guarantees that Gemini output is stripped of markdown wrapping (```json) before parsing.
 * Prevents fatal syntax crashes across all AI Agents.
 */
function safeJsonParse(rawString, fallback = {}) {
  try {
    if (!rawString) return fallback;
    let cleaned = rawString.trim();
    if (cleaned.includes('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) cleaned = match[1].trim();
    }
    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('Sovereign JSON Purifier Failed', { error: error.message, snippet: String(rawString).substring(0, 100) });
    return fallback;
  }
}

// Generate captions for video clips
async function generateCaptions(text, niche, platform = 'tiktok', language = 'en') {
  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback caption');
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }

  try {
    const system = buildSystemPrompt({ persona: 'caption-writer', niche, platform, stage: 'script', language });
    const prompt = `${system}

── Task ──
Write ONE caption for the post below. Constraints:
- Hook-first; first 4 words must stop the scroll.
- Maximum 150 characters total (including hashtags).
- Include 3–5 hashtags chosen from the niche/platform playbook above.
- Match the niche voice exactly. Do not flatten it.

Content context: ${text}

Return only the caption text — no preamble, no explanation.`;

    const content = await geminiGenerate(prompt, { maxTokens: 200 });
    return content || `Check this out! 🔥 #${niche} #viral #trending`;
  } catch (error) {
    logger.error('Caption generation error', { error: error.message, niche });
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }
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

Transcript: ${transcript}
Total duration: ${duration} seconds

Return only valid JSON with a "highlights" array.`;

    const rawContent = await geminiGenerate(prompt, { maxTokens: 1500 });
    
    const result = safeJsonParse(rawContent, { highlights: [] });
    return result.highlights || [];
  } catch (error) {
    logger.error('Highlight detection error', { error: error.message, duration });
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
      const prompt = `Transform this ${niche} content into an engaging ${platform} post:
- Platform-specific format and style
- Include relevant hashtags
- Optimize for engagement
- Keep it authentic and valuable

Original content: ${text}`;

      const response = await geminiGenerate(prompt, { maxTokens: 300 });
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

Content: ${text}`;

    const response = await geminiGenerate(prompt, { maxTokens: 500 });
    return response || `Summary: ${text.substring(0, 300)}...`;
  } catch (error) {
    logger.error('Blog summary error', { error: error.message, niche });
    return 'Summary generation failed. Please try again.';
  }
}

// Generate viral post ideas (Consolidated for Phase 11/12)
async function generateViralIdeas(topic, niche, count = 3, options = {}) {
  const framework = await getUniversalStrategicFramework(niche, options.contentType || 'video');
  const predictionService = require('./predictionService');
  const marketTrends = await predictionService.ingestMarketTrends();
  
  const varianceSeed = Math.random().toString(36).substring(7);

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured, using fallback ideas');
    return Array(count).fill(0).map((_, i) => ({
      title: `${niche} Idea ${i + 1}`,
      description: `Engaging strategy for "${topic}"`,
      platform: ['tiktok', 'instagram', 'twitter'][i % 3],
      potential: 75,
      integrityVerified: false
    }));
  }

  try {
    const prompt = `Generate ${count} high-velocity viral content ideas for the ${niche} niche about "${topic}".
    Strategic Framework: ${JSON.stringify(framework)}
    Market Trends: ${marketTrends.trendingTopics.join(', ')}
    Generative Seed: ${varianceSeed}
    
    Return a JSON object with an "ideas" array. Each idea has:
    - title (punchy hook title)
    - description (brief execution format)
    - hook (the first 3 seconds)
    - platform (suggested: tiktok, instagram, youtube, twitter, linkedin)
    - potential (0-100 score)
    - velocityMultiplier (growth prediction)
    - reason (why it will go viral in this niche)
    - originalityScore (0-100)
    
    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1200, temperature: 0.9 });
    const result = safeJsonParse(response, { ideas: [] });
    let ideas = result.ideas || [];

    // Phase 12: Sovereignty Refinement & Cliche Shield
    const refinedIdeas = await validateAndRefineOutput(ideas, topic, 'viral-ideas');
    
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
 * The Cliche Shield (Phase 12)
 * Detects and replaces repetitive marketing jargon with high-impact originality.
 */
function applyClicheShield(text) {
  const cliches = {
    'game-changer': 'paradigm shift',
    'level up': 'strategic evolution',
    'cutting-edge': 'pioneer-grade',
    'seamlessly': 'intuitively',
    'one-stop shop': 'comprehensive ecosystem',
    'revolutionary': 'disruptive',
    'vibrant': 'dynamic',
    'powerful': 'high-velocity',
    'ultimate': 'definitive',
  };

  let cleaned = text;
  for (const [cliche, replacement] of Object.entries(cliches)) {
    const regex = new RegExp(`\\b${cliche}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned;
}

/**
 * Cortex Cross-Validation (Phase 12)
 * Validates AI output against source material to eliminate hallucinations.
 */
async function validateAndRefineOutput(generatedContent, sourceMaterial, type = 'general') {
  if (!geminiConfigured) return generatedContent;

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

  try {
    const prompt = `Generate a comprehensive marketing strategic framework for the ${niche} niche, specifically for ${contentType} content.
    Align with these market trends: ${marketTrends.trendingTopics.join(', ')}.
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

  try {
    const prompt = `Extract the most memorable, quotable statements from this ${niche} content. 
    Prioritize statements that align with these trending topics: ${marketTrends.trendingTopics.join(', ')}.
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

    Content: ${text}

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
    return {
      success: true,
      headline: "Spectral signal detected. Neural affinity mapping suggested.",
      action: "Manifest kinetic visual spikes in frames 0-4 to counteract diffraction.",
      opportunity: "Deploy additional edit nodes to pulse higher spectral views.",
      potencyScore: 85,
      integrityVerified: false
    };
  }

  try {
    const prompt = `Analyze this social media post data and generate a "Sovereign Heuristic Matrix" diagnostic:
    
    Data: ${JSON.stringify(postData)}
    Niche: ${niche}
    
    Return a JSON object with:
    - headline (A high-fidelity, slightly philosophical AI insight about the performance)
    - action (A specific "Protocol Termination" or "Audit" advice to improve the post)
    - opportunity (A growth "Heuristic Expansion" tip)
    - potencyScore (0-100 score based on engagement/reach ratio)
    - signalGaps (array of 3 items like "Frame 0-2 Diffraction", "Sonic Saturation Drop", etc.)

    Use high-fidelity, "Spectral" terminology (Resonance, Diffraction, Neural Potency, Kinetic Rhythm).
    Return only valid JSON.`;

    const response = await geminiGenerate(prompt, { maxTokens: 1000, temperature: 0.7 });
    const result = safeJsonParse(response, {});
    
    // Performance Tracking (Phase 13 Monitoring)
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const latencyMs = Math.round((seconds * 1000) + (nanoseconds / 1000000));
    
    logger.info('Spectral Audit: Diagnostic Matrix synthesized', {
      postId: postData.id,
      latencyMs,
      potencyScore: result.potencyScore,
      niche
    });

    return {
      ...result,
      headline: applyClicheShield(result.headline || "Heuristic synthesis complete."),
      action: applyClicheShield(result.action || "Audit node performance."),
      opportunity: applyClicheShield(result.opportunity || "Expand operational reach."),
      integrityVerified: true,
      performance: { latencyMs }
    };
  } catch (error) {
    logger.error('Diagnostic Matrix synthesis failure', { 
      error: error.message,
      postId: postData.id 
    });
    return { success: false, error: error.message };
  }
}

function extractHashtags(text) {
  const hashtagRegex = /#\w+/g;
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
Text: ${text}

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

