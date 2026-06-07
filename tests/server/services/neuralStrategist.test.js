const liveTrendService = require('../../../server/services/liveTrendService');
const generativeAssetService = require('../../../server/services/generativeAssetService');
const { isConfigured: geminiConfigured } = require('../../../server/utils/googleAI');

describe('Neural Strategist Suite', () => {

  describe('Live Trend Service', () => {
    it('should return structured live trends (honest empty when unconfigured)', async () => {
      // New shape: real, web-grounded structured trends
      // { platform, niche, sounds[], hashtags[], topics[], citations[], source }.
      // No provider configured (CI) → honest source:'unavailable' with empty arrays;
      // never the old hardcoded mock presented as real.
      const trends = await liveTrendService.getLatestTrends('tiktok');
      expect(trends).toBeDefined();
      expect(Array.isArray(trends.sounds)).toBe(true);
      expect(Array.isArray(trends.hashtags)).toBe(true);
      expect(Array.isArray(trends.topics)).toBe(true);
      expect(trends.source).toBeDefined();
    });

    it('should generate a real trend strategy mold, or honestly report none', async () => {
      const trends = await liveTrendService.getLatestTrends('tiktok');
      const strategy = await liveTrendService.getTrendStrategy(trends);

      expect(strategy).toBeDefined();
      // No fabrication: when neither Claude nor Gemini is configured, an honest
      // { ok:false, error } is returned instead of a fake mold.
      if (strategy.ok === false) {
        expect(strategy.error).toBeDefined();
      } else {
        expect(strategy.mold).toBeDefined();
        if (geminiConfigured) {
          expect(strategy.pacing).toBeDefined();
        }
      }
    });
  });

  describe('Generative Asset Service', () => {
    it('should refine a simple B-roll prompt', async () => {
      const original = 'a fast car';
      const refined = await generativeAssetService.refineBRollPrompt(original);

      expect(refined).toBeDefined();
      if (geminiConfigured) {
        expect(refined.length).toBeGreaterThan(original.length);
      }
    });

    it('should generate magic B-roll with refined prompts', async () => {
      const result = await generativeAssetService.magicBRollFill('cyberpunk city');

      expect(result.status).toBe('minted');
      expect(result.refinedPrompt).toBeDefined();
      expect(result.url).toContain('.mp4');
      expect(result.metadata.engine).toBe('neural-video-v2');
    });
  });

});
