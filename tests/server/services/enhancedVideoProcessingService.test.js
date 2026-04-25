const enhancedVideoProcessingService = require('../../../server/services/enhancedVideoProcessingService');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Mock dependencies
jest.mock('../../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  writeFileSync: jest.fn(),
}));

jest.mock('fluent-ffmpeg', () => {
  const mFfmpeg = jest.fn(() => ({
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    videoFilters: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    input: jest.fn().mockReturnThis(),
    on: jest.fn(function(event, cb) {
      if (event === 'end') {
        setTimeout(cb, 0);
      }
      return this;
    }),
    run: jest.fn(),
    kill: jest.fn(),
  }));
  return mFfmpeg;
});

describe('EnhancedVideoProcessingService', () => {
  const mockVideoPath = '/tmp/test-video.mp4';
  const mockAudioPath = '/tmp/test-audio.mp3';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addTextOverlays', () => {
    it('should successfully add text overlays', async () => {
      const textOverlays = [
        { text: 'Hello', x: 50, y: 50, startTime: 0, endTime: 5 }
      ];
      
      const result = await enhancedVideoProcessingService.addTextOverlays(mockVideoPath, textOverlays);
      
      expect(result.resultUrl).toContain('text-overlay-');
      expect(ffmpeg).toHaveBeenCalledWith(mockVideoPath);
    });

    it('should handle FFmpeg errors', async () => {
      // Setup mock to emit error
      ffmpeg.mockImplementationOnce(() => ({
        output: jest.fn().mockReturnThis(),
        outputOptions: jest.fn().mockReturnThis(),
        on: jest.fn(function(event, cb) {
          if (event === 'error') {
            setTimeout(() => cb(new Error('FFmpeg processing failed')), 0);
          }
          return this;
        }),
        run: jest.fn(),
        complexFilter: jest.fn().mockReturnThis(),
      }));

      const textOverlays = [{ text: 'Fail' }];
      await expect(enhancedVideoProcessingService.addTextOverlays(mockVideoPath, textOverlays))
        .rejects.toThrow('FFmpeg processing failed');
    });
  });

  describe('applyVideoFilters', () => {
    it('should apply simple filters correctly', async () => {
      const filters = { brightness: 110, contrast: 120 };
      const result = await enhancedVideoProcessingService.applyVideoFilters(mockVideoPath, filters);
      
      expect(result.resultUrl).toContain('filtered-');
      expect(result.filters).toEqual(filters);
    });
  });

  describe('addAudioToVideo', () => {
    it('should mix audio and video', async () => {
      const result = await enhancedVideoProcessingService.addAudioToVideo(mockVideoPath, mockAudioPath, { volume: 75 });
      
      expect(result.resultUrl).toContain('with-audio-');
      expect(result.audioVolume).toBe(75);
    });
  });

  describe('cropVideo', () => {
    it('should crop video based on area', async () => {
      const cropArea = { x: 10, y: 10, width: 80, height: 80 };
      const result = await enhancedVideoProcessingService.cropVideo(mockVideoPath, cropArea);
      
      expect(result.resultUrl).toContain('cropped-');
      expect(result.cropArea).toEqual(cropArea);
    });
  });

  describe('splitAndMergeVideo', () => {
    it('should merge multiple segments', async () => {
      const segments = [
        { start: 0, end: 5 },
        { start: 10, end: 15 }
      ];
      const result = await enhancedVideoProcessingService.splitAndMergeVideo(mockVideoPath, segments);
      
      expect(result.resultUrl).toContain('split-merge-');
      expect(result.segments).toEqual(segments);
    });
  });
});
