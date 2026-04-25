const stockFootage = require('./stockFootageService');
const logger = require('../utils/logger');

class BRollIntelligenceService {
  /**
   * Orchestrate B-roll insertion for a video based on its transcript
   */
  async orchestrateBRoll(videoId, transcriptData, options = {}) {
    logger.info(`BRoll Intelligence: Orchestrating for ${videoId}`);
    
    const { 
      gapThreshold = 4, // Max seconds of talking head before B-roll
      targetDensity = 0.3 // Aim for 30% visual variety
    } = options;

    const segments = transcriptData.segments || [];
    const bRollPlan = [];
    
    // 1. Identify "Visual Gaps" (Long segments without intense punctuation or hook markers)
    let currentGapStart = 0;
    
    for (const segment of segments) {
      const gapDuration = segment.end - currentGapStart;
      
      if (gapDuration >= gapThreshold) {
        // 2. Extract context keyword for the gap
        const keyword = await this.extractContextKeyword(segment.text);
        
        // 3. Fetch matching stock footage
        const clips = await stockFootage.searchVideos(keyword, { perPage: 1 });
        
        if (clips.length > 0) {
          bRollPlan.push({
            startTime: segment.start,
            duration: Math.min(3, gapDuration), // Keep B-roll snappy
            url: clips[0].url,
            keyword,
            source: clips[0].source
          });
          currentGapStart = segment.end;
        }
      }
    }

    logger.info(`BRoll Plan Generated: ${bRollPlan.length} insertions`, { videoId });
    return bRollPlan;
  }

  async extractContextKeyword(text) {
    try {
      const { generateContent, isConfigured } = require('../utils/googleAI');
      if (isConfigured) {
        const prompt = `Extract the single most visually evocative, marketing-relevant keyword from this text to search for premium stock footage. Avoid generic words. Text: "${text}"`;
        const keyword = await generateContent(prompt, { temperature: 0.2, maxTokens: 10 });
        return keyword?.trim().replace(/[^a-zA-Z]/g, '') || 'lifestyle';
      }
    } catch (err) {
      logger.warn('Gemini keyword extraction failed, using fallback', { error: err.message });
    }

    // Simple extraction fallback
    const significants = text.split(' ').filter(w => w.length > 6);
    return significants.length > 0 ? significants[0] : 'cinematic';
  }
}

module.exports = new BRollIntelligenceService();
