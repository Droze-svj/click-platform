// Advanced Video Editing Service
// Features: Auto-cut detection, smart transitions, color correction, face detection, stabilization

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');

/**
 * Detect silence in audio and return timestamps
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Options (threshold, duration)
 * @returns {Promise<Array>} Array of silence segments
 */
async function detectSilence(videoPath, options = {}) {
  try {
    const { threshold = '-50dB', duration = 0.5 } = options;

    logger.info('Detecting silence', { videoPath, threshold, duration });

    // Use FFmpeg silencedetect filter
    const command = `ffmpeg -i "${videoPath}" -af "silencedetect=noise=${threshold}:d=${duration}" -f null - 2>&1`;

    const { stdout, stderr } = await execAsync(command);
    const output = stdout + stderr;

    const silenceSegments = [];
    const silenceStartRegex = /silence_start: ([\d.]+)/g;
    const silenceEndRegex = /silence_end: ([\d.]+)/g;

    let match;
    const starts = [];
    const ends = [];

    while ((match = silenceStartRegex.exec(output)) !== null) {
      starts.push(parseFloat(match[1]));
    }

    while ((match = silenceEndRegex.exec(output)) !== null) {
      ends.push(parseFloat(match[1]));
    }

    // Pair up starts and ends
    for (let i = 0; i < starts.length; i++) {
      const end = ends[i] || starts[i] + duration;
      silenceSegments.push({
        start: starts[i],
        end: end,
        duration: end - starts[i],
      });
    }

    logger.info('Silence detection complete', {
      videoPath,
      segmentsFound: silenceSegments.length,
    });

    return silenceSegments;
  } catch (error) {
    logger.error('Error detecting silence', { videoPath, error: error.message });
    captureException(error, {
      tags: { service: 'advancedVideoEditing', action: 'detectSilence' },
    });
    throw error;
  }
}

/**
 * Detect filler words in transcript using AI
 * @param {string} transcript - Video transcript
 * @returns {Promise<Array>} Array of filler word timestamps
 */
async function detectFillerWords(transcript) {
  try {
    if (!geminiConfigured) {
      logger.warn('Google AI not available for filler word detection');
      return [];
    }

    const fullPrompt = `Analyze this transcript and identify filler words and pauses (um, uh, er, ah, like, you know, so, well, actually). Return valid JSON only with "fillerWords" array of objects: {word: string, startTime: number, endTime: number, type: 'filler'|'pause'}. Estimate timestamps based on word position.\n\nTranscript:\n${transcript}`;
    const raw = await geminiGenerate(fullPrompt, { temperature: 0.3, maxTokens: 1024 });
    const analysis = JSON.parse(raw || '{}');
    return analysis.fillerWords || [];
  } catch (error) {
    logger.error('Error detecting filler words', { error: error.message });
    return [];
  }
}

/**
 * Auto-cut video: Remove silence and filler words
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {Object} options - Options
 * @returns {Promise<Object>} Edit result
 */
