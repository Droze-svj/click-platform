// Advanced Export Options Service
// HDR, multiple codecs, custom settings, color spaces, audio codecs

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Export with HDR support
 */
async function exportHDR(videoPath, outputPath, hdrOptions) {
  const {
    standard = 'HDR10', // HDR10, Dolby Vision, HLG
    peakBrightness = 1000,
    colorSpace = 'rec2020',
    transferFunction = 'smpte2084'
  } = hdrOptions;

  return new Promise((resolve, reject) => {
    const outputOptions = [
      '-c:v', 'libx265',
      '-preset', 'medium',
      '-crf', '18',
      `-x265-params`, `hdr-opt=1:repeat-headers=1:colorprim=${colorSpace}:transfer=${transferFunction}`,
      '-pix_fmt', 'yuv420p10le',
      '-color_range', 'tv',
      '-colorspace', colorSpace,
      '-color_primaries', colorSpace,
      '-color_trc', transferFunction
    ];

    ffmpeg(videoPath)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('end', () => {
        logger.info('HDR export completed', { outputPath, standard });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with custom codec
 */
async function exportWithCodec(videoPath, outputPath, codecOptions) {
  const {
    videoCodec = 'h264', // h264, h265, vp9, prores, dnxhd
    audioCodec = 'aac', // aac, mp3, pcm, flac, opus
    quality = 'high',
    preset = 'medium'
  } = codecOptions;

  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);

    // Video codec settings
    switch (videoCodec) {
      case 'h264':
        command.videoCodec('libx264');
        command.outputOptions(['-preset', preset, '-crf', quality === 'high' ? '18' : quality === 'medium' ? '23' : '28']);
        break;
      case 'h265':
      case 'hevc':
        command.videoCodec('libx265');
        command.outputOptions(['-preset', preset, '-crf', quality === 'high' ? '20' : quality === 'medium' ? '25' : '30']);
        break;
      case 'vp9':
        command.videoCodec('libvpx-vp9');
        command.outputOptions(['-crf', quality === 'high' ? '30' : '35', '-b:v', '0']);
        break;
      case 'prores':
        command.videoCodec('prores');
        command.outputOptions(['-profile:v', '3']); // ProRes 422 HQ
        break;
      case 'dnxhd':
        command.videoCodec('dnxhd');
        command.outputOptions(['-b:v', '145M']); // DNxHD 145
        break;
      default:
        command.videoCodec('libx264');
    }

    // Audio codec settings
    switch (audioCodec) {
      case 'aac':
        command.audioCodec('aac');
        command.outputOptions(['-b:a', '192k']);
        break;
      case 'mp3':
        command.audioCodec('libmp3lame');
        command.outputOptions(['-b:a', '192k']);
        break;
      case 'pcm':
        command.audioCodec('pcm_s16le');
        break;
      case 'flac':
        command.audioCodec('flac');
        break;
      case 'opus':
        command.audioCodec('libopus');
        command.outputOptions(['-b:a', '128k']);
        break;
      default:
        command.audioCodec('aac');
    }

    command
      .output(outputPath)
      .on('end', () => {
        logger.info('Export with codec completed', { outputPath, videoCodec, audioCodec });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with color space
 */
async function exportWithColorSpace(videoPath, outputPath, colorSpaceOptions) {
  const {
    colorSpace = 'rec709', // rec709, rec2020, p3, srgb
    colorPrimaries = null,
    colorTrc = null,
    colorRange = 'tv' // tv, pc
  } = colorSpaceOptions;

  return new Promise((resolve, reject) => {
    const colorSpaceMap = {
      'rec709': { primaries: 'bt709', trc: 'bt709' },
      'rec2020': { primaries: 'bt2020', trc: 'smpte2084' },
      'p3': { primaries: 'smpte432', trc: 'smpte2084' },
      'srgb': { primaries: 'bt709', trc: 'iec61966-2-1' }
    };

    const mapping = colorSpaceMap[colorSpace] || colorSpaceMap['rec709'];
    const primaries = colorPrimaries || mapping.primaries;
    const trc = colorTrc || mapping.trc;

    ffmpeg(videoPath)
      .outputOptions([
        '-colorspace', colorSpace,
        '-color_primaries', primaries,
        '-color_trc', trc,
        '-color_range', colorRange
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('Export with color space completed', { outputPath, colorSpace });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with frame rate conversion
 */
async function exportWithFrameRate(videoPath, outputPath, frameRate) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .fps(frameRate)
      .output(outputPath)
      .on('end', () => {
        logger.info('Frame rate conversion completed', { outputPath, frameRate });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with subtitles embedded
 */
async function exportWithSubtitles(videoPath, subtitlePath, outputPath, options = {}) {
  const { language = 'eng', defaultTrack = true, forced = false } = options;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(subtitlePath)) {
      reject(new Error('Subtitle file not found'));
      return;
    }

    ffmpeg(videoPath)
      .input(subtitlePath)
      .outputOptions([
        '-c:s', 'mov_text', // Subtitle codec
        '-metadata:s:s:0', `language=${language}`,
        defaultTrack ? '-disposition:s:0' : '',
        defaultTrack ? 'default' : ''
      ].filter(Boolean))
      .output(outputPath)
      .on('end', () => {
        logger.info('Export with subtitles completed', { outputPath });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Export with chapter markers
 */
async function exportWithChapters(videoPath, chapters, outputPath) {
  return new Promise((resolve, reject) => {
    // Create chapter file
    const chapterFile = path.join(path.dirname(outputPath), `chapters-${Date.now()}.txt`);
    let chapterContent = ';FFMETADATA1\n';
    
    chapters.forEach((chapter, index) => {
      const start = formatChapterTime(chapter.start);
      const end = formatChapterTime(chapter.end || chapter.start + 10);
      chapterContent += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(chapter.start * 1000)}\nEND=${Math.floor((chapter.end || chapter.start + 10) * 1000)}\ntitle=${chapter.title || `Chapter ${index + 1}`}\n`;
    });

    fs.writeFileSync(chapterFile, chapterContent);

    ffmpeg(videoPath)
      .input(chapterFile)
      .mapMetadata(1)
      .output(outputPath)
      .on('end', () => {
        // Clean up chapter file
        if (fs.existsSync(chapterFile)) {
          fs.unlinkSync(chapterFile);
        }
        logger.info('Export with chapters completed', { outputPath, chapterCount: chapters.length });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Format time for chapter markers
 */
function formatChapterTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Get available export formats
 */
function getAvailableExportFormats() {
  return {
    videoCodecs: ['h264', 'h265', 'vp9', 'prores', 'dnxhd'],
    audioCodecs: ['aac', 'mp3', 'pcm', 'flac', 'opus'],
    colorSpaces: ['rec709', 'rec2020', 'p3', 'srgb'],
    hdrStandards: ['HDR10', 'Dolby Vision', 'HLG'],
    frameRates: [23.976, 24, 25, 29.97, 30, 50, 59.94, 60],
    resolutions: [
      { name: '4K', width: 3840, height: 2160 },
      { name: '2K', width: 2048, height: 1080 },
      { name: '1080p', width: 1920, height: 1080 },
      { name: '720p', width: 1280, height: 720 },
      { name: '480p', width: 854, height: 480 }
    ]
  };
}

module.exports = {
  exportHDR,
  exportWithCodec,
  exportWithColorSpace,
  exportWithFrameRate,
  exportWithSubtitles,
  exportWithChapters,
  getAvailableExportFormats,
};
