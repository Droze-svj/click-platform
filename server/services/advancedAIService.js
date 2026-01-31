// Advanced AI Service
// Multi-modal content generation, voice cloning, and advanced AI features

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const { OpenAI } = require('openai');

let openai = null;
function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate multi-modal content (text + image + video description)
 * @param {Object} prompt - Content prompt
 * @param {Array} mediaTypes - Types of media to generate
 * @returns {Promise<Object>} Generated content
 */
async function generateMultiModalContent(prompt, mediaTypes = ['text', 'image']) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    logger.info('Generating multi-modal content', { prompt, mediaTypes });

    const results = {};

    // Generate text content
    if (mediaTypes.includes('text')) {
      const textResponse = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content creator. Generate engaging, high-quality content.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      results.text = textResponse.choices[0].message.content;
    }

    // Generate image description for DALL-E
    if (mediaTypes.includes('image')) {
      const imagePromptResponse = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Generate a detailed image description for DALL-E based on this content prompt.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      const imageDescription = imagePromptResponse.choices[0].message.content;

      // Generate image with DALL-E
      const imageResponse = await client.images.generate({
        model: 'dall-e-3',
        prompt: imageDescription,
        n: 1,
        size: '1024x1024',
      });
      results.image = imageResponse.data[0].url;
      results.imageDescription = imageDescription;
    }

    // Generate video script
    if (mediaTypes.includes('video')) {
      const videoScriptResponse = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Generate a video script with scene descriptions, dialogue, and visual cues.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });
      results.videoScript = videoScriptResponse.choices[0].message.content;
    }

    logger.info('Multi-modal content generated', {
      typesGenerated: Object.keys(results),
    });

    return results;
  } catch (error) {
    logger.error('Error generating multi-modal content', {
      error: error.message,
      stack: error.stack,
    });
    captureException(error, {
      tags: { service: 'advancedAIService', action: 'generateMultiModalContent' },
    });
    throw error;
  }
}

/**
 * Generate content series (multiple related pieces)
 * @param {string} topic - Main topic
 * @param {number} count - Number of pieces to generate
 * @param {Object} options - Generation options
 * @returns {Promise<Array>} Generated content series
 */
async function generateContentSeries(topic, count = 5, options = {}) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    logger.info('Generating content series', { topic, count });

    const { style, tone, format } = options;

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Generate a series of ${count} related content pieces about "${topic}". Each piece should be unique but thematically connected. ${style ? `Style: ${style}.` : ''} ${tone ? `Tone: ${tone}.` : ''} ${format ? `Format: ${format}.` : ''} Return as JSON array with title, content, and keyPoints for each piece.`,
        },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const series = JSON.parse(response.choices[0].message.content);
    const contentPieces = Array.isArray(series.content) ? series.content : [series];

    logger.info('Content series generated', {
      topic,
      piecesGenerated: contentPieces.length,
    });

    return contentPieces.slice(0, count);
  } catch (error) {
    logger.error('Error generating content series', { error: error.message });
    throw error;
  }
}

/**
 * Generate long-form content (articles, ebooks)
 * @param {string} topic - Content topic
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Long-form content
 */
async function generateLongFormContent(topic, options = {}) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    const { length = 'medium', structure = 'article', sections = null } = options;

    logger.info('Generating long-form content', { topic, length, structure });

    // Determine word count based on length
    const wordCounts = {
      short: 500,
      medium: 1500,
      long: 3000,
      ebook: 10000,
    };
    const targetWords = wordCounts[length] || 1500;

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Generate a ${structure} about "${topic}" with approximately ${targetWords} words. Include an introduction, main body with ${sections || '3-5'} sections, and a conclusion. Make it engaging and well-structured.`,
        },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      temperature: 0.7,
      max_tokens: Math.min(targetWords * 2, 4000), // Approximate token count
    });

    const content = response.choices[0].message.content;

    // Extract sections if possible
    const contentSections = content.split(/\n\n+/).filter((s) => s.trim().length > 0);

    logger.info('Long-form content generated', {
      topic,
      wordCount: content.split(/\s+/).length,
      sections: contentSections.length,
    });

    return {
      content,
      sections: contentSections,
      wordCount: content.split(/\s+/).length,
      structure,
    };
  } catch (error) {
    logger.error('Error generating long-form content', { error: error.message });
    throw error;
  }
}

