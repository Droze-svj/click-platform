/**
 * Foundation Social Media Service
 * Unified dispatcher for platform-specific publishing with per-platform
 * validation, retry-with-backoff on transient failures, and honest error
 * propagation (no silent mock-success).
 */

const logger = require('../utils/logger');
const OAuthService = require('./OAuthService');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

// Per-platform constraints. Captions over the limit produce a warning and are
// truncated; videos outside duration bounds produce a hard validation error
// before any upload attempt — the platforms reject these post-upload anyway,
// so failing fast saves bandwidth and avoids burning rate-limit budget.
const PLATFORM_RULES = {
  twitter: { maxCaption: 280,  videoMinSec: 0.5, videoMaxSec: 140, requiresMedia: false, aspect: 'any' },
  x:       { maxCaption: 280,  videoMinSec: 0.5, videoMaxSec: 140, requiresMedia: false, aspect: 'any' },
  tiktok:  { maxCaption: 2200, videoMinSec: 3,   videoMaxSec: 600, requiresMedia: true,  aspect: '9:16' },
  youtube: { maxCaption: 5000, videoMinSec: 1,   videoMaxSec: 43200, requiresMedia: true, aspect: 'any' },
  instagram: { maxCaption: 2200, videoMinSec: 3, videoMaxSec: 90,  requiresMedia: true, aspect: '9:16' },
  linkedin:  { maxCaption: 3000, videoMinSec: 3, videoMaxSec: 600, requiresMedia: false, aspect: 'any' },
  facebook:  { maxCaption: 63206, videoMinSec: 1, videoMaxSec: 14400, requiresMedia: false, aspect: 'any' },
};

// Normalize the two caller shapes we accept in this codebase:
//   - { text, mediaUrl, hashtags } (scheduler / public route)
//   - { title, description, mediaUrl, tags } (videoSharing)
// Returned object always carries title/description/mediaUrl/tags so the
// platform-specific services see a single shape.
function normalizeContent(input) {
  const tags = input.tags || input.hashtags || [];
  if (input.title || input.description) {
    return {
      title: input.title || '',
      description: input.description || input.text || '',
      mediaUrl: input.mediaUrl || '',
      tags,
      durationSec: input.durationSec || null,
    };
  }
  const text = input.text || '';
  const firstLine = text.split('\n')[0] || '';
  return {
    title: firstLine.slice(0, 100),
    description: text,
    mediaUrl: input.mediaUrl || '',
    tags,
    durationSec: input.durationSec || null,
  };
}

function validateForPlatform(platform, content) {
  const rules = PLATFORM_RULES[platform.toLowerCase()];
  if (!rules) return { valid: true, warnings: [], content };

  const warnings = [];
  const adapted = { ...content };

  const caption = `${content.title ? content.title + '\n\n' : ''}${content.description || ''}`;
  if (caption.length > rules.maxCaption) {
    warnings.push(`Caption truncated from ${caption.length} to ${rules.maxCaption} chars for ${platform}`);
    if (content.title && content.description) {
      const room = rules.maxCaption - content.title.length - 2;
      adapted.description = room > 0 ? content.description.slice(0, room) : '';
    } else {
      adapted.description = caption.slice(0, rules.maxCaption);
      adapted.title = '';
    }
  }

  if (rules.requiresMedia && !content.mediaUrl) {
    return { valid: false, error: `${platform} requires a media URL`, warnings, content: adapted };
  }

  if (content.durationSec != null) {
    if (content.durationSec < rules.videoMinSec) {
      return {
        valid: false,
        error: `Video too short for ${platform}: ${content.durationSec}s < ${rules.videoMinSec}s minimum`,
        warnings,
        content: adapted,
      };
    }
    if (content.durationSec > rules.videoMaxSec) {
      return {
        valid: false,
        error: `Video too long for ${platform}: ${content.durationSec}s > ${rules.videoMaxSec}s maximum`,
        warnings,
        content: adapted,
      };
    }
  }

  return { valid: true, warnings, content: adapted };
}

// Treat 429 / 5xx and explicit "rate limit" / "timeout" / "ECONNRESET" as retryable.
function isRetryableError(error) {
  const msg = (error && error.message) || '';
  if (/rate.?limit|429|too many requests/i.test(msg)) return true;
  if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(msg)) return true;
  const status = error?.response?.status || error?.statusCode;
  if (status && status >= 500) return true;
  if (status === 429) return true;
  return false;
}

