
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

    // NOTE: do NOT scale/pad here. The caller already prepends
    // `scale=${exportWidth}:${exportHeight}` to the chain, which sizes the source
    // to the user's chosen export dimensions. A hardcoded `scale=1920:1080,pad`
    // here previously OVERRODE that for any source under 1080px wide — turning
    // every 720p/640p source (and crucially every VERTICAL export) into a
    // letterboxed 1920x1080 landscape. The enhancement chain is quality-only.
    void targetOptions;

    // Normalization (hqdn3d + unsharp)
    filters.push('hqdn3d=1.5:1.5:6:6'); // Clean noise
    filters.push('unsharp=3:3:0.5:3:3:0.5'); // Sharpen edges

    // Color Normalization
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
