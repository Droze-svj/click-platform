const logger = require('../utils/logger');

/**
 * Direct-to-Ads integration.
 *
 * Click is NOT connected to any paid-ads platform (no TikTok Ads / Meta Ads
 * credentials, OAuth scopes or campaign API client exist). This used to resolve
 * a made-up `ad_<timestamp>` id after a 1.5s sleep, so the editor told creators
 * "Ad live! Monitoring ROI…" when nothing had been launched and no money could
 * ever be spent or tracked. It now fails honestly with a 501 until a real
 * integration is built.
 */

class AdsNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdsNotConfiguredError';
    this.statusCode = 501;
    this.code = 'ADS_NOT_CONFIGURED';
  }
}

const NOT_CONFIGURED_MESSAGE =
  "Ad campaigns aren't available: Click isn't connected to TikTok Ads or Meta Ads, so no ad was created.";

async function launchTestAd(videoId, platform = 'tiktok', budget = 5) {
  logger.info('Test ad requested but no ads integration is configured', { videoId, platform, budget });
  throw new AdsNotConfiguredError(NOT_CONFIGURED_MESSAGE);
}

module.exports = {
  launchTestAd,
  AdsNotConfiguredError,
  NOT_CONFIGURED_MESSAGE,
};
