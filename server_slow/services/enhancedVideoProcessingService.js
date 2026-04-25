// Enhanced video processing service with creative editing features

const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const OpenAI = require('openai')

let openai = null;
function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (e) {
      logger.warn('OpenAI not configured for enhanced video processing', { error: e.message });
      return null;
    }
  }
  return openai;
}

// Helper function to get output path
function getOutputPath(filename) {
  const outputDir = path.join(__dirname, '../uploads/processed')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  return path.join(outputDir, filename)
}

// ─── STABILITY ENHANCEMENT: TIMEOUT WRAPPER ──────────────────────────────────
/**
 * Runs an FFmpeg command with a maximum execution time.
 * Prevents zombie processes and runaway resource consumption.
 */
function runFFmpegWithTimeout(command, timeoutMs = 300000) { // 5 min default
  return new Promise((resolve, reject) => {
    let timeoutId;

    const killCommand = () => {
      logger.warn('FFmpeg process timed out - forcing termination', { timeoutMs });
      command.kill('SIGKILL');
      reject(new Error(`FFmpeg processing timed out after ${timeoutMs}ms`));
    };

    timeoutId = setTimeout(killCommand, timeoutMs);

    command
      .on('end', () => {
        clearTimeout(timeoutId);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timeoutId);
        if (err.message && err.message.includes('SIGKILL')) {
          // Already handled by killCommand
          return;
        }
        reject(err);
      })
      .run();
  });
}

// Add text overlays to video
async function addTextOverlays(videoPath, textOverlays, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `text-overlay-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting text overlay processing', { jobId, userId, overlayCount: textOverlays.length })

  const command = ffmpeg(videoPath)
    .output(outputPath)
    .outputOptions([
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'medium',
      '-crf', '23'
    ])
    .on('progress', (progress) => {
      logger.debug('Text overlay progress', { jobId, progress: progress.percent })
    });

  // Chain text overlays correctly in FFmpeg
  if (textOverlays.length > 0) {
    let filterGraph = '[0:v]';
    textOverlays.forEach((overlay, index) => {
      const fontSize = overlay.fontSize || 24;
      const color = overlay.color || '#ffffff';
      const x = `(${overlay.x || 50}*w/100)`;
      const y = `(${overlay.y || 50}*h/100)`;
      const startTime = overlay.startTime || 0;
      const endTime = overlay.endTime || (startTime + 5);
      
      // Escape for FFmpeg drawtext
      const escapedText = overlay.text
        .replace(/\\/g, '\\\\\\\\')
        .replace(/'/g, '\\\'')
        .replace(/:/g, '\\:');

      const nextLabel = index === textOverlays.length - 1 ? '[v]' : `[v${index}]`;
      filterGraph += `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})'${nextLabel}`;
      if (index < textOverlays.length - 1) {
        filterGraph += `;${nextLabel}`;
      }
    });

    command.complexFilter(filterGraph).outputOptions(['-map', '[v]', '-map', '0:a?']);
  }

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Text overlay processing completed', { jobId, outputPath });
    
    const stats = { originalSize: 0, processedSize: 0 };
    if (fs.existsSync(videoPath)) stats.originalSize = fs.statSync(videoPath).size;
    if (fs.existsSync(outputPath)) stats.processedSize = fs.statSync(outputPath).size;

    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      originalSize: stats.originalSize,
      processedSize: stats.processedSize,
      duration: textOverlays.length > 0 ? textOverlays[textOverlays.length - 1].endTime : 0
    };
  } catch (err) {
    logger.error('Text overlay processing failed', { jobId, error: err.message });
    throw err;
  }
}

