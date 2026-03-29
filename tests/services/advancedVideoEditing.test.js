const AdvancedVideoEditingService = require('../../server/services/advancedVideoEditingService');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/utils/sentry', () => ({
  captureException: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, cb) => {
    // Return mock output for silence detection
    if (cmd.includes('silencedetect')) {
      return cb(null, { stdout: 'silence_start: 2.5\nsilence_end: 4.0\n', stderr: '' });
    }
    return cb(null, { stdout: '', stderr: '' });
  }),
}));

jest.mock('fluent-ffmpeg', () => {
  const mFfmpeg = jest.fn(() => ({
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    videoFilters: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn((event, cb) => {
      if (event === 'end') setTimeout(cb, 0);
      return this;
    }),
    run: jest.fn(),
  }));
  return mFfmpeg;
});

describe('AdvancedVideoEditingService', () => {
  const mockVideoPath = '/tmp/test-video.mp4';
  const mockOutputPath = '/tmp/output-video.mp4';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('autoCutVideo', () => {
    it('should correctly build FFmpeg filters for silence removal', async () => {
      // Mock detectSilence to return some segments
      jest.spyOn(AdvancedVideoEditingService, 'detectSilence').mockResolvedValue([
        { start: 2, end: 4, duration: 2 },
      ]);
      
      // Mock fs.copyFile for "no cuts" case if needed, but here we expect cuts
      
      const result = await AdvancedVideoEditingService.autoCutVideo(mockVideoPath, mockOutputPath, {
        removeSilence: true,
      });

      expect(result.success).toBe(true);
      expect(result.segmentsRemoved).toBe(1);
    });

    it('should copy original if no segments are found to cut', async () => {
      jest.spyOn(AdvancedVideoEditingService, 'detectSilence').mockResolvedValue([]);
      jest.spyOn(fs, 'copyFile').mockResolvedValue();

      const result = await AdvancedVideoEditingService.autoCutVideo(mockVideoPath, mockOutputPath, {
        removeSilence: true,
      });

      expect(result.segmentsRemoved).toBe(0);
      expect(fs.copyFile).toHaveBeenCalled();
    });
  });

  describe('applyAdvancedEdits with Cultural Intelligence', () => {
    it('should apply tighter cut thresholds for viral goals', async () => {
      const spyAutoCut = jest.spyOn(AdvancedVideoEditingService, 'autoCutVideo').mockResolvedValue({ success: true });
      jest.spyOn(fs, 'copyFile').mockResolvedValue();
      
      await AdvancedVideoEditingService.applyAdvancedEdits(mockVideoPath, mockOutputPath, {
        autoCut: true,
        goal: 'viral',
      });

      // Check if autoCutVideo was called with tighter thresholds (as per our implementation in previous turn)
      expect(spyAutoCut).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          silenceThreshold: '-40dB',
          minSilenceDuration: 0.2
        })
      );
    });

    it('should apply standard thresholds for non-viral goals', async () => {
      const spyAutoCut = jest.spyOn(AdvancedVideoEditingService, 'autoCutVideo').mockResolvedValue({ success: true });
      jest.spyOn(fs, 'copyFile').mockResolvedValue();

      await AdvancedVideoEditingService.applyAdvancedEdits(mockVideoPath, mockOutputPath, {
        autoCut: true,
        goal: 'authority',
      });

      expect(spyAutoCut).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.not.objectContaining({
          silenceThreshold: '-40dB'
        })
      );
    });
  });

  describe('alignToBeat', () => {
    it('should calculate correct beat intervals', async () => {
      jest.spyOn(fs, 'copyFile').mockResolvedValue();
      const result = await AdvancedVideoEditingService.alignToBeat(mockVideoPath, mockOutputPath, 120);
      
      expect(result.success).toBe(true);
      expect(result.beatInterval).toBe(0.5); // 60/120
    });
  });
});
