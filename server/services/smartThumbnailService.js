// Smart Thumbnail Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate smart thumbnail suggestions
 */
async function generateThumbnailSuggestions(videoId, videoMetadata) {
  try {
    const {
      duration,
      scenes = [],
      transcript = null,
      title = null,
    } = videoMetadata;

    const prompt = `Suggest optimal thumbnail moments for this video:

Duration: ${duration} seconds
Scenes: ${scenes.length} detected
Title: ${title || 'Video'}
${transcript ? `Transcript: ${transcript.substring(0, 500)}...` : ''}

Provide:
1. Best thumbnail moments (timestamps)
2. Why each moment is good
3. Thumbnail composition suggestions
4. Text overlay suggestions
5. Color scheme recommendations

Format as JSON array with objects containing: timestamp (seconds), reason (string), composition (string), textOverlay (string), colorScheme (string), confidence (number 0-1)`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a video thumbnail expert. Suggest optimal thumbnail moments that maximize click-through rates.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const suggestionsText = response.choices[0].message.content;
    
    let suggestions;
    try {
      suggestions = JSON.parse(suggestionsText);
    } catch (error) {
      const jsonMatch = suggestionsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse thumbnail suggestions');
      }
    }

    logger.info('Thumbnail suggestions generated', { videoId, count: suggestions.length });
    return {
      videoId,
      suggestions: suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)),
    };
  } catch (error) {
    logger.error('Generate thumbnail suggestions error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * A/B test thumbnails
 */
async function createThumbnailABTest(videoId, userId, thumbnails) {
  try {
    if (!thumbnails || thumbnails.length < 2) {
      throw new Error('At least 2 thumbnails required for A/B test');
    }

    // In production, create actual thumbnail variants
    const test = {
      videoId,
      userId,
      thumbnails: thumbnails.map((thumb, index) => ({
        id: `thumb-${index + 1}`,
        url: thumb.url,
        timestamp: thumb.timestamp,
        variant: String.fromCharCode(65 + index), // A, B, C, etc.
        clicks: 0,
        impressions: 0,
        ctr: 0,
      })),
      status: 'active',
      createdAt: new Date(),
    };

    logger.info('Thumbnail A/B test created', { videoId, variants: thumbnails.length });
    return test;
  } catch (error) {
    logger.error('Create thumbnail A/B test error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get thumbnail performance
 */
async function getThumbnailPerformance(videoId, userId) {
  try {
    const Content = require('../models/Content');
    const content = await Content.findOne({
      _id: videoId,
      userId,
      type: 'video',
    }).lean();

    if (!content) {
      throw new Error('Video not found');
    }

    // In production, track actual thumbnail performance
    const performance = {
      videoId,
      currentThumbnail: {
        url: content.thumbnail || null,
        clicks: content.views || 0,
        impressions: (content.views || 0) * 10, // Estimated
        ctr: 0.1, // 10% CTR
      },
      recommendations: [
        {
          type: 'face_detection',
          message: 'Thumbnails with faces perform 2x better',
        },
        {
          type: 'bright_colors',
          message: 'Bright, vibrant colors increase CTR by 30%',
        },
        {
          type: 'text_overlay',
          message: 'Text overlays improve clarity and engagement',
        },
      ],
    };

    logger.info('Thumbnail performance analyzed', { videoId });
    return performance;
  } catch (error) {
    logger.error('Get thumbnail performance error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Generate thumbnail from frame
 */
async function generateThumbnailFromFrame(videoId, timestamp, options = {}) {
  try {
    const {
      width = 1280,
      height = 720,
      quality = 'high',
      addText = false,
      text = null,
    } = options;

    // In production, extract frame and generate thumbnail
    const thumbnail = {
      videoId,
      timestamp,
      url: `thumbnails/${videoId}_${timestamp}.jpg`,
      width,
      height,
      quality,
      textOverlay: addText ? {
        text: text || 'Video Title',
        position: 'bottom',
        fontSize: 48,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.5)',
      } : null,
      generatedAt: new Date(),
    };

    logger.info('Thumbnail generated from frame', { videoId, timestamp });
    return thumbnail;
  } catch (error) {
    logger.error('Generate thumbnail from frame error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  generateThumbnailSuggestions,
  createThumbnailABTest,
  getThumbnailPerformance,
  generateThumbnailFromFrame,
};






