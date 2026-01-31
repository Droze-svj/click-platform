// Unit tests for predictionService

const predictionService = require('../../server/services/predictionService');
const ContentPerformance = require('../../server/models/ContentPerformance');
const ScheduledPost = require('../../server/models/ScheduledPost');

// Mock dependencies
jest.mock('../../server/models/ContentPerformance');
jest.mock('../../server/models/ScheduledPost');
jest.mock('../../server/services/cacheService', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

describe('Prediction Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('predictContentPerformance', () => {
    it('should predict performance with historical data', async () => {
      const contentId = 'test-content-id';
      const contentData = {
        userId: 'user-id',
        type: 'video',
        category: 'general',
        title: 'Test Video Title',
        description: 'This is a test description',
        tags: ['test', 'video'],
      };

      const mockHistoricalData = [
        { views: 1000, engagement: 100, reach: 800 },
        { views: 1500, engagement: 150, reach: 1200 },
      ];

      ContentPerformance.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockHistoricalData),
      });

      const { get } = require('../../server/services/cacheService');
      get.mockResolvedValue(null); // No cache

      const result = await predictionService.predictContentPerformance(contentId, contentData);

      expect(result).toBeDefined();
      expect(result.estimatedViews).toBeDefined();
      expect(result.estimatedEngagement).toBeDefined();
      expect(result.estimatedReach).toBeDefined();
      expect(result.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.performanceScore).toBeLessThanOrEqual(100);
      expect(result.recommendations).toBeDefined();
    });

    it('should return cached prediction if available', async () => {
      const contentId = 'test-content-id';
      const cachedPrediction = {
        estimatedViews: { expected: 1000 },
        estimatedEngagement: { expected: 100 },
        performanceScore: 75,
      };

      const { get } = require('../../server/services/cacheService');
      get.mockResolvedValue(cachedPrediction);

      const result = await predictionService.predictContentPerformance(contentId, {});

      expect(result).toEqual(cachedPrediction);
      expect(ContentPerformance.find).not.toHaveBeenCalled();
    });
  });

  describe('predictAudienceGrowth', () => {
    it('should predict audience growth', async () => {
      const userId = 'user-id';
      const days = 30;

      const mockPosts = [
        {
          scheduledTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          analytics: { reach: 1000 },
        },
        {
          scheduledTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          analytics: { reach: 1500 },
        },
      ];

      ScheduledPost.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPosts),
      });

      const result = await predictionService.predictAudienceGrowth(userId, days);

      expect(result).toBeDefined();
      expect(result.current).toBeGreaterThanOrEqual(0);
      expect(result.predicted).toBeGreaterThanOrEqual(0);
      expect(result.growthRate).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });

  describe('getHistoricalPerformance', () => {
    it('should calculate averages from historical data', async () => {
      const contentData = {
        userId: 'user-id',
        type: 'video',
      };

      const mockData = [
        { views: 1000, engagement: 100, reach: 800 },
        { views: 2000, engagement: 200, reach: 1600 },
      ];

      ContentPerformance.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockData),
      });

      const result = await predictionService.getHistoricalPerformance(contentData);

      expect(result.count).toBe(2);
      expect(result.avgViews).toBe(1500);
      expect(result.avgEngagement).toBe(150);
      expect(result.avgReach).toBe(1200);
    });

    it('should return zeros if no historical data', async () => {
      ContentPerformance.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const result = await predictionService.getHistoricalPerformance({});

      expect(result.count).toBe(0);
      expect(result.avgViews).toBe(0);
      expect(result.avgEngagement).toBe(0);
      expect(result.avgReach).toBe(0);
    });
  });
});
