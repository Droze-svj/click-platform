const logger = require('../utils/logger');
const { generateBRollVideo } = require('./textToVideoService');

/**
 * Zero-Shot Generative Fallback — when stock libraries (Pexels/Storyblocks)
 * can't fulfil a storyboard beat, try AI text-to-video.
 *
 * HONEST CONTRACT (owner's #1 rule): this delegates to the flag-gated
 * textToVideoService (Replicate). It returns a clip ONLY when the provider
 * actually rendered one (status 'ready' + a real provider URL). If text-to-video
 * is unconfigured, still rendering, or errored, it returns null so the caller
 * simply omits the suggestion — never a fabricated/placeholder clip.
 */
async function generateBRoll(prompt) {
  try {
    const result = await generateBRollVideo(prompt);
    if (result && result.status === 'ready' && result.url) {
      return {
        id: result.jobId || 'gen-broll',
        url: result.url,
        title: `AI Generated: ${prompt}`,
        isGenerative: true,
        provider: 'replicate',
      };
    }
    // unavailable / processing / error → no honest clip to return.
    logger.info('Generative B-roll not available; skipping suggestion', { status: result && result.status });
    return null;
  } catch (error) {
    logger.error('Generative video generation failed', { error: error.message, prompt });
    return null;
  }
}

module.exports = {
  generateBRoll
};
