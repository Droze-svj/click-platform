// Video Render Service
// Renders editor state (filters, overlays) to final video via FFmpeg

const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const Content = require('../models/Content')
const logger = require('../utils/logger')

/**
 * Build FFmpeg video filter chain from editor videoFilters
 */
function buildVideoFilterChain(filters) {
  if (!filters || typeof filters !== 'object') return []
  const f = filters
  const brightness = ((f.brightness ?? 100) - 100) / 100
  const contrast = (f.contrast ?? 100) / 100
  const saturation = (f.saturation ?? 100) / 100
  const filters_out = []

  const eqParts = []
  if (brightness !== 0) eqParts.push(`brightness=${brightness}`)
  if (contrast !== 1) eqParts.push(`contrast=${contrast}`)
  if (saturation !== 1) eqParts.push(`saturation=${saturation}`)
  if (eqParts.length > 0) {
    filters_out.push(`eq=${eqParts.join(':')}`)
  }

  const hue = f.hue ?? 0
  if (hue !== 0) filters_out.push(`hue=h=${hue}`)

  const sepia = (f.sepia ?? 0) / 100
  if (sepia > 0) {
    const s = 1 - sepia * 0.5
    filters_out.push(`colorchannelmixer=rr=${s}:gg=${s}:bb=${s}`)
  }

  const vignette = f.vignette ?? 0
  if (vignette > 0) filters_out.push('vignette=angle=PI/4')

  const blur = f.blur ?? 0
  if (blur > 0) filters_out.push(`boxblur=lr=${Math.max(1, Math.round(blur / 10))}:lp=1`)

  return filters_out
}

/**
 * Build LUT approximation filter (colorchannelmixer/curves) for preset LUTs
 * Uses FFmpeg colorchannelmixer/curves since we don't have .cube files
 */
function buildLUTApproximation(lutId) {
  if (!lutId || lutId === 'none') return []
  switch (lutId) {
    case 'cinematic':
      return ['colorchannelmixer=rr=0.95:gg=0.9:bb=0.85', 'eq=contrast=1.08:saturation=0.95']
    case 'bleach':
      return ['colorchannelmixer=rr=0.9:gg=0.88:bb=0.95', 'eq=contrast=1.12:saturation=0.7']
    case 'log709':
      return ['colorchannelmixer=rr=1.05:gg=1.02:bb=1.0', 'eq=contrast=1.05:brightness=0.02']
    default:
      return []
  }
}

/**
 * Build drawtext filter for a text overlay (escape text for FFmpeg)
 */
