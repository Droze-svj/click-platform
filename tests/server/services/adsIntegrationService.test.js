// No paid-ads integration exists. launchTestAd used to resolve a fabricated
// `ad_<timestamp>` id after a 1.5s sleep, so the editor announced "Ad live!"
// when nothing had been created. It must now fail honestly (501).

const fs = require('fs');
const path = require('path');
const { launchTestAd, NOT_CONFIGURED_MESSAGE } = require('../../../server/services/adsIntegrationService');

describe('adsIntegrationService', () => {
  it('rejects with a 501 not-configured error instead of a fake ad id', async () => {
    await expect(launchTestAd('vid-1', 'tiktok', 5)).rejects.toMatchObject({
      statusCode: 501,
      code: 'ADS_NOT_CONFIGURED',
      message: NOT_CONFIGURED_MESSAGE,
    });
  });

  it('the launch-test-ad route maps that error to a 501 response', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/video/advanced.js'), 'utf8');
    const block = src.slice(src.indexOf("router.post('/launch-test-ad'"), src.indexOf("router.post('/launch-test-ad'") + 800);
    expect(block).toMatch(/ADS_NOT_CONFIGURED/);
    expect(block).toMatch(/status\(501\)/);
  });
});
