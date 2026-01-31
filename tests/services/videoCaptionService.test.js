// Unit tests for videoCaptionService

const videoCaptionService = require('../../server/services/videoCaptionService');
const Content = require('../../server/models/Content');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../../server/models/Content');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn(),
      },
    },
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('Video Caption Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatCaptions', () => {
    it('should format captions as SRT', () => {
      const transcript = {
        segments: [
          { start: 0, end: 5, text: 'Hello world' },
          { start: 5, end: 10, text: 'This is a test' },
        ],
        text: 'Hello world This is a test',
      };

      const result = videoCaptionService.formatCaptions(transcript, 'srt');
      
      expect(result).toContain('1\n');
      expect(result).toContain('Hello world');
      expect(result).toContain('2\n');
      expect(result).toContain('This is a test');
    });

    it('should format captions as VTT', () => {
      const transcript = {
        segments: [
          { start: 0, end: 5, text: 'Hello world' },
        ],
        text: 'Hello world',
      };

      const result = videoCaptionService.formatCaptions(transcript, 'vtt');
      
      expect(result).toContain('WEBVTT');
      expect(result).toContain('Hello world');
    });

    it('should format captions as SSA', () => {
      const transcript = {
        segments: [
          { start: 0, end: 5, text: 'Hello world' },
        ],
        text: 'Hello world',
      };

      const result = videoCaptionService.formatCaptions(transcript, 'ssa');
      
      expect(result).toContain('[Script Info]');
      expect(result).toContain('Hello world');
    });
  });

  describe('generateCaptionsForContent', () => {
    it('should generate captions and save to content', async () => {
      const contentId = 'test-content-id';
      const videoFilePath = '/path/to/video.mp4';
      const mockTranscript = {
        text: 'Test transcript',
        language: 'en',
        duration: 10,
        segments: [{ start: 0, end: 10, text: 'Test transcript' }],
        words: [],
      };

      // Mock OpenAI response
      const OpenAI = require('openai');
      const openaiInstance = new OpenAI();
      openaiInstance.audio.transcriptions.create.mockResolvedValue(mockTranscript);

      // Mock Content model
      Content.findByIdAndUpdate.mockResolvedValue({ _id: contentId });

      const result = await videoCaptionService.generateCaptionsForContent(
        contentId,
        videoFilePath,
        { language: 'en', format: 'srt' }
      );

      expect(result).toBeDefined();
      expect(result.contentId).toBe(contentId);
      expect(result.transcript).toBe('Test transcript');
      expect(Content.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('getCaptions', () => {
    it('should get captions for content', async () => {
      const contentId = 'test-content-id';
      const mockContent = {
        _id: contentId,
        captions: {
          text: 'Test transcript',
          language: 'en',
          format: 'srt',
          formatted: '1\n00:00:00,000 --> 00:00:10,000\nTest transcript',
          segments: [{ start: 0, end: 10, text: 'Test transcript' }],
        },
      };

      Content.findById.mockResolvedValue(mockContent);

      const result = await videoCaptionService.getCaptions(contentId, 'srt');

      expect(result).toBeDefined();
      expect(result.text).toBe('Test transcript');
      expect(result.language).toBe('en');
      expect(result.format).toBe('srt');
    });

    it('should throw error if content not found', async () => {
      Content.findById.mockResolvedValue(null);

      await expect(
        videoCaptionService.getCaptions('invalid-id', 'srt')
      ).rejects.toThrow('Content not found');
    });
  });
});
