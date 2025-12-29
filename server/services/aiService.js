const OpenAI = require('openai');
const logger = require('../utils/logger');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Generate captions for video clips
async function generateCaptions(text, niche) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback caption');
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }

  try {
    const prompt = `Create an engaging, viral-ready caption for a ${niche} social media post. The caption should be:
- Attention-grabbing and hook-driven
- Include relevant hashtags
- Optimized for TikTok/Instagram Reels
- Maximum 150 characters

Content context: ${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Caption generation error', { error: error.message, niche });
    return `Check this out! 🔥 #${niche} #viral #trending`;
  }
}

// Detect highlights in transcript
async function detectHighlights(transcript, duration) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback highlights');
    // Fallback highlights
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
    const prompt = `Analyze this transcript and identify the most engaging, shareable moments. Return a JSON array of highlights with:
- startTime (in seconds)
- text (the quote or key phrase)
- platform (tiktok, instagram, youtube)
- reason (why this moment is engaging)

Transcript: ${transcript}
Total duration: ${duration} seconds

Return only valid JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.highlights || [];
  } catch (error) {
    logger.error('Highlight detection error', { error: error.message, duration });
    // Fallback: create highlights at regular intervals
    const highlights = [];
    const interval = duration / 5; // 5 highlights
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
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback content');
    const fallback = {};
    platforms.forEach(platform => {
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
      });

      content[platform] = {
        text: response.choices[0].message.content.trim(),
        hashtags: extractHashtags(response.choices[0].message.content),
        platform: platform
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
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback summary');
    return `Summary: ${text.substring(0, 300)}...`;
  }

  try {
    const prompt = `Create a concise, engaging blog summary (200-300 words) for this ${niche} content. Include:
- Key takeaways
- Actionable insights
- Engaging introduction
- Clear conclusion

Content: ${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Blog summary error', { error: error.message, niche });
    return 'Summary generation failed. Please try again.';
  }
}

// Generate viral post ideas
async function generateViralIdeas(topic, niche, count = 5) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback ideas');
    return Array(count).fill(0).map((_, i) => ({
      title: `Viral Idea ${i + 1}`,
      description: `Engaging ${niche} content idea`,
      platform: ['tiktok', 'instagram', 'twitter'][i % 3],
      reason: 'Auto-generated idea'
    }));
  }

  try {
    const prompt = `Generate ${count} viral post ideas for ${niche} content about "${topic}". Each idea should include:
- Catchy title
- Brief description
- Suggested platform
- Why it would go viral

Return as JSON array with fields: title, description, platform, reason`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.ideas || [];
  } catch (error) {
    logger.error('Viral ideas error', { error: error.message, topic, niche });
    return [];
  }
}

// Extract memorable quotes
async function extractQuotes(text, niche) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback quotes');
    // Extract sentences that look like quotes
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 5).map((sentence, i) => ({
      quote: sentence.trim(),
      context: 'Auto-extracted',
      impact: 'Memorable statement'
    }));
  }

  try {
    const prompt = `Extract the most memorable, quotable statements from this ${niche} content. Return a JSON array with:
- quote (the exact text)
- context (brief explanation)
- impact (why it's memorable)

Content: ${text}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.quotes || [];
  } catch (error) {
    logger.error('Quote extraction error', { error: error.message, niche });
    return [];
  }
}

// Generate performance insights
async function generatePerformanceInsights(analyticsData, niche) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback insights');
    return 'Performance analysis requires OpenAI API key. Please configure it to get AI-powered insights.';
  }

  try {
    const prompt = `Analyze this social media performance data and provide insights:
- Best performing content types
- Optimal posting times
- Top niches/topics
- Recommendations for growth

Data: ${JSON.stringify(analyticsData)}
Niche: ${niche}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Performance insights error', { error: error.message, niche });
    return 'Performance analysis unavailable.';
  }
}

function extractHashtags(text) {
  const hashtagRegex = /#\w+/g;
  return text.match(hashtagRegex) || [];
}

/**
 * Generate content adaptation for a platform
 */
async function generateContentAdaptation(data) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback adaptation');
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

${examples.length > 0 ? `Examples of high-performing ${platform} content:\n${examples.map(e => `- ${e.content.substring(0, 100)}... (Engagement: ${e.engagement})`).join('\n')}` : ''}

Return a JSON object with:
- content: adapted text optimized for ${platform}
- hashtags: array of relevant hashtags
- score: optimization score (0-100)
- suggestions: array of improvement suggestions

Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content);
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

/**
 * Generate AI insight for growth
 */
async function generateAIInsight(analysisData) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback insight');
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
${analysisData.topPerforming.map(p => `- ${p.platform}: ${p.engagement} engagement`).join('\n')}

Provide a JSON object with:
- title: short, actionable title
- description: detailed explanation (2-3 sentences)
- action: suggested action button text
- impact: "high", "medium", or "low"

Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content);
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

/**
 * Generate content idea
 */
async function generateContentIdea(platforms) {
  if (!openai) {
    logger.warn('OpenAI API key not configured, using fallback idea');
    return {
      title: 'Content Idea',
      idea: 'Create engaging content that resonates with your audience.'
    };
  }

  try {
    const prompt = `Generate a creative, engaging content idea for these platforms: ${platforms.join(', ')}.

Return a JSON object with:
- title: catchy title for the content
- idea: detailed content idea (2-3 sentences)
- platforms: array of recommended platforms

Return only valid JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300
    });

    const result = JSON.parse(response.choices[0].message.content);
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
      platforms: platforms
    };
  }
}

module.exports = {
  generateCaptions,
  detectHighlights,
  generateSocialContent,
  generateBlogSummary,
  generateViralIdeas,
  extractQuotes,
  generatePerformanceInsights,
  generateContentAdaptation,
  generateAIInsight,
  generateContentIdea
};

