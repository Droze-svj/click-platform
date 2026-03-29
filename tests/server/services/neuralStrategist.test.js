const liveTrendService = require('../../../server/services/liveTrendService');
const generativeAssetService = require('../../../server/services/generativeAssetService');
const { isConfigured: geminiConfigured } = require('../../../server/utils/googleAI');

describe('Neural Strategist Suite', () => {

  describe('Live Trend Service', () => {
    it('should fetch simulate trends for March 2026', async () => {
      const trends = await liveTrendService.getLatestTrends('tiktok');
      expect(trends).toBeDefined();
      expect(Array.isArray(trends)).toBe(true);
      if (trends.length > 0) {
        expect(trends[0].tag || trends[0].topic || trends[0].trend).toBeDefined();
      }
    });

    it('should generate a trend strategy mold', async () => {
      const trends = await liveTrendService.getLatestTrends('tiktok');
      const strategy = await liveTrendService.getTrendStrategy(trends);

      expect(strategy).toBeDefined();
      expect(strategy.mold).toBeDefined();
      if (geminiConfigured) {
        expect(strategy.pacing).toBeDefined();
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
