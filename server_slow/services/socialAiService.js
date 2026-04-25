const aiService = require('./aiService');
const logger = require('../utils/logger');

/**
 * Social AI Service
 * Generates platform-specific metadata (titles, tags, descriptions)
 */
class SocialAiService {
  /**
   * Generate metadata for all supported platforms
   */
  async generateUniversalMetadata(transcript, niche, tone = 'energetic') {
    try {
      logger.info('Commencing Universal Social Metadata Synthesis', { niche, tone });

      const [youtube, tiktok, twitter] = await Promise.all([
        this.generateYouTubeMetadata(transcript, niche, tone),
        this.generateTikTokMetadata(transcript, niche, tone),
        this.generateTwitterMetadata(transcript, niche, tone)
      ]);

      return {
        youtube,
        tiktok,
        twitter,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Universal Metadata Synthesis Failed', { error: error.message });
      throw error;
    }
  }

  async generateYouTubeMetadata(transcript, niche, tone) {
    const prompt = `Generate a YouTube Shorts title and description for a video about ${niche}. 
    Tone: ${tone}. 
    Transcript summary: ${transcript.substring(0, 500)}.
    Return as JSON: { "title": "...", "description": "...", "tags": ["tag1", "tag2"] }`;
    
    const result = await aiService.generateText(prompt);
    try {
      return JSON.parse(result);
    } catch (e) {
      return { 
        title: `Amazing ${niche} Video`, 
        description: `Check out this latest video about ${niche}! #shorts #${niche}`, 
        tags: [niche, 'shorts', 'viral'] 
      };
    }
  }

  async generateTikTokMetadata(transcript, niche, tone) {
    const prompt = `Generate a TikTok caption and trending hashtags for a video about ${niche}. 
    Tone: ${tone}. 
    Include a hook in the first sentence.
    Transcript summary: ${transcript.substring(0, 500)}.
    Return as JSON: { "caption": "...", "hashtags": ["#fyp", "#tag1"] }`;
    
    const result = await aiService.generateText(prompt);
    try {
      return JSON.parse(result);
    } catch (e) {
      return { 
        caption: `You won't believe this ${niche} secret! 😱`, 
        hashtags: ['#fyp', `#${niche}`, '#viral', '#foryou'] 
      };
    }
  }

  async generateTwitterMetadata(transcript, niche, tone) {
    const prompt = `Generate a viral Twitter (X) post for a video about ${niche}. 
    Tone: ${tone}. 
    Keep it under 280 characters.
    Transcript summary: ${transcript.substring(0, 500)}.
    Return as JSON: { "text": "...", "hashtags": ["#tag1"] }`;
    
    const result = await aiService.generateText(prompt);
    try {
      return JSON.parse(result);
    } catch (e) {
      return { 
        text: `The ${niche} industry is changing forever. Here is why. 👇`, 
        hashtags: [`#${niche}`, '#tech', '#future'] 
      };
    }
  }
}

module.exports = new SocialAiService();