// Apply video filters (brightness, contrast, saturation, etc.)
async function applyVideoFilters(videoPath, filters, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `filtered-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting video filter processing', { jobId, userId, filters })

  const filterString = buildFilterString(filters)
  const command = ffmpeg(videoPath)
    .videoFilters(filterString)
    .output(outputPath)
    .outputOptions([
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'medium',
      '-crf', '23'
    ])
    .on('progress', (progress) => {
      logger.debug('Filter progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Filter processing completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      filters: filters,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Filter processing failed', { jobId, error: err.message });
    throw err;
  }
}

// Build FFmpeg filter string from filter options
function buildFilterString(filters) {
  const filterParts = []

  if (filters.brightness && filters.brightness !== 100) {
    filterParts.push(`eq=brightness=${(filters.brightness - 100) / 100}`)
  }
  if (filters.contrast && filters.contrast !== 100) {
    filterParts.push(`eq=contrast=${filters.contrast / 100}`)
  }
  if (filters.saturation && filters.saturation !== 100) {
    filterParts.push(`eq=saturation=${filters.saturation / 100}`)
  }
  if (filters.hue && filters.hue !== 0) {
    filterParts.push(`hue=h=${filters.hue}`)
  }
  if (filters.blur && filters.blur > 0) {
    filterParts.push(`boxblur=${filters.blur}`)
  }
  if (filters.sepia && filters.sepia > 0) {
    filterParts.push(`colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131`)
  }

  return filterParts.join(',')
}

// Add audio track to video
async function addAudioToVideo(videoPath, audioPath, options = {}) {
  const { volume = 50, jobId, userId } = options
  const outputFilename = `with-audio-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting audio mixing', { jobId, userId, volume })

  const command = ffmpeg(videoPath)
    .input(audioPath)
    .outputOptions([
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-filter_complex', `[1:a]volume=${volume / 100}[a1];[0:a][a1]amix=inputs=2:duration=first[aout]`,
      '-map', '0:v',
      '-map', '[aout]'
    ])
    .output(outputPath)
    .on('progress', (progress) => {
      logger.debug('Audio mixing progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Audio mixing completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      audioVolume: volume,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Audio mixing failed', { jobId, error: err.message });
    throw err;
  }
}

// Crop and resize video
async function cropVideo(videoPath, cropArea, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `cropped-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting video cropping', { jobId, userId, cropArea })

  const { x = 0, y = 0, width = 100, height = 100 } = cropArea

  const command = ffmpeg(videoPath)
    .videoFilters(`crop=${width/100}*iw:${height/100}*ih:${x/100}*iw:${y/100}*ih`)
    .output(outputPath)
    .outputOptions([
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'medium',
      '-crf', '23'
    ])
    .on('progress', (progress) => {
      logger.debug('Cropping progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Cropping completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      cropArea: cropArea,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Cropping failed', { jobId, error: err.message });
    throw err;
  }
}

// Split video into segments and merge
async function splitAndMergeVideo(videoPath, segments, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `split-merge-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting split and merge', { jobId, userId, segmentCount: segments.length })

  const segmentFilters = segments.map((segment, index) =>
    `[0:v]trim=${segment.start}:${segment.end},setpts=PTS-STARTPTS[v${index}];` +
    `[0:a]atrim=${segment.start}:${segment.end},asetpts=PTS-STARTPTS[a${index}];`
  ).join('')

  const concatInputs = segments.map((_, index) => `[v${index}][a${index}]`).join('')

  const command = ffmpeg(videoPath)
    .complexFilter([
      segmentFilters,
      `${concatInputs}concat=n=${segments.length}:v=1:a=1[v][a]`
    ])
    .outputOptions([
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-c:a', 'aac'
    ])
    .output(outputPath)
    .on('progress', (progress) => {
      logger.debug('Split merge progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Split merge completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      segments: segments,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Split merge failed', { jobId, error: err.message });
    throw err;
  }
}

// Add transitions between segments
async function addTransitions(videoPath, transitionType, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `transitions-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting transition processing', { jobId, userId, transitionType })

  // Simplified transition implementation
  // In a full implementation, you'd have more sophisticated transition effects
  const transitionFilter = transitionType === 'fade' ? 'fade=t=out:st=2:d=1' : 'luma:./luma.png'

  const command = ffmpeg(videoPath)
      .videoFilters(transitionFilter)
      .output(outputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '23'
      ])
      .on('progress', (progress) => {
        logger.debug('Transition progress', { jobId, progress: progress.percent })
      });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Transition processing completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      transitionType: transitionType,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Transition processing failed', { jobId, error: err.message });
    throw err;
  }
}

// Generate AI voiceover
async function generateVoiceover(videoPath, text, options = {}) {
  const { voice = 'alloy', jobId, userId } = options
  const outputFilename = `voiceover-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)
  const audioFilename = `voiceover-${uuidv4()}.mp3`
  const audioPath = getOutputPath(audioFilename)

  logger.info('Starting voiceover generation', { jobId, userId, voice, textLength: text.length })

  try {
    const client = getOpenAIClient();
    if (!client) throw new Error('OpenAI client not initialized');

    // Generate speech using OpenAI TTS
    const mp3 = await client.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    fs.writeFileSync(audioPath, buffer)

    // Get audio duration
    const { getVideoMetadata } = require('./advancedVideoProcessingService')
    const metadata = await getVideoMetadata(audioPath)
    const duration = parseFloat(metadata.duration)

    if (!videoPath) {
      logger.info('Video path not provided, returning only audio voiceover', { jobId })
      return {
        audioResultUrl: `/uploads/processed/${audioFilename}`,
        voice: voice,
        textLength: text.length,
        duration: duration,
        originalSize: 0,
        processedSize: fs.statSync(audioPath).size
      }
    }

    // Mix the generated audio with the video
    const mixCommand = ffmpeg(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-filter_complex', '[0:a]volume=0.3[bg];[1:a]volume=0.8[voice];[bg][voice]amix=inputs=2:duration=first[aout]',
        '-map', '0:v',
        '-map', '[aout]'
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        logger.debug('Voiceover mixing progress', { jobId, progress: progress.percent })
      });

    try {
      await runFFmpegWithTimeout(mixCommand);
      logger.info('Voiceover generation completed', { jobId, outputPath });
      return {
        resultUrl: `/uploads/processed/${outputFilename}`,
        audioResultUrl: `/uploads/processed/${audioFilename}`,
        voice: voice,
        textLength: text.length,
        duration: duration,
        originalSize: fs.statSync(videoPath || outputPath).size,
        processedSize: fs.statSync(outputPath).size
      };
    } catch (err) {
      logger.error('Voiceover mixing failed', { jobId, error: err.message });
      throw err;
    }
  } catch (error) {
    logger.error('Voiceover generation failed', { jobId, error: error.message })
    throw error
  }
}

