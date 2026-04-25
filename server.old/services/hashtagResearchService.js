// Hashtag Research Service

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

async function callGemini(systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.5) {
  if (!geminiConfigured) {
    throw new Error('Google AI API key not configured. Please set GOOGLE_AI_API_KEY environment variable.');
  }
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return geminiGenerate(fullPrompt, { maxTokens, temperature });
}

/**
 * Research hashtag performance
 */
async function researchHashtag(hashtag, platform) {
  try {
    const prompt = `Research this hashtag for ${platform}:

Hashtag: #${hashtag}

Provide:
1. Estimated reach (high/medium/low)
2. Competition level (high/medium/low)
3. Best use cases
4. Related hashtags
5. Optimal posting times
6. Content type recommendations
7. Audience insights

Format as JSON object with fields: estimatedReach, competitionLevel, useCases (array), relatedHashtags (array), optimalPostingTimes (array), contentTypes (array), audienceInsights (object). Return only valid JSON.`;

    const researchText = await callGemini(
      'You are a hashtag research expert. Provide detailed hashtag insights.',
      prompt
    );

    let research;
    try {
      research = JSON.parse(researchText || '{}');
    } catch (error) {
      const jsonMatch = (researchText || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        research = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse hashtag research');
      }
    }

    logger.info('Hashtag researched', { hashtag, platform });
    return research;
  } catch (error) {
    logger.error('Research hashtag error', { error: error.message, hashtag });
    throw error;
  }
}

/**
 * Get competitor hashtags
 */
async function getCompetitorHashtags(competitorUsername, platform) {
  try {
    const prompt = `Analyze hashtag strategy for ${competitorUsername} on ${platform}:

Provide:
1. Most used hashtags
2. Hashtag categories
3. Hashtag frequency
4. Engagement patterns
5. Hashtag mix strategy
6. Recommendations for similar strategy

Format as JSON object with fields: topHashtags (array), categories (array), frequency (object), engagementPatterns (object), mixStrategy (object), recommendations (array). Return only valid JSON.`;

    const analysisText = await callGemini(
      'You are a competitive hashtag analyst. Analyze competitor hashtag strategies.',
      prompt
    );

    let analysis;
    try {
      analysis = JSON.parse(analysisText || '{}');
    } catch (error) {
      const jsonMatch = (analysisText || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse competitor hashtags');
      }
    }

    logger.info('Competitor hashtags analyzed', { competitorUsername, platform });
    return analysis;
  } catch (error) {
    logger.error('Get competitor hashtags error', { error: error.message });
    throw error;
  }
}

/**
 * Predict hashtag performance
 */
async function predictHashtagPerformance(hashtags, contentText, platform) {
  try {
    const prompt = `Predict performance for these hashtags on ${platform}:

Hashtags: ${hashtags.join(', ')}
Content: ${contentText.substring(0, 500)}

Provide:
1. Expected reach (0-100)
2. Engagement potential (0-100)
3. Competition level (0-100)
4. Best hashtags to use
5. Hashtags to avoid
6. Optimal hashtag mix
7. Performance prediction

Format as JSON object with fields: expectedReach (number), engagementPotential (number), competitionLevel (number), bestHashtags (array), avoidHashtags (array), optimalMix (array), performancePrediction (object). Return only valid JSON.`;

    const predictionText = await callGemini(
      'You are a hashtag performance predictor. Predict hashtag effectiveness.',
      prompt
    );

    let prediction;
    try {
      prediction = JSON.parse(predictionText || '{}');
    } catch (error) {
      const jsonMatch = (predictionText || '').match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        prediction = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse performance prediction');
      }
    }

    logger.info('Hashtag performance predicted', { hashtags: hashtags.length, platform });
    return prediction;
  } catch (error) {
    logger.error('Predict hashtag performance error', { error: error.message });
    throw error;
  }
}

module.exports = {
  researchHashtag,
  getCompetitorHashtags,
  predictHashtagPerformance,
};
