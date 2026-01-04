// Enhanced video processing service with creative editing features

const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper function to get output path
function getOutputPath(filename) {
  const outputDir = path.join(__dirname, '../uploads/processed')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  return path.join(outputDir, filename)
}

// Add text overlays to video
async function addTextOverlays(videoPath, textOverlays, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `text-overlay-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting text overlay processing', { jobId, userId, overlayCount: textOverlays.length })

  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath)

    // Add text overlays using drawtext filter
    textOverlays.forEach((overlay, index) => {
      const fontSize = overlay.fontSize || 24
      const color = overlay.color || '#ffffff'
      const x = `(${overlay.x || 50}*w/100)`
      const y = `(${overlay.y || 50}*h/100)`
      const startTime = overlay.startTime || 0
      const endTime = overlay.endTime || (startTime + 5)

      command = command.inputOptions([
        '-f', 'lavfi',
        '-i', `color=black:size=1x1:duration=${endTime - startTime}:rate=1`
      ]).complexFilter([
        `[0:v]drawtext=text='${overlay.text.replace(/'/g, '\\\'')}':fontsize=${fontSize}:fontcolor=${color}:x=${x}:y=${y}:enable='between(t,${startTime},${endTime})'[v${index}]`
      ])
    })

    command
      .output(outputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'medium',
        '-crf', '23'
      ])
      .on('progress', (progress) => {
        logger.debug('Text overlay progress', { jobId, progress: progress.percent })
      })
      .on('end', () => {
        logger.info('Text overlay processing completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size,
          duration: textOverlays.length * 5 // Approximate
        })
      })
      .on('error', (err) => {
        logger.error('Text overlay processing failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
}

// Apply video filters (brightness, contrast, saturation, etc.)
async function applyVideoFilters(videoPath, filters, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `filtered-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting video filter processing', { jobId, userId, filters })

  return new Promise((resolve, reject) => {
    const filterString = buildFilterString(filters)

    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Filter processing completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          filters: filters,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Filter processing failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
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

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Audio mixing completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          audioVolume: volume,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Audio mixing failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
}

// Crop and resize video
async function cropVideo(videoPath, cropArea, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `cropped-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting video cropping', { jobId, userId, cropArea })

  const { x = 0, y = 0, width = 100, height = 100 } = cropArea

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Cropping completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          cropArea: cropArea,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Cropping failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
}

// Split video into segments and merge
async function splitAndMergeVideo(videoPath, segments, options = {}) {
  const { jobId, userId } = options
  const outputFilename = `split-merge-${uuidv4()}.mp4`
  const outputPath = getOutputPath(outputFilename)

  logger.info('Starting split and merge', { jobId, userId, segmentCount: segments.length })

  return new Promise((resolve, reject) => {
    // For simplicity, create a concatenated version of the segments
    // In a full implementation, you'd create temporary segment files and concatenate them

    const segmentFilters = segments.map((segment, index) =>
      `[0:v]trim=${segment.start}:${segment.end},setpts=PTS-STARTPTS[v${index}];` +
      `[0:a]atrim=${segment.start}:${segment.end},asetpts=PTS-STARTPTS[a${index}];`
    ).join('')

    const concatInputs = segments.map((_, index) => `[v${index}][a${index}]`).join('')

    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Split merge completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          segments: segments,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Split merge failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
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

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Transition processing completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          transitionType: transitionType,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Transition processing failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
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
    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())
    fs.writeFileSync(audioPath, buffer)

    // Mix the generated audio with the video
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions([
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-filter_complex', '[1:a]volume=0.7[a1];[0:a][a1]amix=inputs=2:duration=first[aout]',
          '-map', '0:v',
          '-map', '[aout]'
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          logger.debug('Voiceover mixing progress', { jobId, progress: progress.percent })
        })
        .on('end', () => {
          logger.info('Voiceover generation completed', { jobId, outputPath })

          // Clean up temporary audio file
          try {
            fs.unlinkSync(audioPath)
          } catch (e) {
            logger.warn('Failed to clean up temporary audio file', { audioPath })
          }

          resolve({
            resultUrl: `/uploads/processed/${outputFilename}`,
            voice: voice,
            textLength: text.length,
            originalSize: fs.statSync(videoPath).size,
            processedSize: fs.statSync(outputPath).size
          })
        })
        .on('error', (err) => {
          logger.error('Voiceover mixing failed', { jobId, error: err.message })
          reject(err)
        })
        .run()
    })
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

  return new Promise((resolve, reject) => {
    // Use vidstab filter for stabilization
    ffmpeg(videoPath)
      .videoFilters([
        'vidstabdetect=shakiness=10:accuracy=15:result=transform_vectors.trf',
        'vidstabtransform=input=transform_vectors.trf:zoom=0:smoothing=30',
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
      })
      .on('end', () => {
        logger.info('Stabilization completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          stabilization: 'vidstab',
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Stabilization failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
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

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
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
      })
      .on('end', () => {
        logger.info('Color correction completed', { jobId, outputPath })
        resolve({
          resultUrl: `/uploads/processed/${outputFilename}`,
          colorCorrection: 'professional',
          filters: colorFilters,
          originalSize: fs.statSync(videoPath).size,
          processedSize: fs.statSync(outputPath).size
        })
      })
      .on('error', (err) => {
        logger.error('Color correction failed', { jobId, error: err.message })
        reject(err)
      })
      .run()
  })
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
  colorCorrectVideo
}



