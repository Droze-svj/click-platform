// Content Repurposing Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const prompt = `Repurpose this content for ${targetPlatform}:

Original content:
Title: ${content.title}
Body: ${content.body}

Platform requirements:
- Max length: ${guidelines.maxLength} characters
- Format: ${guidelines.format}
- Style: ${guidelines.style}

Provide:
1. New title (platform-appropriate)
2. Repurposed body text
3. Suggested hashtags (if applicable)
4. Format recommendations (post, carousel, video, etc.)

Format as JSON object with fields: title, body, hashtags (array), format, changes (array of key modifications)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a content repurposing expert. Adapt content for different platforms while maintaining core message.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const repurposedText = response.choices[0].message.content;
    
    let repurposed;
    try {
      repurposed = JSON.parse(repurposedText);
    } catch (error) {
      const jsonMatch = repurposedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        repurposed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse repurposed content');
      }
    }

    logger.info('Content repurposed', { contentId, userId, targetPlatform });
    return repurposed;
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a creative content strategist. Create unique variations that explore different angles.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9,
      max_tokens: 2000,
    });

    const variationsText = response.choices[0].message.content;
    
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a content analyst. Extract key insights and actionable points.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const extractedText = response.choices[0].message.content;
    
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






