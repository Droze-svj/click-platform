const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { fetchStockBroll } = require('./stockAssetsService');
const logger = require('../utils/logger');

/**
 * Extracts high-impact visual keywords from a transcript or text.
 * Based on Task 8.1 "Keyword-Velocity Sourcing".
 */
async function extractVisualKeywords(text) {
  if (!geminiConfigured) {
    logger.warn('Google AI not configured, using fallback keywords');
    return ['cinematic', 'epic', 'technology', 'nature'];
  }

  try {
    const prompt = `Analyze this video transcript and identify 5-8 high-impact visual themes or objects that would make for great stock footage B-roll.
Focus on visually descriptive keywords.

Transcript: ${text}

Return a JSON object with a "keywords" array of strings. Return only valid JSON.`;

    const content = await geminiGenerate(prompt, { maxTokens: 200 });
    const result = JSON.parse(content || '{}');
    return result.keywords || ['cinematic', 'lifestyle', 'cityscape'];
  } catch (error) {
    logger.error('Keyword extraction error', { error: error.message });
    return ['business', 'technology', 'abstract'];
  }
}

/**
 * Autonomous Stock Sourcing (Task 8.1)
 * Extracts keywords and fetches matching stock B-roll assets.
 */
async function sourceAutonomousAssets(transcript) {
  try {
    const keywords = await extractVisualKeywords(transcript);
    logger.info('Extracted visual keywords for sourcing', { keywords });

    const sourcingResults = await Promise.all(
      keywords.slice(0, 4).map(async (keyword) => {
        const res = await fetchStockBroll(1, 5, keyword);
        return {
          keyword,
          assets: res.items || []
        };
      })
    );

    // Flatten and deduplicate by asset ID
    const allAssets = [];
    const seenIds = new Set();

    sourcingResults.forEach(group => {
      group.assets.forEach(asset => {
        if (!seenIds.has(asset.id)) {
          seenIds.add(asset.id);
          allAssets.push({
            ...asset,
            matchedKeyword: group.keyword
          });
        }
      });
    });

    return {
      keywords,
      suggestedAssets: allAssets,
      count: allAssets.length
    };
  } catch (error) {
    logger.error('Autonomous sourcing failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  extractVisualKeywords,
  sourceAutonomousAssets
};
