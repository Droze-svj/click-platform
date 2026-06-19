// Generative Asset Service (Phase 11)
// Automated Sound Design (Foley) and Magic B-Roll Fill

const logger = require('../utils/logger');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');

/**
 * Refine a simple user prompt into a production-grade B-roll prompt
 * @param {string} userPrompt - Original user request
 * @returns {Promise<string>} Refined prompt
 */
async function refineBRollPrompt(userPrompt) {
  if (!geminiConfigured) return userPrompt;

  try {
    const prompt = `Expand this simple B-roll request into a professional video generation prompt.
    Original Request: "${userPrompt}"

    Include details about:
    - Cinematic lighting (e.g., volumetric, neon, golden hour)
    - Camera movement (e.g., slow drone sweep, handheld, macro)
    - Aesthetic (e.g., cyberpunk, hyper-realistic, minimalist)

    Respond with only the refined prompt text.`;

    const refined = await geminiGenerate(prompt, { temperature: 0.8 });
    return refined || userPrompt;
  } catch (error) {
    logger.error('Prompt refinement error', { error: error.message });
    return userPrompt;
  }
}

/**
 * Automatically suggest and place sound effects (Foley) based on timeline events
 * @param {Object} timeline - Current timeline
 * @returns {Promise<Array>} List of suggested sound effects to add
 */
async function autoSoundDesign(timeline) {
  try {
    const sfxSuggestions = [];

    // 1. Detect fast transitions or pop-ups
    (timeline.clips || []).forEach(clip => {
      if (clip.type === 'transition' && clip.duration < 1) {
        sfxSuggestions.push({
          type: 'whoosh',
          time: clip.startTime,
          volume: 0.5,
          assetUrl: '/assets/sfx/whoosh-soft.mp3'
        });
      }
      if (clip.type === 'overlay' && clip.animation === 'pop') {
        sfxSuggestions.push({
          type: 'pop',
          time: clip.startTime,
          volume: 0.7,
          assetUrl: '/assets/sfx/pop-modern.mp3'
        });
      }
    });

    logger.info('Auto-sound design completed', { suggestionCount: sfxSuggestions.length });
    return sfxSuggestions;
  } catch (error) {
    logger.error('Auto-sound design error', { error: error.message });
    return [];
  }
}

/**
 * Generate Magic B-Roll clips or background fill.
 *
 * Prompt refinement is REAL (Gemini-backed). Actual text-to-video generation is
 * NOT yet integrated, so we do NOT fabricate a "minted" 4K clip URL pointing at
 * a file that doesn't exist (owner's #1 rule). We return the real refined prompt
 * plus an honest `status: 'unavailable'` so the UI can state the truth instead
 * of showing a dead asset as a success.
 *
 * @param {string} prompt - Text prompt for B-roll (e.g., "futuristic city")
 * @param {number} duration - Desired duration
 * @returns {Promise<Object>} Refined prompt + honest availability status
 */
async function magicBRollFill(prompt, duration = 3) {
  try {
    logger.info('Starting Magic B-Roll fill', { originalPrompt: prompt, duration });

    // Delegate to the flag-gated text-to-video provider. When configured it
    // performs REAL generation; otherwise it returns the refined prompt + an
    // honest `unavailable` status (never a fabricated URL). Lazy require avoids
    // a circular dependency.
    const { generateBRollVideo } = require('./textToVideoService');
    return await generateBRollVideo(prompt, { duration });
  } catch (error) {
    logger.error('Magic B-Roll fill error', { error: error.message });
    return {
      url: null,
      originalPrompt: prompt,
      refinedPrompt: null,
      duration,
      status: 'error',
      error: error.message,
    };
  }
}

module.exports = {
  autoSoundDesign,
  magicBRollFill,
  refineBRollPrompt
};
