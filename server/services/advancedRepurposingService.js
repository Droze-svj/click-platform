// Advanced Repurposing Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Auto-format content for platform
 */
async function autoFormatContent(contentText, platform, options = {}) {
  try {
    const {
      includeEmojis = true,
      includeHashtags = true,
      lineBreaks = true,
      maxLength = null,
    } = options;

    const platformFormats = {
      instagram: {
        maxLength: 2200,
        emojiDensity: 'high',
        lineBreaks: true,
        hashtagCount: 10,
      },
      twitter: {
        maxLength: 280,
        emojiDensity: 'medium',
        lineBreaks: false,
        hashtagCount: 3,
      },
      linkedin: {
        maxLength: 3000,
        emojiDensity: 'low',
        lineBreaks: true,
        hashtagCount: 5,
      },
      facebook: {
        maxLength: 5000,
        emojiDensity: 'medium',
        lineBreaks: true,
        hashtagCount: 5,
      },
    };

    const format = platformFormats[platform] || platformFormats.instagram;
    const targetLength = maxLength || format.maxLength;

    const prompt = `Auto-format this content for ${platform}:

Content:
${contentText}

Requirements:
- Max length: ${targetLength} characters
- Emoji density: ${format.emojiDensity}
- Line breaks: ${format.lineBreaks ? 'Yes' : 'No'}
- Hashtags: ${format.hashtagCount} hashtags
- Include emojis: ${includeEmojis ? 'Yes' : 'No'}
- Include hashtags: ${includeHashtags ? 'Yes' : 'No'}

Provide formatted content with:
1. Formatted text
2. Character count
3. Formatting changes made
4. Platform-specific optimizations

Format as JSON object with fields: formattedText, characterCount (number), changes (array), optimizations (array)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a content formatting expert. Format content for specific platforms.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const formattedText = response.choices[0].message.content;
    
    let formatted;
    try {
      formatted = JSON.parse(formattedText);
    } catch (error) {
      const jsonMatch = formattedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        formatted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse formatted content');
      }
    }

    logger.info('Content auto-formatted', { platform, length: formatted.characterCount });
    return formatted;
  } catch (error) {
    logger.error('Auto-format content error', { error: error.message, platform });
    throw error;
  }
}

/**
 * Adapt visual content
 */
async function adaptVisualContent(contentId, userId, targetPlatform) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({ _id: contentId, userId }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const platformSpecs = {
      instagram: {
        aspectRatio: '1:1 or 4:5',
        maxSize: '1080x1080',
        format: 'Square or vertical',
        captionLength: 2200,
      },
      twitter: {
        aspectRatio: '16:9',
        maxSize: '1200x675',
        format: 'Horizontal',
        captionLength: 280,
      },
      linkedin: {
        aspectRatio: '1.91:1',
        maxSize: '1200x627',
        format: 'Horizontal',
        captionLength: 3000,
      },
      facebook: {
        aspectRatio: '1.91:1 or 1:1',
        maxSize: '1200x630',
        format: 'Horizontal or square',
        captionLength: 5000,
      },
    };

    const specs = platformSpecs[targetPlatform] || platformSpecs.instagram;

    const prompt = `Adapt this visual content for ${targetPlatform}:

Content:
Title: ${content.title}
Description: ${content.description || content.body}

Platform Requirements:
- Aspect Ratio: ${specs.aspectRatio}
- Max Size: ${specs.maxSize}
- Format: ${specs.format}
- Caption Length: ${specs.captionLength}

Provide:
1. Adapted caption
2. Visual recommendations
3. Aspect ratio adjustments
4. Format suggestions
5. Optimization tips

Format as JSON object with fields: adaptedCaption, visualRecommendations (array), aspectRatioAdjustments (object), formatSuggestions (array), optimizationTips (array)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a visual content adaptation expert. Adapt content for different visual platforms.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const adaptedText = response.choices[0].message.content;
    
    let adapted;
    try {
      adapted = JSON.parse(adaptedText);
    } catch (error) {
      const jsonMatch = adaptedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        adapted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse adapted content');
      }
    }

    logger.info('Visual content adapted', { contentId, targetPlatform });
    return adapted;
  } catch (error) {
    logger.error('Adapt visual content error', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Optimize for SEO
 */
async function optimizeForSEO(contentText, keywords = []) {
  try {
    const prompt = `Optimize this content for SEO:

Content:
${contentText}

Keywords: ${keywords.join(', ') || 'Auto-detect'}

Provide:
1. SEO-optimized version
2. Keyword density analysis
3. Meta description suggestions
4. Title tag suggestions
5. Header structure recommendations
6. Internal linking suggestions
7. SEO score (0-100)

Format as JSON object with fields: optimizedText, keywordDensity (object), metaDescription, titleTag, headerStructure (array), internalLinks (array), seoScore (number)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an SEO expert. Optimize content for search engines.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });

    const optimizedText = response.choices[0].message.content;
    
    let optimized;
    try {
      optimized = JSON.parse(optimizedText);
    } catch (error) {
      const jsonMatch = optimizedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        optimized = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse SEO optimization');
      }
    }

    logger.info('Content optimized for SEO', { keywords: keywords.length, score: optimized.seoScore });
    return optimized;
  } catch (error) {
    logger.error('Optimize for SEO error', { error: error.message });
    throw error;
  }
}

module.exports = {
  autoFormatContent,
  adaptVisualContent,
  optimizeForSEO,
};






