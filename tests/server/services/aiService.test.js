const aiService = require('../../../server/services/aiService');
const googleAI = require('../../../server/utils/googleAI');

// Mock dependencies
jest.mock('../../../server/utils/googleAI', () => ({
  generateContent: jest.fn(),
  isConfigured: true,
}));

jest.mock('../../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sovereign JSON Purifier', () => {
    // Note: safeJsonParse is private but we test it via methods that use it
    // or we can test it directly if we exported it.
    // Since it's not exported, we test detectHighlights which uses it.

    it('should correctly parse JSON even if wrapped in markdown', async () => {
      googleAI.generateContent.mockResolvedValue('```json\n{"highlights": [{"startTime": 10, "text": "Hook"}]}\n```');
      
      const result = await aiService.detectHighlights('test script', 60);
      
      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe(10);
    });

    it('should return fallback if JSON parsing fails', async () => {
      googleAI.generateContent.mockResolvedValue('Invalid JSON');
      
      const result = await aiService.detectHighlights('test script', 100);
      
      // Fallback generates 5 highlights
      expect(result).toHaveLength(5);
    });
  });

  describe('generateCaptions', () => {
    it('should generate a caption using Gemini', async () => {
      googleAI.generateContent.mockResolvedValue('Cinematic Masterpiece! #vibes');
      
      const result = await aiService.generateCaptions('Video of a sunset', 'lifestyle');
      
      expect(result).toBe('Cinematic Masterpiece! #vibes');
      expect(googleAI.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('lifestyle'),
        expect.any(Object)
      );
    });
  });

  describe('The Cliche Shield', () => {
    // Test viral idea generation which uses the cliche shield
    it('should replace cliches with high-impact alternatives', async () => {
      googleAI.generateContent.mockResolvedValue(JSON.stringify({
        ideas: [{
          title: 'This is a game-changer for your niche',
          description: 'Level up your game seamlessly'
        }]
      }));
      
      // Mock other dependencies used by generateViralIdeas
      jest.mock('../../../server/services/predictionService', () => ({
        ingestMarketTrends: jest.fn().mockResolvedValue({ trendingTopics: [] })
      }), { virtual: true });

      const result = await aiService.generateViralIdeas('topic', 'niche');
      
      if (result.length > 0) {
        expect(result[0].title).toContain('paradigm shift');
        expect(result[0].description).toContain('strategic evolution');
      }
    });
  });
});