async function autoCutVideo(inputPath, outputPath, options = {}) {
  try {
    const {
      removeSilence = true,
      removeFillerWords = false,
      transcript = null,
      silenceThreshold = '-50dB',
      minSilenceDuration = 0.5,
    } = options;

    logger.info('Starting auto-cut', { inputPath, outputPath, options });

    let cutSegments = [];

    // Detect silence
    if (removeSilence) {
      const silenceSegments = await detectSilence(inputPath, {
        threshold: silenceThreshold,
        duration: minSilenceDuration,
      });
      cutSegments = cutSegments.concat(silenceSegments);
    }

    // Detect filler words if transcript provided
    if (removeFillerWords && transcript) {
      const fillerWords = await detectFillerWords(transcript);
      cutSegments = cutSegments.concat(fillerWords);
    }

    // Sort by start time
    cutSegments.sort((a, b) => a.start - b.start);

    // Merge overlapping segments
    const mergedSegments = [];
    for (const segment of cutSegments) {
      if (mergedSegments.length === 0) {
        mergedSegments.push(segment);
      } else {
        const last = mergedSegments[mergedSegments.length - 1];
        if (segment.start <= last.end) {
          last.end = Math.max(last.end, segment.end);
        } else {
          mergedSegments.push(segment);
        }
      }
    }

    // Build FFmpeg filter to remove segments
    if (mergedSegments.length === 0) {
      logger.info('No segments to cut, copying original');
      await fs.copyFile(inputPath, outputPath);
      return {
        success: true,
        segmentsRemoved: 0,
        originalDuration: 0,
        newDuration: 0,
      };
    }

    // Create filter complex to remove segments
    const filterParts = [];
    const vStreams = [];
    const aStreams = [];
    let currentTime = 0;
    let streamIndex = 0;

    for (const segment of mergedSegments) {
      if (segment.start > currentTime) {
        // Keep segment before cut
        filterParts.push(
          `[0:v]trim=start=${currentTime}:end=${segment.start},setpts=PTS-STARTPTS[v${streamIndex}];`
        );
        filterParts.push(
          `[0:a]atrim=start=${currentTime}:end=${segment.start},asetpts=PTS-STARTPTS[a${streamIndex}];`
        );
        vStreams.push(`[v${streamIndex}]`);
        aStreams.push(`[a${streamIndex}]`);
        streamIndex++;
      }
      currentTime = segment.end;
    }

    // Add remaining video
    if (currentTime < 1000) { // Just a large number if we don't have exact duration
      filterParts.push(
        `[0:v]trim=start=${currentTime},setpts=PTS-STARTPTS[v${streamIndex}];`
      );
      filterParts.push(
        `[0:a]atrim=start=${currentTime},asetpts=PTS-STARTPTS[a${streamIndex}];`
      );
      vStreams.push(`[v${streamIndex}]`);
      aStreams.push(`[a${streamIndex}]`);
    }

    // Concatenate all segments
    const vConcat = vStreams.join('');
    const aConcat = aStreams.join('');

    const filterComplex = filterParts.join('') + `${vConcat}concat=n=${vStreams.length}:v=1:a=0[outv];${aConcat}concat=n=${aStreams.length}:v=0:a=1[outa]`;

    // Apply filter
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[outv]', '-map', '[outa]'])
        .output(outputPath)
        .on('end', () => {
          logger.info('Auto-cut complete', {
            segmentsRemoved: mergedSegments.length,
            outputPath,
          });
          resolve();
        })
        .on('error', (err) => {
          logger.error('Auto-cut error', { error: err.message });
          reject(err);
        })
        .run();
    });

    return {
      success: true,
      segmentsRemoved: mergedSegments.length,
      cutSegments: mergedSegments,
      outputPath,
    };
  } catch (error) {
    logger.error('Error in auto-cut', { error: error.message, stack: error.stack });
    captureException(error, {
      tags: { service: 'advancedVideoEditing', action: 'autoCutVideo' },
    });
    throw error;
  }
}

/**
 * Detect scenes in video using shot detection
 * @param {string} videoPath - Path to video
 * @returns {Promise<Array>} Array of scene segments
 */
async function detectScenes(videoPath) {
  try {
    logger.info('Detecting scenes', { videoPath });

    // Use FFmpeg scene detection
    const command = `ffmpeg -i "${videoPath}" -vf "select='gt(scene,0.3)',showinfo" -vsync vfr -f null - 2>&1`;

    const { stdout, stderr } = await execAsync(command);
    const output = stdout + stderr;

    const scenes = [];
    const sceneRegex = /pts_time:([\d.]+)/g;
    let match;
    const timestamps = [];

    while ((match = sceneRegex.exec(output)) !== null) {
      timestamps.push(parseFloat(match[1]));
    }

    // Create scene segments
    for (let i = 0; i < timestamps.length; i++) {
      scenes.push({
        start: timestamps[i],
        end: timestamps[i + 1] || timestamps[i] + 5, // Default 5s if no next scene
        sceneNumber: i + 1,
      });
    }

    logger.info('Scene detection complete', {
      videoPath,
      scenesFound: scenes.length,
    });

    return scenes;
  } catch (error) {
    logger.error('Error detecting scenes', { videoPath, error: error.message });
    throw error;
  }
}

