// Content Repurposing Service — niche-aware via aiRouter.
// Why router (not direct Gemini): the same post needs platform-tuned
// hooks (TikTok punchy 3s, LinkedIn analytical opener) AND niche-tuned
// voice (finance vs lifestyle). aiRouter + buildSystemPrompt injects
// both, so output stops being a generic platform-format swap.

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');
const logger = require('../utils/logger');

/**
 * Repurpose content for platform
 */
async function repurposeContent(contentId, userId, targetPlatform) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({ _id: contentId, userId }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const platformGuidelines = {
      instagram: {
        maxLength: 2200,
        format: 'Caption with emojis, line breaks, and hashtags',
        style: 'Visual, engaging, hashtag-friendly',
      },
      twitter: {
        maxLength: 280,
        format: 'Concise, punchy, thread if needed',
        style: 'Conversational, timely, hashtag-optimized',
      },
      linkedin: {
        maxLength: 3000,
        format: 'Professional, value-driven, first-person preferred',
        style: 'Thought leadership, industry insights',
      },
      facebook: {
        maxLength: 5000,
        format: 'Storytelling, community-focused',
        style: 'Friendly, engaging, shareable',
      },
    };

    const guidelines = platformGuidelines[targetPlatform] || platformGuidelines.instagram;

    const niche = content.niche || content.metadata?.niche || 'business';
    // Optional creator style profile (best-effort fetch — repurpose works
    // without it for new users with no taste signal yet).
    let styleProfile = null;
    try {
      const UserStyleProfile = require('../models/UserStyleProfile');
      styleProfile = userId ? await UserStyleProfile.findOne({ userId }).lean().catch(() => null) : null;
    } catch { /* model not available in some envs */ }

    const systemPrompt = buildSystemPrompt({
      persona: 'creative-director',
      niche,
      platform: targetPlatform,
      stage: 'repurpose',
      language: content.language || 'en',
      styleProfile,
      extra: `Adapt content for ${targetPlatform}. Return THREE distinct creative variants the creator can choose between — not three near-duplicates. Max ${guidelines.maxLength} chars per body. Strict JSON only.`,
    });
    const userPrompt = [
      `── Task ──`,
      `Repurpose this post for ${targetPlatform} as THREE distinct variants.`,
      `Each variant should pursue a different angle: edgy/contrarian, safe/value-led, data/proof-led.`,
      `Style cue: ${guidelines.style}`,
      `Format cue: ${guidelines.format}`,
      ``,
      `Original:`,
      `Title: ${content.title}`,
      `Body: ${content.body}`,
      ``,
      `Return JSON with this exact shape:`,
      `{`,
      `  "variants": [`,
      `    { "angle": "edgy",  "title": "...", "body": "...", "hashtags": ["..."], "format": "post|carousel|video|thread", "whyThis": "one-line distinct reason", "changes": ["..."] },`,
      `    { "angle": "safe",  ...same fields... },`,
      `    { "angle": "data",  ...same fields... }`,
      `  ]`,
      `}`,
    ].join('\n');

    const result = await aiCallJson(userPrompt, null, {
      systemPrompt,
      taskType: 'content-repurpose-variants',
      maxTokens: 3000,
      temperature: 0.75,
    });
    if (!result || !Array.isArray(result.variants) || result.variants.length === 0) {
      throw new Error('All AI providers failed and no fallback configured for repurpose');
    }

    logger.info('Content repurposed (variants)', {
      contentId, userId, targetPlatform, niche,
      variantCount: result.variants.length,
      hadStyleProfile: !!styleProfile,
    });
    // Back-compat: surface the first variant as the top-level fields so
    // existing callers that expect {title, body, hashtags, format} keep
    // working. New callers read .variants[].
    const primary = result.variants[0];
    return {
      ...primary,
      variants: result.variants,
    };
  } catch (error) {
    logger.error('Repurpose content error', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Batch repurpose for multiple platforms
 */
async function batchRepurposeContent(contentId, userId, platforms) {
  try {
    const results = {};

    for (const platform of platforms) {
      try {
        results[platform] = await repurposeContent(contentId, userId, platform);
      } catch (error) {
        results[platform] = { error: error.message };
        logger.error('Batch repurpose error for platform', {
          platform,
          contentId,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Batch repurpose content error', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Create content variations
 */
async function createContentVariations(contentId, userId, count = 3) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({ _id: contentId, userId }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const prompt = `Create ${count} different variations of this content, each with a unique angle:

Original:
Title: ${content.title}
Body: ${content.body}

For each variation, provide:
1. New title
2. Modified body (different angle/perspective)
3. Key differences from original
4. Best use case

Format as JSON array with fields: title, body, differences (array), useCase`;

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a creative content strategist. Create unique variations that explore different angles.\n\n${prompt}`;
    const variationsText = await geminiGenerate(fullPrompt, { temperature: 0.9, maxTokens: 2000 });

    let variations;
    try {
      variations = JSON.parse(variationsText);
    } catch (error) {
      const jsonMatch = variationsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse variations');
      }
    }

    logger.info('Content variations created', { contentId, userId, count: variations.length });
    return variations;
  } catch (error) {
    logger.error('Create content variations error', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Extract key points for repurposing
 */
async function extractKeyPoints(contentId, userId) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({ _id: contentId, userId }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const prompt = `Extract key points and insights from this content:

${content.title}
${content.body}

Provide:
1. Main message (1-2 sentences)
2. Key points (3-5 bullet points)
3. Actionable takeaways
4. Supporting data/facts (if any)
5. Call-to-action suggestions

Format as JSON object with fields: mainMessage, keyPoints (array), takeaways (array), supportingData (array), ctas (array)`;

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a content analyst. Extract key insights and actionable points.\n\n${prompt}`;
    const extractedText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1000 });

    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch (error) {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse extracted points');
      }
    }

    return extracted;
  } catch (error) {
    logger.error('Extract key points error', { error: error.message, contentId });
    throw error;
  }
}

module.exports = {
  repurposeContent,
  batchRepurposeContent,
  createContentVariations,
  extractKeyPoints,
};