// Stabilize shaky video
async function stabilizeVideo(videoPath, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `stabilized-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting video stabilization', { jobId, userId })

  // Use vidstab filter for stabilization
  const trfPath = path.join(path.dirname(outputPath), `stab-${uuidv4()}.trf`)
  const command = ffmpeg(videoPath)
    .videoFilters([
      `vidstabdetect=shakiness=10:accuracy=15:result='${trfPath}'`,
      `vidstabtransform=input='${trfPath}':zoom=0:smoothing=30`,
      'unsharp=5:5:0.8:3:3:0.4'
    ])
    .output(outputPath)
    .outputOptions([
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'medium',
      '-crf', '23'
    ])
    .on('progress', (progress) => {
      logger.debug('Stabilization progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Stabilization completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      stabilization: 'vidstab',
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Stabilization failed', { jobId, error: err.message });
    throw err;
  }
}

// Apply professional color correction
async function colorCorrectVideo(videoPath, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `color-corrected-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting color correction', { jobId, userId })

  // Apply professional color grading filters
  const colorFilters = [
    'colorlevels=rimin=0.058:gimin=0.058:bimin=0.058:rimax=0.949:gimax=0.949:bimax=0.949',
    'colormatrix=bt601:bt709',
    'eq=brightness=0.05:saturation=1.1:contrast=1.1:gamma=1.1:gamma_r=1:gamma_g=1.05:gamma_b=1.15',
    'unsharp=5:5:0.8:3:3:0.4'
  ]

  const command = ffmpeg(videoPath)
    .videoFilters(colorFilters)
    .output(outputPath)
    .outputOptions([
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'medium',
      '-crf', '23'
    ])
    .on('progress', (progress) => {
      logger.debug('Color correction progress', { jobId, progress: progress.percent })
    });

  try {
    await runFFmpegWithTimeout(command);
    logger.info('Color correction completed', { jobId, outputPath });
    return {
      resultUrl: `/uploads/processed/${outputFilename}`,
      colorCorrection: 'professional',
      filters: colorFilters,
      originalSize: fs.statSync(videoPath).size,
      processedSize: fs.statSync(outputPath).size
    };
  } catch (err) {
    logger.error('Color correction failed', { jobId, error: err.message });
    throw err;
  }
}

/**
 * PHASE 2.3: Orchestrates final sync between video, dubbed audio, and localized visuals.
 */
async function assembleLocalizedVideo(videoPath, translation, options = {}) {
  const { jobId, userId } = options;
  logger.info('Assembling localized video', { jobId, userId, language: translation.language });

  // 1. Prepare Text Overlays from segments
  const textOverlays = translation.segments.map(seg => ({
    text: seg.translatedText,
    startTime: seg.startTime,
    endTime: seg.endTime,
    x: 50,
    y: 80, // Subtitle position
    fontSize: 28,
    color: '#ffffff'
  }));

  // 2. Apply Text Overlays
  const visualResult = await addTextOverlays(videoPath, textOverlays, { jobId, userId });

  // 3. (Optional) In Ph 2.3 we would also merge the dubbed track here
  // For POC, we just return the visually localized video
  return visualResult;
}

module.exports = {
  addTextOverlays,
  applyVideoFilters,
  addAudioToVideo,
  cropVideo,
  splitAndMergeVideo,
  addTransitions,
  generateVoiceover,
  stabilizeVideo,
  colorCorrectVideo,
  assembleLocalizedVideo
}











