const logger = require('../utils/logger');
const crypto = require('crypto');

class UGCSynthesizerService {
  /**
   * Humanize a script and generate a degradation manifest
   */
  async humanize(userId, script, intensity = 'medium') {
    logger.info('UGC-Sim: Humanizing content', { userId, intensity });

    const fillerWords = ['um', 'uh', 'like', 'actually', 'totally', 'honestly'];
    const humanizedScript = this.injectFillers(script, fillerWords, intensity);
    
    // Generate simulated audio/video degradation parameters
    const manifest = {
      authenticityScore: intensity === 'heavy' ? 98 : intensity === 'medium' ? 85 : 72,
      video: {
        shakeAmplitudePx: intensity === 'heavy' ? 12 : 4,
        compressionQuality: intensity === 'heavy' ? 65 : 85,
        grainIntensity: 0.15
      },
      pacing: {
        variancePercent: intensity === 'heavy' ? 15 : 5,
        microPauses: true
      }
    };

    return { humanizedScript, manifest };
  }

  injectFillers(text, fillers, intensity) {
    const words = text.split(' ');
    const rate = intensity === 'heavy' ? 0.15 : intensity === 'medium' ? 0.08 : 0.03;
    
    const humanized = words.map(word => {
      if (Math.random() < rate) {
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        return `${filler}, ${word}`;
      }
      return word;
    });

    return humanized.join(' ');
  }

  getProfiles() {
    return [
      { id: 'raw-testimonial', label: 'Raw Testimonial', description: 'Handheld, shaky, high-background noise' },
      { id: 'casual-vlog', label: 'Casual Vlog', description: 'Natural lighting, walking-and-talking' },
      { id: 'studio-pro', label: 'Studio Pro', description: 'Clean but with microslips' }
    ];
  }
}

module.exports = new UGCSynthesizerService();
