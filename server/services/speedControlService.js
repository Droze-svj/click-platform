// Speed Control & Time Effects Service
// Features: Variable Speed, Speed Ramping, Reverse, Freeze Frame, Time Remapping, Motion Blur, Frame Blending, Presets, Audio Pitch Correction

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Build a chained atempo filter list for ANY speed. ffmpeg's atempo only accepts
 * 0.5–2.0 per instance, so a 4x speed must be atempo=2.0,atempo=2.0. Returns []
 * for speed 1 / invalid. (Mirrors the proven chaining in videoRenderService.)
 */
function buildAtempoChain(speed) {
  let s = Number(speed);
  if (!Number.isFinite(s) || s <= 0 || s === 1) return [];
  const parts = [];
  while (s > 2.0) { parts.push('atempo=2.0'); s /= 2.0; }
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts;
}

/**
 * Apply variable speed to video segment
 */
async function applyVariableSpeed(videoPath, outputPath, speedOptions) {
  const { start, end, speed, audioPitchCorrection = true, motionBlur = false } = speedOptions;
  
  return new Promise((resolve, reject) => {
    // Get video duration
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration;
      
      // Build filters
      const videoFilters = [];
      const audioFilters = [];
      
      // Clamp to a sane range so setpts can't divide by zero and the chain stays bounded.
      const spd = Math.max(0.1, Math.min(Number(speed) || 1, 16));

      // Video speed
      if (spd !== 1.0) {
        videoFilters.push(`setpts=${(1.0 / spd).toFixed(6)}*PTS`);

        // Motion blur for fast motion
        if (motionBlur && spd > 1.5) {
          videoFilters.push('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1');
        }
      }

      // Audio tempo — chained so speeds outside 0.5–2.0 (e.g. 4x/8x presets)
      // don't crash ffmpeg. (audioPitchCorrection is implicit in atempo.)
      if (spd !== 1.0) {
        audioFilters.push(...buildAtempoChain(spd));
      }
      void audioPitchCorrection;
      
      // Apply to segment only
      let command = ffmpeg(videoPath);
      
      if (start > 0 || end < duration) {
        command.inputOptions([`-ss ${start}`, `-t ${end - start}`]);
      }
      
      if (videoFilters.length > 0) {
        command.videoFilters(videoFilters.join(','));
      }
      
      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters.join(','));
      }
      
      command
        .output(outputPath)
        .on('end', () => {
          logger.info('Variable speed applied', { outputPath, speed, start, end });
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    });
  });
}

/**
 * Apply speed ramping (gradual speed change)
 */
async function applySpeedRamp(videoPath, outputPath, rampOptions) {
  const { start, end, startSpeed, endSpeed, audioPitchCorrection = true } = rampOptions;
  
  return new Promise((resolve, reject) => {
    // Build speed curve
    const duration = end - start;
    const speedChange = endSpeed - startSpeed;
    
    // Simplified: use average speed (clamped so setpts can't divide by zero).
    const avgSpeed = Math.max(0.1, Math.min(((Number(startSpeed) || 1) + (Number(endSpeed) || 1)) / 2, 16));

    const videoFilters = [`setpts=${(1.0 / avgSpeed).toFixed(6)}*PTS`];
    // Chained atempo so a >2x or <0.5x ramp doesn't crash ffmpeg.
    const audioFilters = audioPitchCorrection ? buildAtempoChain(avgSpeed) : [];
    
    ffmpeg(videoPath)
      .inputOptions([`-ss ${start}`, `-t ${duration}`])
      .videoFilters(videoFilters.join(','))
      .audioFilters(audioFilters.join(','))
      .output(outputPath)
      .on('end', () => {
        logger.info('Speed ramp applied', { outputPath, startSpeed, endSpeed });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Reverse video
 */
async function reverseVideo(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters('reverse')
      .audioFilters('areverse')
      .output(outputPath)
      .on('end', () => {
        logger.info('Video reversed', { outputPath });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Freeze frame at specific time
 */
async function freezeFrame(videoPath, outputPath, freezeOptions) {
  const { time, duration = 2 } = freezeOptions;
  
  return new Promise((resolve, reject) => {
    // Extract frame at time
    const framePath = path.join(path.dirname(outputPath), `freeze-frame-${Date.now()}.jpg`);
    
    ffmpeg(videoPath)
      .seekInput(time)
      .frames(1)
      .output(framePath)
      .on('end', () => {
        // Create video from frozen frame — must encode a browser-playable stream
        // (libx264 + yuv420p + even dims + fps); a raw loop output is unplayable.
        ffmpeg(framePath)
          .inputOptions([`-loop 1`, `-t ${Math.max(0.1, Number(duration) || 2)}`])
          .outputOptions([
            '-c:v libx264',
            '-pix_fmt yuv420p',
            '-r 30',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-movflags', '+faststart',
          ])
          .output(outputPath)
          .on('end', () => {
            // Clean up
            if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
            logger.info('Freeze frame applied', { outputPath, time, duration });
            resolve(outputPath);
          })
          .on('error', reject)
          .run();
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Apply time remapping (complex speed curves)
 */
async function applyTimeRemapping(videoPath, outputPath, remapOptions) {
  const { segments } = remapOptions;
  
  return new Promise((resolve, reject) => {
    // Process each segment with its speed
    const tempFiles = [];
    let currentTime = 0;
    
    Promise.all(segments.map(async (segment, index) => {
      const { start, end, speed } = segment;
      const tempPath = path.join(path.dirname(outputPath), `remap-segment-${index}.mp4`);
      tempFiles.push(tempPath);
      
      return applyVariableSpeed(videoPath, tempPath, {
        start,
        end,
        speed,
        audioPitchCorrection: true
      });
    })).then(() => {
      // Concatenate all segments
      const concatFile = path.join(path.dirname(outputPath), `concat-${Date.now()}.txt`);
      const concatContent = tempFiles.map(f => `file '${f}'`).join('\n');
      fs.writeFileSync(concatFile, concatContent);
      
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', () => {
          // Clean up
          tempFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
          if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
          logger.info('Time remapping applied', { outputPath, segmentCount: segments.length });
          resolve(outputPath);
        })
        .on('error', reject)
        .run();
    }).catch(reject);
  });
}

/**
 * Get speed presets
 */
function getSpeedPresets() {
  return {
    '0.25x': { speed: 0.25, name: 'Ultra Slow (0.25x)', description: '4x slower' },
    '0.5x': { speed: 0.5, name: 'Slow Motion (0.5x)', description: '2x slower' },
    '0.75x': { speed: 0.75, name: 'Slightly Slow (0.75x)', description: '1.33x slower' },
    '1x': { speed: 1.0, name: 'Normal Speed (1x)', description: 'Original speed' },
    '1.25x': { speed: 1.25, name: 'Slightly Fast (1.25x)', description: '1.25x faster' },
    '1.5x': { speed: 1.5, name: 'Fast (1.5x)', description: '1.5x faster' },
    '2x': { speed: 2.0, name: 'Double Speed (2x)', description: '2x faster' },
    '4x': { speed: 4.0, name: 'Quad Speed (4x)', description: '4x faster' },
    '8x': { speed: 8.0, name: 'Ultra Fast (8x)', description: '8x faster' }
  };
}

module.exports = {
  applyVariableSpeed,
  applySpeedRamp,
  reverseVideo,
  freezeFrame,
  applyTimeRemapping,
  getSpeedPresets,
  buildAtempoChain,
};
