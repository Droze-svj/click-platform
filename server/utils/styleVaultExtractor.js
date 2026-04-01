/**
 * styleVaultExtractor.js
 * Parses Premiere Pro / Final Cut Pro XML files to extract Visual & Audio DNA.
 * Constructs an AI StyleProfile object.
 */

class StyleVaultExtractor {
  /**
     * Parse raw XML string to extract stylistic features.
     * @param {string} xmlString - The raw FCP XML or Premiere XML.
     * @returns {Object} StyleProfile
     */
  static parseTimelineXML(xmlString) {
    if (!xmlString) return null;

    // Extract clips to determine pacing
    // Regex simplified for demonstration: matches <clip ... duration="25" /> or similar tags
    const clipMatches = [...xmlString.matchAll(/<clip[^>]*>/gi)];
    const totalClips = clipMatches.length;

    // Try to find duration attributes using regex: duration="3450/60000s" or duration="150"
    let totalDurationFrames = 0;
    const durationMatches = [...xmlString.matchAll(/duration="(\d+)\/?(\d*)s?"/gi)];

    durationMatches.forEach(match => {
      let num = parseInt(match[1]);
      let den = match[2] ? parseInt(match[2]) : 1;
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        totalDurationFrames += (num / den);
      }
    });

    // Calculate pacing (cuts per minute)
    let pacingCategory = 'Moderate';
    let averageClipLength = 0;

    if (totalClips > 0 && totalDurationFrames > 0) {
      // Normalize to seconds assuming 30fps if pure frames
      let durationSeconds = totalDurationFrames;
      if (!xmlString.includes('s"')) durationSeconds = totalDurationFrames / 30;

      averageClipLength = durationSeconds / totalClips;
      const cutsPerMinute = (totalClips / durationSeconds) * 60;

      if (cutsPerMinute > 30) pacingCategory = 'Fast (Jump-Cut Heavy)';
      else if (cutsPerMinute < 10) pacingCategory = 'Slow (Cinematic)';
    }

    // Extract Fonts
    const fontMatches = [...xmlString.matchAll(/font="([^"]+)"/gi)];
    const uniqueFonts = [...new Set(fontMatches.map(m => m[1]))];

    // Extract Hex Colors
    const colorMatches = [...xmlString.matchAll(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/gi)];
    const uniqueColors = [...new Set(colorMatches.map(m => m[0].toUpperCase()))].slice(0, 5);

    // Extract specific effects
    const hasLumetri = xmlString.includes('Lumetri') || xmlString.includes('Color Correction');
    const hasMotionBlur = xmlString.includes('Motion Blur') || xmlString.includes('RSMB');
      
    // Extract additional signals for DNA (Safe detection)
    const transitionMatches = [...xmlString.matchAll(/<transition[^>]*>/gi)];
    const crossDissolveMatches = [...xmlString.matchAll(/name="Cross Dissolve"/gi)];
    const eqMatches = [...xmlString.matchAll(/effect id="EQ"/gi)];
    const audioLevelMatches = [...xmlString.matchAll(/adjust volume/gi)];
    const targetLUFS = xmlString.includes('Loudness') ? -14 : -23; // Integrated LUFS estimate

    return {
      visualDNA: {
        totalClips,
        averageClipLength: averageClipLength.toFixed(2) + ' seconds',
        pacingCategory,
        totalTransitions: transitionMatches.length,
        preferredTransition: crossDissolveMatches.length > 0 ? "Cross Dissolve" : "Straight Cut",
        palette: uniqueColors,
        typography: uniqueFonts.length > 0 ? uniqueFonts : ['Default Sans'],
        effects: {
          colorCorrection: hasLumetri,
          motionBlur: hasMotionBlur
        }
      },
      audioDNA: {
        targetLUFS,
        hasCustomEQ: eqMatches.length > 0,
        averageLevelAdjustments: audioLevelMatches.length > 0 ? true : false,
        duckingThresholds: '< -20dB (Inferred)',
      },
      metadata: {
        parserVersion: '1.2.0',
        inferredEngine: xmlString.includes('fcpxml') ? 'Final Cut Pro X' : 'Premiere Pro'
      }
    };
  }
}

module.exports = StyleVaultExtractor;

