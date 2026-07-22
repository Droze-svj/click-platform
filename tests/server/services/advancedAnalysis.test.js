const vectorMemoryService = require('../../../server/services/vectorMemoryService');
const creatorPerformanceService = require('../../../server/services/creatorPerformanceService');
const creatorDnaService = require('../../../server/services/creatorDnaService');

const googleAI = require('../../../server/utils/googleAI');
const VectorMemory = require('../../../server/models/VectorMemory');
const UserStyleProfile = require('../../../server/models/UserStyleProfile');

jest.mock('../../../server/utils/googleAI');
jest.mock('../../../server/models/VectorMemory');
jest.mock('../../../server/models/UserStyleProfile');

describe('Click Advanced memory Accuracy & analysis Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('vectorMemoryService - Custom score Matching & Filtering', () => {
    test('should apply contextual boosts for matching niche and platform', async () => {
      googleAI.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
      
      // Mock static mongoose find search
      const mockMemories = [
        {
          _id: 'memory-1',
          text: 'Make intro cuts extremely rapid',
          vector: [0.1, 0.2, 0.3],
          metadata: { niche: 'finance', platform: 'tiktok' }
        },
        {
          _id: 'memory-2',
          text: 'Use cinematic slow pans',
          vector: [0.9, 0.8, 0.7],
          metadata: { niche: 'gaming', platform: 'youtube' }
        }
      ];
      
      VectorMemory.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMemories)
      });

      const results = await vectorMemoryService.queryUserMemory('user-123', 'financial tips pacing', {
        niche: 'finance',
        platform: 'tiktok',
        minScore: 0.60
      });

      expect(results.length).toBeGreaterThan(0);
      const topResult = results[0];
      expect(topResult.id).toBe('memory-1');
      // The score has matching boosts, so it should be near 1.0 (clamped)
      expect(topResult.score).toBe(1.0);
    });

    test('should filter out memories under minScore threshold', async () => {
      googleAI.generateEmbeddings.mockResolvedValue([0.1, 0.2, 0.3]);
      
      const mockMemories = [
        {
          _id: 'memory-2',
          text: 'Use cinematic slow pans',
          vector: [-0.9, -0.8, -0.7], // highly negative similarity
          metadata: { niche: 'gaming', platform: 'youtube' }
        }
      ];
      
      VectorMemory.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMemories)
      });

      const results = await vectorMemoryService.queryUserMemory('user-123', 'financial tips pacing', {
        niche: 'finance',
        platform: 'tiktok',
        minScore: 0.80
      });

      expect(results.length).toBe(0);
    });
  });

  describe('creatorPerformanceService - Heuristic Auto-Detection', () => {
    test('should auto-detect kinetic pacing from cut duration average', () => {
      const mockContent = {
        textOverlays: [],
        metadata: {
          avgCutDuration: 1.5,
          text: 'Stop posting daily! #finance #grow'
        }
      };

      const picks = creatorPerformanceService.extractPicks(mockContent);
      
      // Should find pacing: dynamic-kinetic
      const pacingPick = picks.find(p => p.facet === 'weightedPacing');
      expect(pacingPick).toBeDefined();
      expect(pacingPick.key).toBe('dynamic-kinetic');

      // Should find hashtags: finance, grow
      const hashtags = picks.filter(p => p.facet === 'weightedHashtags');
      expect(hashtags.length).toBe(2);
      expect(hashtags.map(h => h.key)).toContain('finance');
    });

    test('should auto-detect bold-disruptor voice tone from contrarian script text', () => {
      const mockContent = {
        text: 'This is the brutal truth: Stop doing this standard approach immediately.',
        metadata: {}
      };

      const picks = creatorPerformanceService.extractPicks(mockContent);
      const tonePick = picks.find(p => p.facet === 'weightedVoiceTones');
      expect(tonePick).toBeDefined();
      expect(tonePick.key).toBe('bold-disruptor');
    });
  });

  describe('creatorDnaService - Affinity, Diffusion, & recommendations', () => {
    test('should compile aesthetic indexes and platform diffusion scores', async () => {
      const mockProfile = {
        totalPicks: 15,
        weightedFonts: [{ key: 'Inter', performanceScore: 0.15, sampleSize: 5 }],
        weightedCaptionStyles: [{ key: 'bold-kinetic', performanceScore: 0.20, sampleSize: 5 }],
        weightedHooks: [{ key: 'enemy-frame', performanceScore: 0.25, sampleSize: 5 }],
        weightedPacing: [{ key: 'dynamic-kinetic', performanceScore: 0.18, sampleSize: 5 }],
        weightedCtaCategories: [{ key: 'save', performanceScore: 0.12, sampleSize: 5 }],
        platforms: [{ key: 'tiktok', count: 12 }]
      };

      UserStyleProfile.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProfile)
      });

      const dna = await creatorDnaService.getCreatorDNA('user-123');

      expect(dna.aestheticAffinityIndex).toBeDefined();
      expect(dna.aestheticAffinityIndex.metrics.fontAffinity).toBe('+15.0%');
      expect(dna.aestheticAffinityIndex.metrics.captionAffinity).toBe('+20.0%');
      expect(dna.engagementDiffusionAnalysis.metrics.primaryPlatform).toBe('TIKTOK');
      expect(dna.neuroMarketingRecommendations.length).toBe(3);
    });
  });
});
