/**
 * Integration test for Viral Pipeline Phase 2
 */

const { runViralPipeline } = require('../../server/services/viralPipelineService');
const Content = require('../../server/models/Content');
const mongoose = require('mongoose');

// Mock dependencies
jest.mock('../../server/services/videoCaptionService', () => ({
  generateCaptionsForContent: jest.fn().mockResolvedValue({
    transcript: 'Hello and welcome to this video about AI. It is going to be amazing!',
    segments: [],
    words: []
  })
}));

jest.mock('../../server/services/aiVideoEditingService', () => ({
  autoEditVideo: jest.fn().mockResolvedValue({
    success: true,
    editedVideoUrl: '/uploads/videos/edited-test.mp4',
    editedVideoPath: '/abs/path/to/edited-test.mp4'
  }),
  exportMultipleFormats: jest.fn().mockResolvedValue({
    exports: [
      { format: '1:1', url: '/uploads/videos/test-1x1.mp4' },
      { format: '16:9', url: '/uploads/videos/test-16x9.mp4' }
    ]
  })
}));

jest.mock('../../server/services/competitiveBenchmarkingService', () => ({
  getCompetitiveBenchmarks: jest.fn().mockResolvedValue({
    industry: { median: 100 },
    recommendations: [{ title: 'Test Rec' }]
  })
}));

jest.mock('../../server/services/thumbnailService', () => ({
  generateThumbnail: jest.fn().mockResolvedValue('/uploads/thumbnails/test.jpg')
}));

jest.mock('../../server/utils/imageOptimizer', () => ({
  optimizeImage: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../server/services/socketService', () => ({
  emitToUser: jest.fn()
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                hookStrength: 95,
                viralPotential: 88,
                hookType: 'question',
                rewrites: ['Option 1', 'Option 2'],
                directives: []
              })
            }
          }]
        })
      }
    }
  }));
});

jest.mock('../../server/models/Content');

describe('Viral Pipeline Phase 2 Integration', () => {
  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    id: 'user123'
  };

  it('orchestrates benchmarking and multi-format rendering', async () => {
    const mockContentId = new mongoose.Types.ObjectId().toString();
    const mockContent = {
      _id: mockContentId,
      originalFile: {
        url: '/uploads/videos/original.mp4',
        duration: 30
      },
      metadata: {},
      generatedContent: {},
      status: 'processing',
      save: jest.fn().mockResolvedValue(true)
    };

    Content.findById = jest.fn().mockResolvedValue(mockContent);

    const result = await runViralPipeline(mockContentId, '/path/to/video.mp4', mockUser, {
      aspectRatios: ['9:16', '1:1'],
      enableBenchmarking: true
    });

    expect(result.success).toBe(true);
    expect(mockContent.metadata.performanceForecast).toBeDefined();
    expect(mockContent.metadata.performanceForecast.percentileRank).toBe('Top 10%');
    expect(mockContent.generatedContent.alternates).toHaveLength(2);
    expect(mockContent.status).not.toBe('failed');
  });
});
