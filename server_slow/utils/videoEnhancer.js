const logger = require('./logger');

class VideoEnhancer {
  /**
   * Build FFmpeg enhancement filter chain
   * Includes: 
   * - scale: Auto-upscale to 1080p minimum
   * - fps: Frame-rate normalization to 24 or 30
   * - unsharp: Detail enhancement
   * - hqdn3d: High quality denoising
   */
  getEnhancementFilters(metadata, targetOptions = {}) {
    const filters = [];
    const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
    
    if (!videoStream) return [];

    // 1. Auto-Upscaling (to 1080p if below)
    const currentWidth = videoStream.width || 0;
    if (currentWidth < 1080) {
      logger.info(`VideoEnhancer: Injecting Upscale Filter (${currentWidth} -> 1080p)`);
      filters.push('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
    }

    // 2. Normalization (hqdn3d + unsharp)
    filters.push('hqdn3d=1.5:1.5:6:6'); // Clean noise
    filters.push('unsharp=3:3:0.5:3:3:0.5'); // Sharpen edges

    // 3. Color Normalization
    filters.push('colorlevels=rimin=0.05:gimin=0.05:bimin=0.05:rimax=0.95:gimax=0.95:bimax=0.95');

    return filters;
  }

  /**
   * Get encoding properties for high-fidelity output
   */
  getHighFidelityOptions() {
    return [
      '-preset slow',
      '-crf 18',
      '-pix_fmt yuv420p',
      '-movflags +faststart'
    ];
  }
}

module.exports = new VideoEnhancer();
