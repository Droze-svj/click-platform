// Brand Voice Library Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Create brand voice profile
 */
async function createBrandVoiceProfile(userId, profileData) {
  try {
    const {
      name,
      tone,
      style,
      characteristics,
      doWords,
      dontWords,
      examples,
    } = profileData;

    const profile = {
      userId,
      name,
      tone,
      style,
      characteristics: characteristics || [],
      doWords: doWords || [],
      dontWords: dontWords || [],
      examples: examples || [],
      createdAt: new Date(),
    };

    // In production, save to database
    // For now, return profile
    logger.info('Brand voice profile created', { userId, name });
    return profile;
  } catch (error) {
    logger.error('Create brand voice profile error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate style guide
 */
async function generateStyleGuide(brandVoiceProfile) {
  try {
    const prompt = `Generate a comprehensive style guide based on this brand voice profile:

Tone: ${brandVoiceProfile.tone}
Style: ${brandVoiceProfile.style}
Characteristics: ${brandVoiceProfile.characteristics?.join(', ') || 'N/A'}
Do Words: ${brandVoiceProfile.doWords?.join(', ') || 'N/A'}
Don't Words: ${brandVoiceProfile.dontWords?.join(', ') || 'N/A'}

Provide:
1. Voice overview
2. Tone guidelines
3. Writing style rules
4. Word choice guidelines
5. Sentence structure preferences
6. Examples of good content
7. Examples of content to avoid
8. Platform-specific adaptations

Format as JSON object with fields: overview, toneGuidelines (array), styleRules (array), wordGuidelines (array), sentenceStructure (object), goodExamples (array), avoidExamples (array), platformAdaptations (object)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot generate style guide');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a brand voice expert. Create comprehensive style guides.\n\n${prompt}`;
    const guideText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 2500 });

    let guide;
    try {
      guide = JSON.parse(guideText);
    } catch (error) {
      const jsonMatch = guideText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        guide = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse style guide');
      }
    }

    logger.info('Style guide generated', { profileName: brandVoiceProfile.name });
    return guide;
  } catch (error) {
    logger.error('Generate style guide error', { error: error.message });
    throw error;
  }
}

/**
 * Analyze multi-language content
 */
async function analyzeMultiLanguageContent(contentText, targetLanguage) {
  try {
    const prompt = `Analyze this content and provide brand voice consistency check for ${targetLanguage} translation:

Content:
${contentText}

Provide:
1. Tone consistency score (0-100)
2. Style preservation
3. Cultural adaptation recommendations
4. Brand voice alignment
5. Translation suggestions

Format as JSON object with fields: consistencyScore (number), stylePreservation (object), culturalAdaptations (array), brandAlignment (object), translationSuggestions (array)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot analyze multi-language content');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a multilingual brand voice expert. Ensure brand voice consistency across languages.\n\n${prompt}`;
    const analysisText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1500 });

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse multi-language analysis');
      }
    }

    logger.info('Multi-language content analyzed', { targetLanguage });
    return analysis;
  } catch (error) {
    logger.error('Analyze multi-language content error', { error: error.message });
    throw error;
  }
}

module.exports = {
  createBrandVoiceProfile,
  generateStyleGuide,
  analyzeMultiLanguageContent,
};






