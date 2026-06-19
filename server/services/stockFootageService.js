const axios = require('axios');
const logger = require('../utils/logger');

class StockFootageService {
  constructor() {
    this.pexelsKey = process.env.PEXELS_API_KEY;
    this.unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  }

  /**
   * Search for stock video clips based on keywords
   */
  async searchVideos(query, options = {}) {
    const { perPage = 5, orientation = 'vertical' } = options;
    
    if (!this.pexelsKey) {
      logger.warn('Pexels API key missing — no stock footage results');
      return this.getFallbackVideos(query);
    }

    try {
      const response = await axios.get('https://api.pexels.com/videos/search', {
        headers: { Authorization: this.pexelsKey },
        params: {
          query,
          per_page: perPage,
          orientation: orientation === 'vertical' ? 'portrait' : 'landscape'
        },
        timeout: 10000,
      });

      return (response.data.videos || []).map(v => {
        const files = Array.isArray(v.video_files) ? v.video_files : [];
        const link = (files.find(f => f.quality === 'hd') || files[0] || {}).link || null;
        return {
          id: v.id,
          url: link,
          thumbnail: v.image,
          duration: v.duration,
          source: 'pexels'
        };
      }).filter(v => v.url);
    } catch (err) {
      logger.error('Pexels API Error', { error: err.message });
      return this.getFallbackVideos(query);
    }
  }

  /**
   * No-key / error fallback. Returns an EMPTY list — we do NOT return a
   * hardcoded unrelated clip mislabeled as a search match (owner's #1 rule).
   */
  getFallbackVideos(query) {
    void query;
    return [];
  }
}

module.exports = new StockFootageService();
