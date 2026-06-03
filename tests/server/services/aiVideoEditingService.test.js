const aiVideoEditingService = require('../../../server/services/aiVideoEditingService');
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
  statSync: jest.fn().mockReturnValue({ size: 5000, mtimeMs: Date.now() }),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// The service shells out to `ffmpeg -version` / `ffprobe -version` to verify the
// binaries exist. CI runners don't have ffmpeg installed, so stub execSync to a
// no-op (the actual ffmpeg work is exercised via the mocked fluent-ffmpeg below).
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

jest.mock('fluent-ffmpeg', () => {
  const mFfmpeg = jest.fn(() => ({
    complexFilter: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    videoFilters: jest.fn().mockReturnThis(),
    audioFilters: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    on: jest.fn(function(event, cb) {
      if (event === 'end') {
        setTimeout(cb, 0);
      }
      return this;
    }),
    run: jest.fn(),
    kill: jest.fn(),
  }));
  mFfmpeg.ffprobe = jest.fn((p, cb) => cb(null, {
    format: { duration: 10, size: 2048 },
    streams: [{ codec_type: 'video', width: 1080, height: 1920 }]
  }));
  return mFfmpeg;
});

jest.mock('../../../server/utils/devStore', () => ({
  resolveContent: jest.fn().mockResolvedValue({
    originalFile: {
      url: '/uploads/videos/test.mp4',
      filename: 'test.mp4',
      duration: 10,
      size: 2048
    },
    captions: {
      text: 'This is a test transcript for AI matching.',
      words: [{ word: 'This', start: 0, end: 1 }]
    },
    editorState: {
      lockedPreferences: {
        musicGenre: true
      }
    },
    save: jest.fn().mockResolvedValue(true)
  }),
}));

jest.mock('../../../server/services/storageService', () => ({
  uploadFile: jest.fn().mockResolvedValue({
    url: '/uploads/videos/edited.mp4',
    key: 'videos/edited.mp4',
    storage: 'local'
  }),
}));

jest.mock('../../../server/utils/googleAI', () => ({
  generateContent: jest.fn().mockResolvedValue(JSON.stringify({
    pacingIntensity: 'aggressive',
    captionStyle: 'tiktok',
    enableAutoZoom: true,
    enableColorGrading: true,
    musicGenre: 'phonk',
    viralExtraction: {
      shouldExtract: false
    },
    reasoning: 'Matches aggressive tempo'
  })),
  isConfigured: true,
}));

describe('aiVideoEditingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully initialize FFmpeg log redirection and logs folder', () => {
    expect(process.env.FFREPORT).toContain('logs/ffmpeg-');
  });

  describe('autoEditVideo with locked preferences', () => {
    it('should honor user-locked musicGenre and complete edit with cleanups', async () => {
      const options = {
        musicGenre: 'synthwave',
        editorState: {
          lockedPreferences: {
            musicGenre: true
          }
        }
      };

      const result = await aiVideoEditingService.autoEditVideo('video123', options);

      expect(result.success).toBe(true);
      expect(result.editedVideoUrl).toBe('/uploads/videos/edited.mp4');
      
      // Ensure transient files are cleaned up
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });
});
