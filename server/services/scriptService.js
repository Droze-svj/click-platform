// Script generation service using AI

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const { buildSystemPrompt, getTopPerformingPlaybook } = require('./marketingKnowledge');
const { personalizePrompt } = require('../utils/applyPersona');

// Every generator returns null when nothing usable was generated (AI not
// configured, over quota, or an unparsable reply). The route turns that into an
// honest "unavailable" instead of saving a canned template as the user's script.

/**
 * Generate YouTube video script with Strategic Upgrades (Phase 11)
 * Includes: 3-Hook A/B Testing, Trend Integration, and Pacing Heatmaps
 */
async function generateYouTubeScript(topic, options = {}) {
  const liveTrendService = require('./liveTrendService');
  const trends = await liveTrendService.getLatestTrends(options.platform || 'tiktok');
  const strategy = await liveTrendService.getTrendStrategy(trends);

  if (!geminiConfigured) {
    logger.warn('Google AI API key not configured — no script generated');
    return null;
  }

  const {
    duration = 10,
    tone = strategy.recommendedTone || 'professional',
    targetAudience = 'general audience',
  } = options;

  try {
    // Bias the prompt toward the creator's proven hook angles + CTA
    // categories when we know who they are. Cold-start users (no userId
    // or no history yet) get pure-playbook generation.
    const topPerformers = options.userId
      ? await getTopPerformingPlaybook(options.userId, targetAudience, options.platform || 'youtube').catch(() => null)
      : null;
    const system = buildSystemPrompt({
      persona: 'script-writer',
      niche: targetAudience,
      platform: options.platform || 'youtube',
      stage: 'script',
      language: options.language || 'en',
      topPerformers,
    });
    const prompt = `${system}

── Grounding rules ──
- Only use claims you can support from the topic statement or the playbook above.
- Do NOT invent statistics, study citations, dollar amounts, dates, brand names, or named experts. If you don't have a real source, state the claim generically ("studies suggest…" is OK only if the playbook says so; specific "Stanford 2023 study found 47%" is NOT OK).
- The "engagementScore" field is a relative estimate based on the framework's proven patterns; it is NOT a real-world view-count prediction.
- Stay neutral on gender / race / age / body type unless the topic explicitly calls for one.

── Task ──
Create a ${duration}-minute YouTube video script about "${topic}".

    Current Trend Strategy: ${strategy.mold} (${strategy.explanation})

    Requirements:
    - Target audience: ${targetAudience}
    - Tone: ${tone}
    - Include 3 distinct "3-Second Hooks" (Visual/Audio combinations) — each MUST come from a different framework in the playbook above (curiosity-gap / pattern-break / before-after / etc.).
    - Provide an "Engagement Score" (1-100) for each hook based on current trends.
    - Break the script into segments with word counts for pacing analysis.
    - Word count: approximately ${duration * 150} words.

    Format the script as JSON:
    {
      "title": "Script title",
      "strategyMold": "${strategy.mold}",
      "hooks": [
        { "hook": "Variant 1 text", "visual": "Visual description", "engagementScore": 85 },
        { "hook": "Variant 2 text", "visual": "Visual description", "engagementScore": 92 },
        { "hook": "Variant 3 text", "visual": "Visual description", "engagementScore": 78 }
      ],
      "segments": [
        { "title": "Intro", "content": "Text...", "duration": 0.5, "words": 75 },
        { "title": "Point 1", "content": "Text...", "duration": 2, "words": 300 }
      ],
      "conclusion": "Conclusion text",
      "callToAction": "CTA text",
      "hashtags": ["#ht1", "#ht2"]
    }`;

    const content = await geminiGenerate(prompt, { temperature: 0.8, maxTokens: 3000 });
    if (!content) {
      // Gemini hit quota / parse / network error and degraded to null. Bail
      // early — the route answers "unavailable" instead of crashing on
      // `null.segments` or saving a template as if it were a script.
      logger.warn('YouTube script: Gemini returned null', { topic });
      return null;
    }
    const script = JSON.parse(content);
    if (!script || !Array.isArray(script.segments) || script.segments.length === 0) {
      logger.warn('YouTube script: AI returned no segments', { topic });
      return null;
    }

    // Calculate Pacing Heatmap
    const pacingHeatmap = script.segments.map(s => {
      const density = s.words / (s.duration * 60); // words per second
      return {
        section: s.title,
        density,
        status: density > 3 ? 'too-dense' : density < 1.5 ? 'too-slow' : 'optimal',
        recommendation: density > 3 ? 'Add B-roll to break up text' : density < 1.5 ? 'Increase energy or add music' : 'Maintain pacing'
      };
    });

    // Combine into full script text
    let fullScript = (script.segments[0]?.content || '') + '\n\n';
    script.segments.slice(1).forEach(s => {
      fullScript += `${s.title}\n${s.content}\n\n`;
    });
    fullScript += script.conclusion;

    return {
      ...script,
      script: fullScript,
      pacingHeatmap,
      wordCount: fullScript.split(/\s+/).length,
      duration
    };
  } catch (error) {
    logger.error('Strategic YouTube script error', { error: error.message, topic });
    return null;
  }
}

