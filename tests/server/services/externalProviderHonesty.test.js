// Locks in the owner's #1 rule across the external-provider surface: when a
// provider/key is missing, services return an honest "unavailable/empty" state
// and NEVER a fabricated URL/result presented as real. These were live/latent
// fabricators before the audit fix.

const generativeVideoService = require('../../../server/services/generativeVideoService');
const whopMonetizationService = require('../../../server/services/whopMonetizationService');
const DubbingService = require('../../../server/services/DubbingService');
const socialPublishing = require('../../../server/services/socialPublishingService');
const stockFootage = require('../../../server/services/stockFootageService');

describe('external-provider honesty (no fabrication when unconfigured)', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('generativeVideoService.generateBRoll returns null (no fake clip) when TTV unconfigured', async () => {
    delete process.env.TTV_PROVIDER;
    delete process.env.REPLICATE_API_TOKEN;
    const r = await generativeVideoService.generateBRoll('a neon city street');
    expect(r).toBeNull();
  });

  it('whopMonetizationService.fetchWhopProducts returns an EMPTY catalog (no demo products) without a key', async () => {
    delete process.env.WHOP_API_KEY;
    const products = await whopMonetizationService.fetchWhopProducts();
    expect(Array.isArray(products)).toBe(true);
    expect(products).toHaveLength(0);
  });

  it('DubbingService.synthesizeSegment returns unavailable with NO fabricated audio url', async () => {
    const seg = { translatedText: 'hola', startTime: 0, endTime: 2 };
    const r = await DubbingService.synthesizeSegment(seg, 'es');
    expect(r.status).toBe('unavailable');
    expect(r.audioUrl).toBeNull();
  });

  it('socialPublishingService.mockSuccess returns success:false / requires_setup (no fake postId)', () => {
    const r = socialPublishing.mockSuccess('tiktok', 'not configured');
    expect(r.success).toBe(false);
    expect(r.status).toBe('requires_setup');
    expect(r.postId).toBeNull();
  });

  it('stockFootageService.getFallbackVideos returns [] (no hardcoded unrelated clip)', () => {
    expect(stockFootage.getFallbackVideos('anything')).toEqual([]);
  });
});