function buildDrawTextFilter(overlay) {
  const text = String(overlay.text || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
  const x = `(w-text_w)*${(overlay.x ?? 50) / 100}`
  const y = `(h-text_h)*${(overlay.y ?? 50) / 100}`
  const fontsize = overlay.fontSize ?? 24
  const fontcolor = overlay.color || '#FFFFFF'
  const start = overlay.startTime ?? 0
  const end = overlay.endTime ?? 5
  const enable = `between(t,${start},${end})`
  return `drawtext=text='${text}':fontsize=${fontsize}:fontcolor=${fontcolor}:x=${x}:y=${y}:enable='${enable}'`
}

/**
 * Build drawbox filter for a shape overlay
 */
function buildDrawBoxFilter(shape) {
  const start = shape.startTime ?? 0
  const end = shape.endTime ?? 5
  const enable = `between(t,${start},${end})`
  const x = `(w*${(shape.x ?? 50) / 100})-(w*${(shape.width ?? 20) / 100})/2`
  const y = `(h*${(shape.y ?? 50) / 100})-(h*${(shape.height ?? 20) / 100})/2`
  const w = `w*${(shape.width ?? 20) / 100}`
  const h = shape.kind === 'line' ? (shape.strokeWidth ?? 2) : `h*${(shape.height ?? 20) / 100}`
  const color = (shape.color || '#ffffff').replace('#', '0x')
  const alpha = shape.opacity ?? 0.5
  return `drawbox=x='${x}':y='${y}':w='${w}':h='${h}':color=${color}@${alpha}:t=fill:enable='${enable}'`
}

/**
 * Resolve input path from Content or videoUrl
 */
async function resolveInputPath(videoId, videoUrl) {
  if (videoUrl && (videoUrl.startsWith('http') || videoUrl.startsWith('/'))) {
    if (videoUrl.startsWith('/')) {
      const localPath = path.join(__dirname, '../..', videoUrl)
      if (fs.existsSync(localPath)) return localPath
      return videoUrl
    }
    return videoUrl
  }
  if (!videoId) throw new Error('Video not found: provide videoId or videoUrl')
  const content = await Content.findById(videoId)
  if (!content || !content.originalFile?.url) {
    throw new Error('Video not found in database')
  }
  const url = content.originalFile.url
  if (url.startsWith('/')) {
    return path.join(__dirname, '../..', url)
  }
  return url
}

/**
 * Render video from editor state
 * @param {Object} options
 * @param {string} options.videoId - Content ID
 * @param {string} [options.videoUrl] - Optional video URL (override)
 * @param {Object} options.videoFilters - Editor video filters
 * @param {Array} options.textOverlays - Text overlays
 * @param {Array} [options.shapeOverlays] - Shape overlays
 * @param {Object} options.exportOptions - { width, height, bitrateMbps, codec, duckMusicWhenVoiceover, duckLevel }
 * @param {Array} [options.timelineSegments] - Timeline segments (for music mixing + ducking)
 * @returns {Promise<{ outputPath: string, url?: string }>}
 */
async function renderFromEditorState(options) {
  const {
    videoId,
    videoUrl,
    videoFilters = {},
    textOverlays = [],
    shapeOverlays = [],
    exportOptions = {},
    timelineSegments = [],
  } = options

  const width = exportOptions.width ?? 1920
  const height = exportOptions.height ?? 1080
  const isBestQuality = exportOptions.quality === 'best'
  let bitrateMbps = exportOptions.bitrateMbps ?? 8
  let codec = exportOptions.codec === 'hevc' ? 'libx265' : 'libx264'
  let crf = 23
  let preset = 'medium'
  let audioBitrate = '192k'

  if (isBestQuality) {
    bitrateMbps = Math.max(bitrateMbps, 20)
    crf = 18
    preset = 'slow'
    audioBitrate = '320k'
  }

  const inputPath = await resolveInputPath(videoId, videoUrl)

  if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`)
  }

  const outputDir = path.join(__dirname, '../../uploads/exports')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outputFilename = `render-${videoId || 'export'}-${Date.now()}.mp4`
  const outputPath = path.join(outputDir, outputFilename)

  const videoFilters_ff = buildVideoFilterChain(videoFilters)
  const lutFilters = buildLUTApproximation(videoFilters.lutId)

  const overlayFilters = []
    ; (textOverlays || []).forEach((o) => {
      try {
        overlayFilters.push(buildDrawTextFilter(o))
      } catch (e) {
        logger.warn('Skip text overlay', { error: e.message, overlay: o })
      }
    })
    ; (shapeOverlays || []).forEach((s) => {
      try {
        overlayFilters.push(buildDrawBoxFilter(s))
      } catch (e) {
        logger.warn('Skip shape overlay', { error: e.message, shape: s })
      }
    })

  const allVideoFilters = [...videoFilters_ff, ...lutFilters, ...overlayFilters]
  const filterStr = allVideoFilters.length > 0 ? allVideoFilters.join(',') : null
  const hasMusic = firstMusic && firstMusic.sourceUrl

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
    if (hasMusic) {
      command = command.input(firstMusic.sourceUrl)
    }

    if (hasMusic) {
      const vidPart = filterStr ? `[0:v]${filterStr}[vout]` : '[0:v]copy[vout]'
      const audPart = `[1:a]volume=${musicVolume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=1[aout]`
      const complexStr = `${vidPart};${audPart}`
      command = command
        .complexFilter(complexStr)
        .outputOptions(['-map', '[vout]', '-map', '[aout]'])
    } else if (filterStr) {
      command = command.videoFilters(filterStr)
    }

    command
      .size(`${width}x${height}`)
      .videoCodec(codec)
      .outputOptions([
        `-b:v ${bitrateMbps}M`,
        `-preset ${preset}`,
        `-crf ${crf}`,
        '-movflags +faststart',
      ])
      .audioCodec('aac')
      .outputOptions(['-b:a', audioBitrate])
      .output(outputPath)
      .on('start', (cmd) => logger.info('Render started', { videoId, outputPath }))
      .on('progress', (p) => {
        if (p.percent) logger.debug('Render progress', { percent: p.percent.toFixed(1) })
      })
      .on('end', () => {
        if (fs.existsSync(outputPath)) {
          const url = `/uploads/exports/${outputFilename}`
          logger.info('Render completed', { videoId, outputPath, url })
          resolve({ outputPath, url })
        } else {
          reject(new Error('Output file was not created'))
        }
      })
      .on('error', (err) => {
        logger.error('Render failed', { error: err.message, videoId })
        reject(err)
      })
      .run()
  })
}

module.exports = {
  renderFromEditorState,
  buildVideoFilterChain,
  buildDrawTextFilter,
  buildDrawBoxFilter,
}
