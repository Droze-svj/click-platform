const { fetchStockBroll } = require('./stockAssetsService');
const { generateBRoll } = require('./generativeVideoService');
const logger = require('../utils/logger');

/**
 * Agentic Storyboarder: Semantic Topic Extraction & B-Roll Assembly
 * Maps transcript timing to autonomous B-roll generation.
 */
async function getSmartBRollSuggestions(transcript, words = []) {
  try {
    // 1. Semantic Topic Extraction (Transcript -> Topic)
    // In production, an LLM handles this. We use a heuristic simulating semantic chunking.
    const chunks = [];
    if (words && words.length > 0) {
      let currentChunk = { start: words[0].start, end: words[0].end, text: '' };
      for (let i = 0; i < words.length; i++) {
        currentChunk.text += words[i].text + ' ';
        currentChunk.end = words[i].end;
        // Break chunks every ~5 seconds for B-roll pacing
        if (words[i].end - currentChunk.start >= 5 || i === words.length - 1) {
          chunks.push({ ...currentChunk });
          if (i < words.length - 1) {
            currentChunk = { start: words[i+1].start, end: words[i+1].end, text: '' };
          }
        }
      }
    } else {
      chunks.push({ start: 0, end: 10, text: transcript });
    }

    logger.info(`Extracted ${chunks.length} semantic chunks for B-roll assembly.`);

    // 2. API Keyword Query & Autonomous Assembly
    const suggestions = [];
    for (const chunk of chunks) {
      // Extract main noun/verb (heuristic simulation)
      const keywords = chunk.text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 5);
      
      const query = keywords.length > 0 ? keywords[0] : 'cinematic';
      
      // Query the unified API service
      const apiResults = await fetchStockBroll(1, 3, query);
      if (apiResults.items && apiResults.items.length > 0) {
        const topResult = apiResults.items[0];
        suggestions.push({
          assetId: topResult.id,
          title: topResult.title,
          url: topResult.url,
          query: query,
          startTime: chunk.start,
          endTime: chunk.end,
          matchScore: 0.92,
          isGenerative: false
        });
      } else {
        // 3. Zero-Shot Generative Fallback
        logger.info(`No stock results for "${query}". Triggering generative fallback.`);
        const genResult = await generateBRoll(chunk.text);
        if (genResult) {
          suggestions.push({
            assetId: genResult.id,
            title: genResult.title,
            url: genResult.url,
            query: query,
            startTime: chunk.start,
            endTime: chunk.end,
            matchScore: 0.85,
            isGenerative: true,
            provider: genResult.provider
          });
        }
      }
    }

    return {
      success: true,
      suggestions: suggestions
    };
  } catch (error) {
    logger.error('Smart B-roll matching error', { error: error.message });
    throw error;
  }
}

module.exports = {
  getSmartBRollSuggestions
};
