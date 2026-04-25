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
      logger.warn('Pexels API key missing, returning high-fidelity fallbacks');
      return this.getFallbackVideos(query);
    }

    try {
      const response = await axios.get('https://api.pexels.com/videos/search', {
        headers: { Authorization: this.pexelsKey },
        params: {
          query,
          per_page: perPage,
          orientation: orientation === 'vertical' ? 'portrait' : 'landscape'
        }
      });

      return response.data.videos.map(v => ({
        id: v.id,
        url: v.video_files.find(f => f.quality === 'hd')?.link || v.video_files[0].link,
        thumbnail: v.image,
        duration: v.duration,
        source: 'pexels'
      }));
    } catch (err) {
      logger.error('Pexels API Error', { error: err.message });
      return this.getFallbackVideos(query);
    }
  }

  /**
   * High-fidelity fallbacks for development/missing keys
   */
  getFallbackVideos(query) {
    return [
      {
        id: 'fallback-1',
        url: 'https://cdn.coverr.co/videos/coverr-a-person-working-on-a-laptop-5221/1080p.mp4',
        thumbnail: 'https://cdn.coverr.co/videos/coverr-a-person-working-on-a-laptop-5221/thumbnail.jpg',
        duration: 15,
        source: 'coverr-fallback'
      }
    ];
  }
}

module.exports = new StockFootageService();
