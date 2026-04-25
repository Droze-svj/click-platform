// AI content suggestions service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');
const Content = require('../models/Content');
const User = require('../models/User');

/**
 * Generate daily content ideas based on user niche and history
 */
async function generateDailyContentIdeas(userId, count = 5) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get user's recent content to understand their style
    const recentContent = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title description type');

    const niche = user.niche || 'general';
    const recentTopics = recentContent.map(c => c.title || c.description).join(', ');

    const prompt = `You are a content creation assistant. Generate ${count} creative content ideas for a content creator in the "${niche}" niche.

${recentTopics ? `Recent topics they've covered: ${recentTopics}` : ''}

For each idea, provide:
1. A catchy title
2. A brief description (1-2 sentences)
3. Suggested platforms (Twitter, LinkedIn, Instagram, TikTok, YouTube)
4. Suggested hashtags (3-5)
5. Content type (post, video, carousel, story, etc.)

Format as JSON array with these fields: title, description, platforms (array), hashtags (array), contentType.

Make the ideas fresh, engaging, and tailored to the ${niche} niche.`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate content suggestions');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a creative content strategist. Generate engaging, platform-specific content ideas.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.8, maxTokens: 1500 });
    let ideas = [];

    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ideas = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: parse manually
        ideas = parseIdeasFromText(content);
      }
    } catch (error) {
      logger.error('Error parsing AI response', { error: error.message });
      ideas = parseIdeasFromText(content);
    }

    return ideas.slice(0, count);
  } catch (error) {
    logger.error('Error generating content ideas', { error: error.message, userId });
    // Return fallback ideas
    return generateFallbackIdeas(userId, count);
  }
}

/**
 * Analyze content gaps
 */
async function analyzeContentGaps(userId) {
  try {
    const user = await User.findById(userId);
    const contents = await Content.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const platforms = contents.reduce((acc, c) => {
      if (c.generatedContent?.socialPosts) {
        c.generatedContent.socialPosts.forEach(post => {
          acc[post.platform] = (acc[post.platform] || 0) + 1;
        });
      }
      return acc;
    }, {});

    const gaps = [];
    const allPlatforms = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube'];

    allPlatforms.forEach(platform => {
      if (!platforms[platform] || platforms[platform] < 5) {
        gaps.push({
          platform,
          count: platforms[platform] || 0,
          recommendation: `Create more content for ${platform}`
        });
      }
    });

    return gaps;
  } catch (error) {
    logger.error('Error analyzing content gaps', { error: error.message, userId });
    return [];
  }
}

/**
 * Get trending topics for niche
 */
async function getTrendingTopics(niche) {
  try {
    const prompt = `What are the top 5 trending topics in the "${niche}" niche right now? Provide short, actionable topic ideas that content creators can use. Format as JSON array of strings.`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot get trending topics');
      return [];
    }

    const fullPrompt = `You are a trend analyst. Provide current trending topics.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 500 });
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('Error parsing trending topics', { error: error.message });
    }

    return [];
  } catch (error) {
    logger.error('Error getting trending topics', { error: error.message, niche });
    return [];
  }
}

/**
 * Predict content performance
 */
async function predictContentPerformance(contentText, platform, niche) {
  try {
    const prompt = `Analyze this content for ${platform} and predict its performance:

Content: "${contentText}"
Niche: ${niche}

Provide:
1. Engagement score (1-10)
2. Viral potential (low/medium/high)
3. Key strengths
4. Improvement suggestions

Format as JSON: {engagementScore, viralPotential, strengths (array), suggestions (array)}`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot predict content performance');
      return null;
    }

    const fullPrompt = `You are a social media performance analyst.\n\n${prompt}`;
    const content = await geminiGenerate(fullPrompt, { temperature: 0.5, maxTokens: 500 });
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('Error parsing performance prediction', { error: error.message });
    }

    return {
      engagementScore: 5,
      viralPotential: 'medium',
      strengths: [],
      suggestions: []
    };
  } catch (error) {
    logger.error('Error predicting content performance', { error: error.message });
    return null;
  }
}

// Helper functions
function parseIdeasFromText(text) {
  const ideas = [];
  const lines = text.split('\n').filter(l => l.trim());

  let currentIdea = {};
  for (const line of lines) {
    if (line.match(/^\d+\./)) {
      if (currentIdea.title) {
        ideas.push(currentIdea);
      }
      currentIdea = { title: line.replace(/^\d+\.\s*/, '') };
    } else if (line.toLowerCase().includes('platform')) {
      currentIdea.platforms = extractPlatforms(line);
    } else if (line.toLowerCase().includes('hashtag')) {
      currentIdea.hashtags = extractHashtags(line);
    } else if (currentIdea.title && !currentIdea.description) {
      currentIdea.description = line;
    }
  }
  if (currentIdea.title) {
    ideas.push(currentIdea);
  }

  return ideas;
}

function extractPlatforms(text) {
  const platforms = [];
  const platformNames = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube'];
  platformNames.forEach(platform => {
    if (text.toLowerCase().includes(platform)) {
      platforms.push(platform);
    }
  });
  return platforms.length > 0 ? platforms : ['twitter', 'linkedin'];
}

function extractHashtags(text) {
  const hashtags = [];
  const matches = text.match(/#\w+/g);
  if (matches) {
    hashtags.push(...matches.map(h => h.replace('#', '')));
  }
  return hashtags.length > 0 ? hashtags : [];
}

function generateFallbackIdeas(userId, count) {
  const ideas = [
    {
      title: 'Share a personal story',
      description: 'Connect with your audience through a relatable personal experience',
      platforms: ['twitter', 'linkedin'],
      hashtags: ['story', 'personal', 'connection'],
      contentType: 'post'
    },
    {
      title: 'Quick tip or hack',
      description: 'Share a valuable tip that your audience can implement immediately',
      platforms: ['twitter', 'instagram'],
      hashtags: ['tip', 'hack', 'value'],
      contentType: 'post'
    },
    {
      title: 'Behind the scenes',
      description: 'Show your audience what goes on behind the scenes of your work',
      platforms: ['instagram', 'tiktok'],
      hashtags: ['bts', 'behindthescenes', 'process'],
      contentType: 'video'
    }
  ];

  return ideas.slice(0, count);
}

module.exports = {
  generateDailyContentIdeas,
  analyzeContentGaps,
  getTrendingTopics,
  predictContentPerformance
};







