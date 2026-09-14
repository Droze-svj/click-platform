
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

    // Normalization: clean high-frequency sensor noise while preserving skin texture
    filters.push('hqdn3d=1.2:1.2:4:4');

    // Detail enhancement: fine unsharp for retina-sharp edges without ringing/halo artifacts
    const sharpLuma = targetOptions.ultraCrisp ? '0.6' : '0.45';
    const sharpChroma = targetOptions.ultraCrisp ? '0.4' : '0.3';
    filters.push(`unsharp=3:3:${sharpLuma}:3:3:${sharpChroma}`);

    // Dynamic Range & Color Normalization: subtle black/white level correction without clipping
    filters.push('colorlevels=rimin=0.03:gimin=0.03:bimin=0.03:rimax=0.97:gimax=0.97:bimax=0.97');

    return filters;
  }

  /**
   * Get encoding properties for high-fidelity output
   */
  getHighFidelityOptions(isUltra = false) {
    return [
      `-preset ${isUltra ? 'veryslow' : 'slow'}`,
      `-crf ${isUltra ? '16' : '18'}`,
      '-pix_fmt yuv420p',
      '-movflags +faststart'
    ];
  }
}

module.exports = new VideoEnhancer();
