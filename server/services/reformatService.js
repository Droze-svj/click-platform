/**
 * Multi-Platform Reformatter
 *
 * Takes one source video + a list of target platforms and returns a
 * reformat plan per platform: aspect-ratio crop plan from
 * creativeToolsService.autoReframe + niche-aware caption/hook copy
 * regenerated for each platform's CTA library and retention curve.
 *
 * Why niche-aware: the same video on TikTok wants a punchy 3-second
 * curiosity-gap hook and a "save it before it disappears" CTA;
 * LinkedIn wants an analytical opener and a "what's your take in the
 * comments" CTA. This service produces both, not the same caption pasted
 * across platforms.
 */

const logger = require('../utils/logger');
const Content = require('../models/Content');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');
const creativeTools = require('./creativeToolsService');

const PLATFORM_TO_ASPECT = {
  tiktok: '9:16',
  reels: '9:16',
  shorts: '9:16',
  instagram: '4:5',
  youtube: '16:9',
  twitter: '16:9',
  linkedin: '16:9',
};

async function reformatForPlatform(content, platform, niche, language) {
  // Per-platform crop plan via creativeTools.
  const aspect = PLATFORM_TO_ASPECT[platform] || '9:16';
  let cropPlan = null;
  try {
    const reframe = await creativeTools.autoReframe(content._id?.toString?.() || content.id, aspect);
    cropPlan = reframe.plan;
  } catch (err) {
    logger.warn('[Reformat] autoReframe failed', { platform, error: err.message });
  }

  // Per-platform copy regen via aiRouter + buildSystemPrompt.
  const systemPrompt = buildSystemPrompt({
    persona: 'caption-writer',
    niche,
    platform,
    stage: 'repurpose',
    language,
    extra: `Return strict JSON only. Match the ${platform} CTA library and 3-second retention curve. Do not just shorten the source — rewrite for platform fit.`,
  });
  const userPrompt = [
    `── Task ──`,
    `Adapt this post for ${platform}. Original niche: ${niche}.`,
    ``,
    `Title: ${content.title || ''}`,
    `Body / transcript (truncated 1500 chars):`,
    (content.body || (content.transcript?.fullText || '')).slice(0, 1500),
    ``,
    `Return JSON exactly:`,
    `{`,
    `  "title": "platform-fit title",`,
    `  "hook": "3-second opener tuned to ${platform}",`,
    `  "caption": "full caption rewritten for ${platform}",`,
    `  "hashtags": ["#tag1", "#tag2"],`,
    `  "cta": "platform-tuned CTA",`,
    `  "format": "post|carousel|video|thread"`,
    `}`,
  ].join('\n');

  const fallback = {
    title: content.title || `Adapted for ${platform}`,
    hook: 'Watch this',
    caption: (content.body || '').slice(0, 280),
    hashtags: [],
    cta: platform === 'linkedin' ? 'What\'s your take?' : 'Save this for later',
    format: 'post',
  };

  const copy = await aiCallJson(userPrompt, fallback, {
    systemPrompt,
    taskType: 'reformat-platform-copy',
    maxTokens: 1200,
    temperature: 0.6,
  });

  return {
    platform,
    aspect,
    cropPlan,
    copy: copy || fallback,
  };
}

/**
 * @param {string} contentId
 * @param {string[]} targets   e.g. ['tiktok','linkedin','youtube']
 * @param {object} ctx { niche, language }
 */
async function reformatToPlatforms(contentId, targets, ctx = {}) {
  const content = await Content.findById(contentId).lean().catch(() => null);
  if (!content) return { ok: false, error: 'content-not-found' };

  const niche = ctx.niche || content.niche || 'business';
  const language = ctx.language || content.language || 'en';
  const list = (targets || []).filter(t => typeof t === 'string').slice(0, 6);

  if (list.length === 0) return { ok: false, error: 'no-targets' };

  const results = await Promise.all(list.map(async (p) => {
    try {
      return await reformatForPlatform(content, p, niche, language);
    } catch (err) {
      logger.warn('[Reformat] platform failed', { platform: p, error: err.message });
      return { platform: p, error: err.message };
    }
  }));

  return {
    ok: true,
    contentId,
    niche,
    language,
    results,
  };
}

module.exports = { reformatToPlatforms, reformatForPlatform };
