// Content Variation Service
// Generates variations of content for recycling

const { generateSocialContent } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Generate content variations
 */
async function generateVariations(originalText, platform, count = 3, options = {}) {
  try {
    const variations = [];
    const { tone = 'varied', style = 'maintain' } = options;

    for (let i = 0; i < count; i++) {
      try {
        const variation = await generateVariation(originalText, platform, i, {
          tone,
          style,
          variationIndex: i
        });
        if (variation) {
          variations.push({
            text: variation.text,
            hashtags: variation.hashtags || [],
            variationType: variation.type || 'rewrite',
            score: variation.score || 85,
            changes: variation.changes || []
          });
        }
      } catch (error) {
        logger.warn('Error generating variation', { error: error.message, index: i });
      }
    }

    return variations.filter(Boolean);
  } catch (error) {
    logger.error('Error generating variations', { error: error.message });
    return [];
  }
}

/**
 * Generate a single variation
 */
async function generateVariation(originalText, platform, index, options = {}) {
  try {
    const { tone, style, variationIndex } = options;
    
    const variationPrompts = [
      `Rewrite this content with a more engaging hook while maintaining the core message:\n\n${originalText}`,
      `Create a fresh version of this content with updated language and structure:\n\n${originalText}`,
      `Rephrase this content to sound more conversational and relatable:\n\n${originalText}`,
      `Transform this content with a different angle while keeping the main points:\n\n${originalText}`,
      `Refresh this content with modern language and a new perspective:\n\n${originalText}`
    ];

    const prompt = variationPrompts[variationIndex % variationPrompts.length];

    const response = await generateSocialContent(originalText, 'general', [platform]);
    
    if (response && response[platform]) {
      return {
        text: response[platform].text || response[platform].content || originalText,
        hashtags: response[platform].hashtags || [],
        type: 'ai_rewrite',
        score: 85,
        changes: ['text_rewritten']
      };
    }

    // Fallback: simple text variation
    return {
      text: applySimpleVariations(originalText, index),
      hashtags: [],
      type: 'simple_rewrite',
      score: 70,
      changes: ['text_modified']
    };
  } catch (error) {
    logger.error('Error generating variation', { error: error.message });
    return null;
  }
}

/**
 * Apply simple text variations
 */
function applySimpleVariations(text, index) {
  const variations = [
    text => text.replace(/^/, '💡 '), // Add emoji
    text => text.replace(/^/, '✨ '), // Different emoji
    text => text.replace(/^/, '🚀 '), // Another emoji
    text => text.split('.').slice(0, -1).join('.') + '.', // Remove last sentence
    text => text.replace(/\b(I|We|You)\b/g, (match) => {
      const replacements = { 'I': 'We', 'We': 'I', 'You': 'We' };
      return replacements[match] || match;
    }) // Change pronouns
  ];

  const variation = variations[index % variations.length];
  return variation ? variation(text) : text;
}

/**
 * Select best variation based on performance
 */
function selectBestVariation(variations, performanceData = []) {
  if (!performanceData || performanceData.length === 0) {
    // Return highest scored variation
    return variations.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  }

  // Select variation with best performance
  const variationPerformance = variations.map((variation, index) => {
    const perf = performanceData[index] || {};
    return {
      variation,
      performance: perf.engagement || 0,
      engagementRate: perf.engagementRate || 0
    };
  });

  return variationPerformance
    .sort((a, b) => (b.performance + b.engagementRate * 10) - (a.performance + a.engagementRate * 10))[0]
    .variation;
}

module.exports = {
  generateVariations,
  generateVariation,
  selectBestVariation
};


