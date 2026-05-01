const aiService = require('./aiService');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

const TOP_PERFORMER_LIMIT = parseInt(process.env.METADATA_TOP_PERFORMER_LIMIT || '5', 10);
const TOP_PERFORMER_LOOKBACK_DAYS = parseInt(process.env.METADATA_TOP_PERFORMER_LOOKBACK_DAYS || '180', 10);

/**
 * Pull a user's recent top-performing posts on a given platform, sorted by
 * a real engagement-rate signal (engagement / reach), so we can show the
 * model what the user's audience has actually responded to.
 *
 * Returns [] when there isn't enough real data — the caller MUST handle the
 * empty case rather than fabricate examples.
 */
async function getTopPerformersDigest(userId, platform) {
  if (!userId) return [];
  try {
    const since = new Date(Date.now() - TOP_PERFORMER_LOOKBACK_DAYS * 86400000);
    const posts = await ScheduledPost.find({
      userId,
      platform,
      status: 'posted',
      postedAt: { $gte: since },
      'analytics.engagement': { $gt: 0 },
    })
      .select('content analytics postedAt')
      .lean();

    if (!posts.length) return [];

    const ranked = posts
      .map(p => {
        const reach = p.analytics?.reach || p.analytics?.impressions || 0;
        const engagement = p.analytics?.engagement || 0;
        const rate = reach > 0 ? engagement / reach : engagement;
        return {
          text: (p.content?.text || '').slice(0, 240),
          views: p.analytics?.views || p.analytics?.impressions || 0,
          engagement,
          rate,
        };
      })
      .filter(p => p.text)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, TOP_PERFORMER_LIMIT);

    return ranked;
  } catch (err) {
    logger.warn('Top-performer digest lookup failed', { userId, platform, error: err.message });
    return [];
  }
}

/**
 * Render the digest as a short prompt fragment. Returns '' when empty so
 * downstream prompts cleanly degrade to transcript-only generation.
 */
function formatDigestForPrompt(digest, platformLabel) {
  if (!digest.length) return '';
  const lines = digest
    .map((p, i) => `  ${i + 1}. (${p.views.toLocaleString()} views, eng-rate ${(p.rate * 100).toFixed(2)}%) "${p.text.replace(/\s+/g, ' ').trim()}"`)
    .join('\n');
  return `\n\nThe user's recent ${platformLabel} winners (mimic the patterns that worked, do not copy verbatim):\n${lines}`;
}

class SocialAiService {
  /**
   * Generate metadata for all supported platforms.
   *
   * @param {string} transcript
   * @param {string} niche
   * @param {string} tone
   * @param {object} options
   * @param {string} [options.userId] — when provided, the user's real top-performing
   *   posts on each platform are folded into the prompts as exemplars.
   */
  async generateUniversalMetadata(transcript, niche, tone = 'energetic', options = {}) {
    try {
      const userId = options.userId || null;
      logger.info('Commencing Universal Social Metadata Synthesis', { niche, tone, hasHistory: !!userId });

      const [yt, tt, tw] = userId ? await Promise.all([
        getTopPerformersDigest(userId, 'youtube'),
        getTopPerformersDigest(userId, 'tiktok'),
        getTopPerformersDigest(userId, 'twitter'),
      ]) : [[], [], []];

      const [youtube, tiktok, twitter] = await Promise.all([
        this.generateYouTubeMetadata(transcript, niche, tone, yt),
        this.generateTikTokMetadata(transcript, niche, tone, tt),
        this.generateTwitterMetadata(transcript, niche, tone, tw),
      ]);

      return {
        youtube,
        tiktok,
        twitter,
        generatedAt: new Date(),
        signal: {
          youtubeExemplars: yt.length,
          tiktokExemplars: tt.length,
          twitterExemplars: tw.length,
        },
      };
    } catch (error) {
      logger.error('Universal Metadata Synthesis Failed', { error: error.message });
      throw error;
    }
  }

  async generateYouTubeMetadata(transcript, niche, tone, digest = []) {
    const prompt = `Generate a YouTube Shorts title and description for a video about ${niche}.
    Tone: ${tone}.
    Transcript summary: ${transcript.substring(0, 500)}.${formatDigestForPrompt(digest, 'YouTube')}
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

  async generateTikTokMetadata(transcript, niche, tone, digest = []) {
    const prompt = `Generate a TikTok caption and trending hashtags for a video about ${niche}.
    Tone: ${tone}.
    Include a hook in the first sentence.
    Transcript summary: ${transcript.substring(0, 500)}.${formatDigestForPrompt(digest, 'TikTok')}
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

  async generateTwitterMetadata(transcript, niche, tone, digest = []) {
    const prompt = `Generate a viral Twitter (X) post for a video about ${niche}.
    Tone: ${tone}.
    Keep it under 280 characters.
    Transcript summary: ${transcript.substring(0, 500)}.${formatDigestForPrompt(digest, 'Twitter')}
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