/**
 * Generate interactive content (polls, quizzes)
 * @param {string} topic - Content topic
 * @param {string} type - Type (poll, quiz, survey)
 * @returns {Promise<Object>} Interactive content
 */
async function generateInteractiveContent(topic, type = 'poll') {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    logger.info('Generating interactive content', { topic, type });

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Generate a ${type} about "${topic}". Return JSON with question, options (for poll/quiz), correctAnswer (for quiz), and explanation.`,
        },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const interactiveContent = JSON.parse(response.choices[0].message.content);

    logger.info('Interactive content generated', { topic, type });

    return {
      type,
      topic,
      ...interactiveContent,
    };
  } catch (error) {
    logger.error('Error generating interactive content', { error: error.message });
    throw error;
  }
}

/**
 * Voice cloning placeholder (would integrate with ElevenLabs or similar)
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Voice ID to use
 * @returns {Promise<Object>} Audio result
 */
async function generateVoiceContent(text, voiceId = 'default') {
  try {
    logger.info('Generating voice content', { textLength: text.length, voiceId });

    // Placeholder - would integrate with ElevenLabs API or similar
    // const elevenLabs = require('elevenlabs');
    // const audio = await elevenLabs.generate({
    //   voice: voiceId,
    //   text: text,
    // });

    // For now, return placeholder
    return {
      success: true,
      message: 'Voice generation requires ElevenLabs API integration',
      text,
      voiceId,
      audioUrl: null, // Would be the generated audio URL
    };
  } catch (error) {
    logger.error('Error generating voice content', { error: error.message });
    throw error;
  }
}

/**
 * Style transfer between content types
 * @param {string} sourceContent - Source content
 * @param {string} targetStyle - Target style/format
 * @returns {Promise<string>} Transformed content
 */
async function transferContentStyle(sourceContent, targetStyle) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    logger.info('Transferring content style', { targetStyle, contentLength: sourceContent.length });

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Transform the following content to match the style: ${targetStyle}. Maintain the core message and information but adapt the tone, format, and presentation style.`,
        },
        { role: 'user', content: sourceContent },
      ],
      temperature: 0.7,
    });

    const transformedContent = response.choices[0].message.content;

    logger.info('Content style transferred', { targetStyle });

    return transformedContent;
  } catch (error) {
    logger.error('Error transferring content style', { error: error.message });
    throw error;
  }
}

/**
 * Generate content recommendations based on performance
 * @param {string} userId - User ID
 * @param {Object} performanceData - Historical performance data
 * @returns {Promise<Array>} Content recommendations
 */
async function generateContentRecommendations(userId, performanceData) {
  try {
    const client = getOpenAIClient();
    if (!client) {
      throw new Error('OpenAI API not configured');
    }

    logger.info('Generating content recommendations', { userId });

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Analyze content performance data and generate specific, actionable content recommendations. Focus on topics, formats, posting times, and content strategies that would improve performance.',
        },
        {
          role: 'user',
          content: `Performance data: ${JSON.stringify(performanceData)}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const recommendations = JSON.parse(response.choices[0].message.content);

    logger.info('Content recommendations generated', {
      userId,
      recommendationsCount: recommendations.recommendations?.length || 0,
    });

    return recommendations.recommendations || [];
  } catch (error) {
    logger.error('Error generating content recommendations', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateMultiModalContent,
  generateContentSeries,
  generateLongFormContent,
  generateInteractiveContent,
  generateVoiceContent,
  transferContentStyle,
  generateContentRecommendations,
};
