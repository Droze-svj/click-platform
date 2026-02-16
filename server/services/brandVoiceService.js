// Brand Voice Analyzer Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Analyze brand voice
 */
async function analyzeBrandVoice(userId, sampleContent = []) {
  try {
    const Content = require('../models/Content');

    // Get user's content if no samples provided
    if (sampleContent.length === 0) {
      const userContent = await Content.find({ userId, status: 'published' })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('title body')
        .lean();

      sampleContent = userContent.map(c => `${c.title}\n${c.body}`).slice(0, 10);
    }

    if (sampleContent.length === 0) {
      return {
        error: 'No content samples available',
      };
    }

    const prompt = `Analyze the brand voice and writing style from these content samples:

${sampleContent.map((c, i) => `${i + 1}. ${c}`).join('\n\n')}

Provide analysis in JSON format with:
1. Tone (professional, casual, friendly, authoritative, etc.)
2. Style (conversational, formal, technical, etc.)
3. Key characteristics (array of traits)
4. Word choice patterns
5. Sentence structure (short, long, varied)
6. Consistency score (0-100)
7. Recommendations for improvement

Format as JSON object with fields: tone, style, characteristics (array), wordChoice, sentenceStructure, consistencyScore (number), recommendations (array)`;

    if (!geminiConfigured) {
      logger.warn('Google AI API key not configured, cannot analyze brand voice');
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a brand voice analyst. Analyze writing style, tone, and consistency.\n\n${prompt}`;
    const analysisText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1500 });

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (error) {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse analysis');
      }
    }

    logger.info('Brand voice analyzed', { userId });
    return analysis;
  } catch (error) {
    logger.error('Analyze brand voice error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check content consistency
 */
async function checkContentConsistency(userId, contentText, brandVoiceProfile = null) {
  try {
    // Get brand voice profile if not provided
    if (!brandVoiceProfile) {
      brandVoiceProfile = await analyzeBrandVoice(userId);
    }

    const prompt = `Check if this content matches the brand voice profile:

Brand Voice Profile:
- Tone: ${brandVoiceProfile.tone}
- Style: ${brandVoiceProfile.style}
- Characteristics: ${brandVoiceProfile.characteristics?.join(', ') || 'N/A'}

Content to check:
${contentText}

Provide analysis in JSON format with:
1. Consistency score (0-100)
2. Matches (what aligns with brand voice)
3. Mismatches (what doesn't align)
4. Suggestions for improvement

Format as JSON object with fields: consistencyScore (number), matches (array), mismatches (array), suggestions (array)`;

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a brand voice consistency checker. Ensure content aligns with brand voice.\n\n${prompt}`;
    const checkText = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1000 });

    let check;
    try {
      check = JSON.parse(checkText);
    } catch (error) {
      const jsonMatch = checkText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        check = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse check');
      }
    }

    logger.info('Content consistency checked', { userId, score: check.consistencyScore });
    return check;
  } catch (error) {
    logger.error('Check content consistency error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get tone suggestions
 */
async function getToneSuggestions(contentText, targetTone) {
  try {
    const prompt = `Suggest how to rewrite this content to match the ${targetTone} tone:

Original content:
${contentText}

Provide:
1. Rewritten version
2. Key changes made
3. Tone indicators added

Format as JSON object with fields: rewritten, keyChanges (array), toneIndicators (array)`;

    if (!geminiConfigured) {
      throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
    }

    const fullPrompt = `You are a tone adjustment expert. Help rewrite content to match specific tones.\n\n${prompt}`;
    const suggestionsText = await geminiGenerate(fullPrompt, { temperature: 0.7, maxTokens: 1000 });

    let suggestions;
    try {
      suggestions = JSON.parse(suggestionsText);
    } catch (error) {
      const jsonMatch = suggestionsText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse suggestions');
      }
    }

    return suggestions;
  } catch (error) {
    logger.error('Get tone suggestions error', { error: error.message });
    throw error;
  }
}

module.exports = {
  analyzeBrandVoice,
  checkContentConsistency,
  getToneSuggestions,
};