/**
 * Generate podcast script
 */
async function generatePodcastScript(topic, options = {}) {
  if (!geminiConfigured) {
    return null;
  }

  const {
    duration = 30,
    tone = 'conversational',
    targetAudience = 'general audience',
    format = 'solo' // solo, interview, panel
  } = options;

  try {
    const prompt = `Create a ${duration}-minute ${format} podcast script about "${topic}".

Requirements:
- Target audience: ${targetAudience}
- Tone: ${tone}
- Format: ${format}
- Include engaging introduction
- Include 5-7 main discussion points
- Include natural conversation flow
- Add transitions and segues
- Include conclusion and call-to-action
- Word count: approximately ${duration * 150} words

Format as JSON with structure similar to YouTube script but adapted for podcast format.`;

    const fullPrompt = `You are an expert podcast scriptwriter.\n\n${prompt}`;
    const content = await geminiGenerate(
      await personalizePrompt(fullPrompt, { userId: options.userId, niche: targetAudience, stage: 'script', role: 'script-writer' }),
      { temperature: 0.7, maxTokens: 3000 }
    );
    if (!content) {
      logger.warn('Podcast script: Gemini returned null', { topic });
      return null;
    }
    const script = JSON.parse(content);
    if (!script || !Array.isArray(script.mainPoints)) {
      logger.warn('Podcast script: AI returned no mainPoints', { topic });
      return null;
    }

    let fullScript = (script.introduction || '') + '\n\n';
    script.mainPoints.forEach((point) => {
      fullScript += `${point.title}\n${point.content}\n\n`;
    });
    fullScript += script.conclusion;
    if (script.callToAction) {
      fullScript += `\n\n${script.callToAction}`;
    }

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length,
      duration
    };
  } catch (error) {
    logger.error('Podcast script generation error', { error: error.message, topic });
    return null;
  }
}

/**
 * Generate social media script
 */
