/**
 * Integration test for One-Click Viral Pipeline
 */

const { runViralPipeline } = require('../../server/services/viralPipelineService');
const Content = require('../../server/models/Content');
const mongoose = require('mongoose');

jest.mock('../../server/models/Content');
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
                viralPotential: 90,
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

describe('Viral Pipeline Integration', () => {
  let contentId;
  const mockUser = {
    _id: new mongoose.Types.ObjectId(),
    id: 'user123',
    email: 'test@example.com',
    name: 'Test User'
  };

  beforeAll(async () => {
    // Connect to in-memory DB or use mocked models
    // For this demonstration, we'll mock the Content model methods
  });

  it('successfully orchestrates the viral pipeline', async () => {
    const mockContentId = new mongoose.Types.ObjectId().toString();
    const mockContent = {
      _id: mockContentId,
      originalFile: {
        url: '/uploads/videos/original.mp4',
        duration: 30
      },
      metadata: {},
      status: 'processing',
      save: jest.fn().mockResolvedValue(true)
    };

    Content.findById = jest.fn().mockResolvedValue(mockContent);

    const result = await runViralPipeline(mockContentId, '/path/to/video.mp4', mockUser);

    expect(result.success).toBe(true);
    expect(mockContent.save).toHaveBeenCalled();
    expect(mockContent.status).toBe('completed');
  });
});