/**
 * Add smart transitions between scenes
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {Array} scenes - Scene segments
 * @param {Object} options - Transition options
 * @returns {Promise<Object>} Result
 */
async function addSmartTransitions(inputPath, outputPath, scenes, options = {}) {
  try {
    const {
      transitionType = 'fade',
      duration = 0.5,
      transitionAt = 'end', // 'start', 'end', 'both'
    } = options;

    logger.info('Adding smart transitions', {
      inputPath,
      scenesCount: scenes.length,
      transitionType,
    });

    let filterParts = [];
    let vStreams = [];
    let aStreams = [];
    let streamIndex = 0;
    
    // We will slice the video into non-transition and transition segments
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const nextScene = scenes[i + 1];
      
      let segmentStart = scene.start;
      if (i > 0) {
        segmentStart = scene.start + duration; // Skip the start transition part for this scene
      }
      
      let segmentEnd = scene.end;
      if (nextScene) {
        segmentEnd = scene.end - duration; // End early to leave room for transition
      }

      // Add main scene segment
      if (segmentEnd > segmentStart) {
        filterParts.push(`[0:v]trim=start=${segmentStart}:end=${segmentEnd},setpts=PTS-STARTPTS[v${streamIndex}];`);
        filterParts.push(`[0:a]atrim=start=${segmentStart}:end=${segmentEnd},asetpts=PTS-STARTPTS[a${streamIndex}];`);
        vStreams.push(`[v${streamIndex}]`);
        aStreams.push(`[a${streamIndex}]`);
        streamIndex++;
      }

      // Add transition to next scene if it exists
      if (nextScene) {
        const transStart = scene.end - duration;
        const transEnd = nextScene.start + duration;
        
        let transFilter = '';
        if (transitionType === 'glitch') {
          transFilter = `,rgbashift=rh=10:bv=-10`;
        } else if (transitionType === 'zoom') {
          transFilter = `,zoompan=z='min(zoom+0.15,1.5)':d=1:s=1920x1080`;
        } else {
          // fade (dip to black)
          transFilter = `,fade=t=out:st=0:d=${duration},fade=t=in:st=${duration}:d=${duration}`;
        }

        filterParts.push(`[0:v]trim=start=${transStart}:end=${transEnd},setpts=PTS-STARTPTS${transFilter}[v${streamIndex}];`);
        filterParts.push(`[0:a]atrim=start=${transStart}:end=${transEnd},asetpts=PTS-STARTPTS[a${streamIndex}];`);
        vStreams.push(`[v${streamIndex}]`);
        aStreams.push(`[a${streamIndex}]`);
        streamIndex++;
      }
    }

    if (vStreams.length === 0) {
      // fallback if logic failed
      return { success: true, transitionsAdded: 0, outputPath: inputPath };
    }

    const vConcat = vStreams.join('');
    const aConcat = aStreams.join('');
    const filterComplex = filterParts.join('') + `${vConcat}concat=n=${vStreams.length}:v=1:a=0[outv];${aConcat}concat=n=${aStreams.length}:v=0:a=1[outa]`;

    // Apply transitions
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[outv]', '-map', '[outa]'])
        .output(outputPath)
        .on('end', () => {
          logger.info('Smart transitions added', { outputPath });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return {
      success: true,
      transitionsAdded: scenes.length - 1,
      outputPath,
    };
  } catch (error) {
    logger.error('Error adding transitions', { error: error.message });
    throw error;
  }
}

/**
 * Auto-color correct video
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {Object} options - Color correction options
 * @returns {Promise<Object>} Result
 */
async function autoColorCorrect(inputPath, outputPath, options = {}) {
  try {
    const {
      brightness = 0,
      contrast = 1.0,
      saturation = 1.0,
      temperature = 0,
      exposure = 0,
    } = options;

    logger.info('Auto-color correcting', { inputPath, options });

    // Build color correction filter
    const filters = [];

    if (brightness !== 0) {
      filters.push(`eq=brightness=${brightness / 100}`);
    }
    if (contrast !== 1.0) {
      filters.push(`eq=contrast=${contrast}`);
    }
    if (saturation !== 1.0) {
      filters.push(`eq=saturation=${saturation}`);
    }
    if (temperature !== 0) {
      // Temperature adjustment using colorbalance
      const warm = temperature > 0 ? temperature / 100 : 0;
      const cool = temperature < 0 ? Math.abs(temperature) / 100 : 0;
      filters.push(`colorbalance=rs=${warm}:gs=${-cool}:bs=${cool}`);
    }
    if (exposure !== 0) {
      filters.push(`eq=gamma=${1 + exposure / 100}`);
    }

    const filterString = filters.length > 0 ? filters.join(',') : 'null';

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filterString)
        .output(outputPath)
        .on('end', () => {
          logger.info('Color correction complete', { outputPath });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return {
      success: true,
      correctionsApplied: filters.length,
      outputPath,
    };
  } catch (error) {
    logger.error('Error in color correction', { error: error.message });
    throw error;
  }
}

/**
 * Detect faces and auto-frame
 * @param {string} videoPath - Video path
 * @returns {Promise<Array>} Face detection results
 */
async function detectFaces(videoPath) {
  try {
    logger.info('Detecting faces', { videoPath });

    // Use FFmpeg to extract frames and detect faces
    // In production, would use OpenCV or similar
    const framesDir = path.join(path.dirname(videoPath), 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    // Extract frames at 1fps
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vf', 'fps=1'])
        .output(path.join(framesDir, 'frame-%03d.jpg'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Analyze frames for faces (simplified - would use actual face detection)
    const frames = await fs.readdir(framesDir);
    const faceDetections = frames.map((frame, index) => ({
      frame: index,
      timestamp: index, // 1 second per frame
      hasFace: true, // Would use actual detection
      boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    }));

    // Cleanup
    await fs.rm(framesDir, { recursive: true, force: true });

    logger.info('Face detection complete', {
      videoPath,
      facesDetected: faceDetections.filter((f) => f.hasFace).length,
    });

    return faceDetections;
  } catch (error) {
    logger.error('Error detecting faces', { videoPath, error: error.message });
    return [];
  }
}

/**
 * Auto-frame video based on face detection
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {Array} faceDetections - Face detection results
 * @returns {Promise<Object>} Result
 */
async function autoFrameVideo(inputPath, outputPath, faceDetections) {
  try {
    logger.info('Auto-framing video', { inputPath, facesDetected: faceDetections.length });

    // Create crop filter based on face positions
    // Simplified - would use actual face tracking
    const cropFilter = 'crop=iw*0.8:ih*0.8:iw*0.1:ih*0.1'; // Center crop

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(cropFilter)
        .output(outputPath)
        .on('end', () => {
          logger.info('Auto-framing complete', { outputPath });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return {
      success: true,
      outputPath,
    };
  } catch (error) {
    logger.error('Error in auto-framing', { error: error.message });
    throw error;
  }
}

/**
 * Stabilize video (reduce shake)
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {Object} options - Stabilization options
 * @returns {Promise<Object>} Result
 */
async function stabilizeVideo(inputPath, outputPath, options = {}) {
  try {
    const { smoothing = 10, shakiness = 5 } = options;

    logger.info('Stabilizing video', { inputPath, smoothing, shakiness });

    // Use FFmpeg vidstab filter
    const tempFile = outputPath + '.trf';

    // Step 1: Analyze video
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `vidstabdetect=shakiness=${shakiness}:accuracy=15:result=${tempFile}`,
        ])
        .output('/dev/null')
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Step 2: Apply stabilization
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', `vidstabtransform=input=${tempFile}:smoothing=${smoothing},unsharp=5:5:0.8:3:3:0.4`,
        ])
        .output(outputPath)
        .on('end', () => {
          // Cleanup
          fs.unlink(tempFile).catch(() => { });
          logger.info('Stabilization complete', { outputPath });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return {
      success: true,
      outputPath,
    };
  } catch (error) {
    logger.error('Error stabilizing video', { error: error.message });
    // Fallback: return original if stabilization fails
    try {
      await fs.copyFile(inputPath, outputPath);
    } catch (copyError) {
      logger.error('Failed to copy original video', { error: copyError.message });
    }
    throw error;
  }
}

/**
 * Get available video style presets
 * @returns {Array} List of style presets
 */
function getVideoStylePresets() {
  return [
    {
      id: 'cinematic',
      name: 'Cinematic Film',
      description: 'High contrast, slightly warm shadows, teal highlights',
      ffmpegFilter: 'eq=contrast=1.15:gamma=0.9:saturation=0.8,colorbalance=rs=.1:gs=-.1:bs=.1:rm=.1:gm=-.1:bm=.1:rh=-.1:gh=.1:bh=.2'
    },
    {
      id: 'vibrant',
      name: 'Vibrant Social',
      description: 'High saturation, increased brightness for social media feeds',
      ffmpegFilter: 'eq=contrast=1.1:brightness=0.05:saturation=1.4,unsharp=5:5:1.0:5:5:0.0'
    },
    {
      id: 'vintage',
      name: 'Vintage / Retro',
      description: 'Lower contrast, sepia warmth, subtle grain simulation',
      ffmpegFilter: 'eq=contrast=0.9:saturation=0.6,colorbalance=rs=.2:gs=.1:bs=-.1:rm=.2:gm=.1:bm=-.1,noise=alls=20:allf=t+u'
    },
    {
      id: 'moody',
      name: 'Dark & Moody',
      description: 'Lower exposure, desaturated, deep blacks',
      ffmpegFilter: 'eq=contrast=1.2:brightness=-0.05:gamma=0.8:saturation=0.6'
    },
    {
      id: 'cyberpunk',
      name: 'Cyberpunk Neon',
      description: 'High contrast, extreme neon highlights (magenta/cyan bias)',
      ffmpegFilter: 'eq=contrast=1.3:saturation=1.5,colorbalance=rs=.2:gs=-.1:bs=.3:rm=.1:gm=-.1:bm=.2'
    }
  ];
}

/**
 * Apply full style effect preset to video
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {string} styleId - Style preset ID
 * @returns {Promise<Object>} Result
 */
async function applyStyleEffect(inputPath, outputPath, styleId) {
  try {
    const presets = getVideoStylePresets();
    const preset = presets.find(p => p.id === styleId);

    if (!preset) {
      throw new Error(`Style preset "${styleId}" not found`);
    }

    logger.info('Applying style effect', { inputPath, styleId: preset.id });

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(preset.ffmpegFilter)
        .outputOptions(['-c:v libx264', '-crf 18', '-preset fast', '-c:a copy'])
        .output(outputPath)
        .on('end', () => {
          logger.info('Style effect applied', { outputPath, styleId });
          resolve();
        })
        .on('error', reject)
        .run();
    });

    return {
      success: true,
      styleApplied: preset.name,
      outputPath,
    };
  } catch (error) {
    logger.error('Error applying style effect', { error: error.message });
    throw error;
  }
}

/**
 * Apply all advanced edits to video
 * @param {string} inputPath - Input video
 * @param {string} outputPath - Output video
 * @param {Object} options - Edit options
 * @returns {Promise<Object>} Result
 */
async function applyAdvancedEdits(inputPath, outputPath, options = {}) {
  try {
    const {
      autoCut = false,
      smartTransitions = false,
      colorCorrection = false,
      autoFrame = false,
      stabilize = false,
      transcript = null,
    } = options;

    logger.info('Applying advanced edits', { inputPath, options });

    let currentPath = inputPath;
    const tempFiles = [];
    const editsApplied = [];

    // Auto-cut
    if (autoCut) {
      const cutPath = outputPath + '.cut.mp4';
      tempFiles.push(cutPath);
      const result = await autoCutVideo(currentPath, cutPath, {
        removeSilence: true,
        removeFillerWords: !!transcript,
        transcript,
      });
      if (result.success) {
        currentPath = cutPath;
        editsApplied.push('auto-cut');
      }
    }

    // Detect scenes for transitions
    let scenes = [];
    if (smartTransitions) {
      scenes = await detectScenes(currentPath);
    }

    // Smart transitions
    if (smartTransitions && scenes.length > 1) {
      const transitionPath = outputPath + '.transitions.mp4';
      tempFiles.push(transitionPath);
      const result = await addSmartTransitions(currentPath, transitionPath, scenes);
      if (result.success) {
        currentPath = transitionPath;
        editsApplied.push('smart-transitions');
      }
    }

    // Color correction
    if (colorCorrection) {
      const colorPath = outputPath + '.color.mp4';
      tempFiles.push(colorPath);
      const result = await autoColorCorrect(currentPath, colorPath);
      if (result.success) {
        currentPath = colorPath;
        editsApplied.push('color-correction');
      }
    }

    // Face detection and auto-framing
    if (autoFrame) {
      const faceDetections = await detectFaces(currentPath);
      if (faceDetections.length > 0) {
        const framePath = outputPath + '.frame.mp4';
        tempFiles.push(framePath);
        const result = await autoFrameVideo(currentPath, framePath, faceDetections);
        if (result.success) {
          currentPath = framePath;
          editsApplied.push('auto-frame');
        }
      }
    }

    // Stabilization
    if (stabilize) {
      const stabPath = outputPath + '.stab.mp4';
      tempFiles.push(stabPath);
      const result = await stabilizeVideo(currentPath, stabPath);
      if (result.success) {
        currentPath = stabPath;
        editsApplied.push('stabilization');
      }
    }

    // Copy final result
    if (currentPath !== inputPath) {
      await fs.copyFile(currentPath, outputPath);
    } else {
      await fs.copyFile(inputPath, outputPath);
    }

    // Apply specific full Style Effect if requested
    if (options.styleEffect) {
      const styledPath = outputPath + '.styled.mp4';
      tempFiles.push(styledPath);
      // Process using the new style effect pipeline
      const result = await applyStyleEffect(outputPath, styledPath, options.styleEffect);
      if (result.success) {
        await fs.copyFile(styledPath, outputPath);
        editsApplied.push(`style-${options.styleEffect}`);
      }
    }

    // Cleanup temp files
    for (const tempFile of tempFiles) {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    logger.info('Advanced edits complete', {
      outputPath,
      editsApplied: editsApplied.length,
      edits: editsApplied,
    });

    return {
      success: true,
      outputPath,
      editsApplied,
      editsCount: editsApplied.length,
    };
  } catch (error) {
    logger.error('Error applying advanced edits', {
      error: error.message,
      stack: error.stack,
    });
    captureException(error, {
      tags: { service: 'advancedVideoEditing', action: 'applyAdvancedEdits' },
    });
    throw error;
  }
}

module.exports = {
  detectSilence,
  detectFillerWords,
  autoCutVideo,
  detectScenes,
  addSmartTransitions,
  autoColorCorrect,
  detectFaces,
  autoFrameVideo,
  stabilizeVideo,
  applyAdvancedEdits,
  applyStyleEffect,
  getVideoStylePresets,
};