async function dispatchToPlatform(platform, finalAuth, contentData) {
  switch (platform.toLowerCase()) {
  case 'tiktok':
    return require('./TikTokSocialService').postToTikTok(finalAuth, contentData);
  case 'youtube':
    return require('./YouTubeSocialService').uploadToYouTube(finalAuth, contentData);
  case 'twitter':
  case 'x':
    return require('./TwitterSocialService').postTweet(finalAuth, contentData);
  case 'instagram':
    return postToInstagram(finalAuth, contentData);
  default:
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Main posting function to dispatch to platform-specific handlers.
 * Accepts the legacy `contentData` shapes (see normalizeContent).
 */
async function postToSocialMedia(userId, platform, contentData, options = {}) {
  const Content = require('../models/Content');
  const contentId = options.contentId || null;
  const normalized = normalizeContent(contentData);

  try {
    logger.info(`Dispatching post to ${platform}`, { userId, contentId, hasMedia: !!normalized.mediaUrl });

    const validation = validateForPlatform(platform, normalized);
    if (!validation.valid) {
      logger.warn(`Pre-publish validation failed for ${platform}`, { userId, error: validation.error });
      return { success: false, platform, error: validation.error, warnings: validation.warnings };
    }
    const adaptedContent = validation.content;

    const authData = await OAuthService.getSocialCredentials(userId, platform);
    if (!authData) {
      if (process.env.MOCK_PUBLISHING === '1') {
        logger.warn(`No OAuth for ${platform} but MOCK_PUBLISHING=1 — using stub token`);
      } else {
        throw new Error(`Account not linked for platform: ${platform}`);
      }
    }
    const finalAuth = authData || { accessToken: 'mock-token' };

    const result = await retryWithBackoff(
      () => dispatchToPlatform(platform, finalAuth, adaptedContent),
      {
        maxRetries: 3,
        initialDelay: 1500,
        maxDelay: 15000,
        onRetry: (attempt, delay, error) => {
          if (!isRetryableError(error)) {
            // Throw immediately — retryWithBackoff doesn't honor this signal,
            // so we re-throw so it falls through to the catch.
            throw error;
          }
          logger.warn(`Retrying ${platform} publish (${attempt}) after ${delay}ms: ${error.message}`);
        },
      }
    );

    if (contentId) {
      await Content.findByIdAndUpdate(contentId, {
        $push: {
          'generatedContent.socialPosts': {
            platform,
            content: adaptedContent.description,
            hashtags: adaptedContent.tags,
            mediaUrl: adaptedContent.mediaUrl,
            externalId: result.id,
            postUrl: result.url,
            postedAt: new Date(),
          },
        },
      });
      logger.info('Content model updated with social post result', { contentId, platform });
    }

    return {
      success: true,
      platform,
      platformPostId: result.id,
      externalId: result.id,
      postUrl: result.url,
      url: result.url,
      mocked: !!result.mocked,
      warnings: validation.warnings,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error(`Social post failed for ${platform}`, { userId, contentId, error: error.message });
    return { success: false, platform, error: error.message };
  }
}

// Backwards-compatible alias for older callers (videoSharing.js).
async function postToSocial(userId, platform, contentData, contentId = null) {
  return postToSocialMedia(userId, platform, contentData, { contentId });
}

async function postToInstagram(auth, content) {
  if (process.env.MOCK_PUBLISHING === '1') {
    logger.warn('Instagram publish mocked via MOCK_PUBLISHING=1');
    return { id: `ig_mock_${Date.now()}`, url: 'https://instagram.com/reel/dummy', mocked: true };
  }
  // Real Graph-API publishing requires container creation + media publish steps;
  // not yet implemented. Fail honestly instead of returning a fake post URL.
  throw new Error('Instagram publishing is not yet implemented. Set MOCK_PUBLISHING=1 to simulate.');
}

/**
 * Synchronize social insights for a user across all connected platforms
 */
async function syncSocialInsights(userId) {
  try {
    const connectedAccounts = await OAuthService.getConnectedSocials(userId);
    const results = {};

    for (const platform of connectedAccounts) {
      try {
        const authData = await OAuthService.getSocialCredentials(userId, platform);
        let insights;

        switch (platform.toLowerCase()) {
        case 'youtube':
          insights = await require('./YouTubeSocialService').getChannelInsights(authData);
          break;
        case 'tiktok':
          insights = await require('./TikTokSocialService').getProfileInsights(authData);
          break;
        case 'twitter':
        case 'x':
          insights = await require('./TwitterSocialService').getUserInsights(authData);
          break;
        default:
          logger.warn(`Insights sync not supported for platform: ${platform}`);
          continue;
        }

        results[platform] = insights;
      } catch (err) {
        logger.error(`Failed to sync insights for ${platform}`, { userId, error: err.message });
      }
    }

    return {
      success: true,
      lastSync: new Date(),
      results
    };
  } catch (error) {
    logger.error('Global social sync failed', { userId, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  postToSocialMedia,
  postToSocial,
  syncSocialInsights,
  validateForPlatform,
  PLATFORM_RULES,
};
