// Brand Voice Library Service

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a brand voice expert. Create comprehensive style guides.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });

    const guideText = response.choices[0].message.content;
    
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a multilingual brand voice expert. Ensure brand voice consistency across languages.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const analysisText = response.choices[0].message.content;
    
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






