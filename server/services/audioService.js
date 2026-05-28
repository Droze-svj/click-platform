// Audio processing service - mix music with video

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Mix background music with video
 * @param {string} videoPath - Path to video file
 * @param {string} musicPath - Path to music file
 * @param {string} outputPath - Output path
 * @param {Object} options - Mixing options
 * @returns {Promise<string>} - Path to output file
 */
async function mixMusicWithVideo(videoPath, musicPath, outputPath, options = {}) {
  const {
    musicVolume = 0.25,
    fadeIn = 2,
    fadeOut = 2,
    loop = true,
    startTime = 0,
    // Speech-aware music ducking:
    // silencePeriods = detected silent (non-speech) windows from the pipeline.
    // During speech (not silence), music ducks to duckedMusicDb.
    // During silence (no speech), music restores to full musicVolume.
    silencePeriods = [],
    duckedMusicDb = -18,
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, videoMeta) => {
      if (err) return reject(new Error(`Failed to probe video: ${err.message}`));
      const videoDuration = videoMeta.format.duration;

      // Build a dynamic volume expression for music:
      //   Default = ducked (speech present).
      //   During detected silence windows (no speech) = restore to full.
      const duckFactor   = Math.pow(10, duckedMusicDb / 20);      // -18dB ≈ 0.126
      const normalFactor = musicVolume;                             // e.g. 0.25

      let volExpr = String(duckFactor);
      if (silencePeriods.length > 0) {
        silencePeriods.slice(0, 20).forEach(seg => {
          const s = Number(seg.start).toFixed(3);
          const e = Number(seg.end).toFixed(3);
          volExpr = `if(between(t,${s},${e}),${normalFactor},${volExpr})`;
        });
      } else {
        // No silence period data — just use a flat musicVolume with no ducking
        volExpr = String(normalFactor);
      }

      const loopArgs = loop ? ['-stream_loop', '-1'] : [];
      let command = ffmpeg(videoPath)
        .input(musicPath)
        .inputOptions(['-ss', String(startTime), ...loopArgs]);

      // Build the filter graph as a single string (avoids fluent-ffmpeg object routing issues)
      const fadeOutStart = Math.max(0, videoDuration - fadeOut);
      const filterGraph = [
        // Trim music to video duration, apply fade, then dynamic volume ducking
        `[1:a]atrim=0:${videoDuration},asetpts=PTS-STARTPTS,` +
          `afade=t=in:st=0:d=${fadeIn},` +
          `afade=t=out:st=${fadeOutStart}:d=${fadeOut},` +
          `volume=eval=frame:volume='${volExpr}'[music_ready]`,
        // Mix original voice (unity gain) with processed music
        `[0:a][music_ready]amix=inputs=2:duration=first:dropout_transition=0:weights=1 1[final_audio]`,
      ];

      command
        .complexFilter(filterGraph)
        .outputOptions([
          '-map 0:v',
          '-map [final_audio]',
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
        ])
        .output(outputPath)
        .on('start', cmd => logger.info('Starting audio mixing with ducking', { cmd: cmd.substring(0, 200) }))
        .on('end', () => { logger.info('Audio mixing completed', { outputPath }); resolve(outputPath); })
        .on('error', e => { logger.error('Audio mixing error', { error: e.message }); reject(e); })
        .run();
    });
  });
}

/**
 * Normalize audio levels
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Output path
 * @returns {Promise<string>} - Path to output file
 */
async function normalizeAudio(audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11')
      .output(outputPath)
      .on('end', () => {
        logger.info('Audio normalized', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Audio normalization error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Extract audio from video
 * @param {string} videoPath - Path to video file
 * @param {string} outputPath - Output path for audio
 * @returns {Promise<string>} - Path to output file
 */
async function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .output(outputPath)
      .on('end', () => {
        logger.info('Audio extracted', { outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Audio extraction error', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Extract audio energy profile (loudness/energy over time)
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Array<{time: number, energy: number}>>}
 */
async function getAudioEnergyProfile(audioPath) {
  return new Promise((resolve, reject) => {
    const profile = [];
    let lastTime = -1;
    
    // Use astats filter to get audio statistics
    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'astats=metadata=1:reset=1',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Parse pkt_pts_time and lavfi.astats.Overall.RMS_level
        // We only take samples every 0.1s to avoid flooding
        const timeMatch = stderrLine.match(/pkt_pts_time:([\d.]+)/);
        const rmsMatch = stderrLine.match(/lavfi.astats.Overall.RMS_level:([-.\d]+)/);
        
        if (timeMatch && rmsMatch) {
          const time = parseFloat(timeMatch[1]);
          if (time >= lastTime + 0.1) {
            const rms = parseFloat(rmsMatch[1]);
            // Convert RMS dB to 0-1 scale (-60dB to 0dB)
            const energy = Math.max(0, Math.min(1, (rms + 60) / 60));
            profile.push({ time, energy });
            lastTime = time;
          }
        }
      })
      .on('end', () => {
        logger.info('Audio energy profile completed', { samples: profile.length });
        resolve(profile);
      })
      .on('error', (err) => {
        logger.warn('Audio energy profile failed, using mock data', { error: err.message });
        resolve([]);
      })
      .run();
  });
}

module.exports = {
  mixMusicWithVideo,
  normalizeAudio,
  extractAudio,
  getAudioEnergyProfile
};