async function generateSocialMediaScript(topic, options = {}) {
  if (!geminiConfigured) {
    return null;
  }

  const {
    platform = 'instagram',
    tone = 'engaging',
    includeHashtags = true
  } = options;

  const platformLimits = {
    instagram: 2200,
    twitter: 280,
    linkedin: 3000,
    facebook: 5000
  };

  const maxLength = platformLimits[platform] || 1000;

  try {
    const prompt = `Create a ${platform} post script about "${topic}".

Requirements:
- Platform: ${platform}
- Tone: ${tone}
- Maximum length: ${maxLength} characters
- ${includeHashtags ? 'Include 5-10 relevant hashtags' : 'No hashtags'}
- Make it engaging and shareable
- Include a call-to-action
- Format as JSON with: title, content, hashtags, callToAction`;

    const socialNiche = options.targetAudience || 'other';
    const socialTopPerformers = options.userId
      ? await getTopPerformingPlaybook(options.userId, socialNiche, platform).catch(() => null)
      : null;
    const system = buildSystemPrompt({
      persona: 'script-writer',
      niche: socialNiche,
      platform,
      stage: 'script',
      language: options.language || 'en',
      topPerformers: socialTopPerformers,
    });
    const fullPrompt = `${system}\n\n── Task ──\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 500 });
    if (!content) {
      logger.warn('Social media script: Gemini returned null', { topic });
      return null;
    }
    const script = JSON.parse(content);
    if (!script) {
      return null;
    }

    let fullScript = script.content || '';
    if (script.callToAction) {
      fullScript += `\n\n${script.callToAction}`;
    }
    if (script.hashtags && script.hashtags.length > 0) {
      fullScript += `\n\n${script.hashtags.join(' ')}`;
    }

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Social media script generation error', { error: error.message, topic });
    return null;
  }
}

/**
 * Generate blog post script/outline
 */
async function generateBlogScript(topic, options = {}) {
  if (!geminiConfigured) {
    return null;
  }

  const {
    wordCount = 1500,
    tone = 'professional',
    includeSEO = true
  } = options;

  try {
    const prompt = `Create a blog post script/outline about "${topic}".

Requirements:
- Word count: approximately ${wordCount} words
- Tone: ${tone}
- ${includeSEO ? 'Include SEO keywords and meta description' : 'No SEO needed'}
- Include introduction, 3-5 main sections, and conclusion
- Make it engaging and informative
- Format as JSON with: title, introduction, sections (array with title and content), conclusion, keywords, metaDescription`;

    const fullPrompt = `You are an expert blog writer and SEO specialist.\n\n${prompt}`;
    // Not the short-form 'script-writer' persona: long-form copy gets the general
    // creative-collaborator voice, carrying the creator's own style.
    const content = await geminiGenerate(
      await personalizePrompt(fullPrompt, { userId: options.userId, niche: options.targetAudience, stage: 'script', role: 'copywriter' }),
      { temperature: 0.7, maxTokens: 2000 }
    );
    if (!content) {
      logger.warn('Blog script: Gemini returned null', { topic });
      return null;
    }
    const script = JSON.parse(content);
    if (!script || !Array.isArray(script.sections)) {
      logger.warn('Blog script: AI returned no sections', { topic });
      return null;
    }

    let fullScript = (script.introduction || '') + '\n\n';
    script.sections.forEach((section) => {
      fullScript += `## ${section.title}\n\n${section.content}\n\n`;
    });
    fullScript += script.conclusion;

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Blog script generation error', { error: error.message, topic });
    return null;
  }
}

/**
 * Generate email script
 */
async function generateEmailScript(topic, options = {}) {
  if (!geminiConfigured) {
    return null;
  }

  const {
    type = 'marketing', // marketing, newsletter, sales, support
    tone = 'professional',
    length = 'medium' // short, medium, long
  } = options;

  const lengthMap = {
    short: 100,
    medium: 300,
    long: 600
  };

  try {
    const prompt = `Create a ${type} email script about "${topic}".

Requirements:
- Type: ${type}
- Tone: ${tone}
- Length: ${length} (approximately ${lengthMap[length]} words)
- Include subject line
- Include engaging opening
- Clear body content
- Include call-to-action
- Format as JSON with: subject, opening, body, callToAction`;

    const fullPrompt = `You are an expert email copywriter.\n\n${prompt}`;
    const content = await geminiGenerate(
      await personalizePrompt(fullPrompt, { userId: options.userId, niche: options.targetAudience, stage: 'script', role: 'copywriter' }),
      { temperature: 0.7, maxTokens: 800 }
    );
    if (!content) {
      logger.warn('Email script: Gemini returned null', { topic });
      return null;
    }
    const script = JSON.parse(content);
    if (!script) {
      return null;
    }

    const fullScript = `${script.subject}\n\n${script.opening}\n\n${script.body}\n\n${script.callToAction}`;

    return {
      ...script,
      script: fullScript,
      wordCount: fullScript.split(/\s+/).length
    };
  } catch (error) {
    logger.error('Email script generation error', { error: error.message, topic });
    return null;
  }
}

module.exports = {
  generateYouTubeScript,
  generatePodcastScript,
  generateSocialMediaScript,
  generateBlogScript,
  generateEmailScript
};







