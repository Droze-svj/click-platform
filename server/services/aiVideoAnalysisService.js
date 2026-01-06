// AI-powered video content analysis service

const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const OpenAI = require('openai')
const logger = require('../utils/logger')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Helper function to get temp path
function getTempPath(filename) {
  const tempDir = path.join(__dirname, '../temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return path.join(tempDir, filename)
}

// Extract frames from video for analysis
async function extractFrames(videoPath, options = {}) {
  const { count = 10, userId } = options
  const frameDir = getTempPath(`frames-${uuidv4()}`)

  if (!fs.existsSync(frameDir)) {
    fs.mkdirSync(frameDir, { recursive: true })
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: count,
        folder: frameDir,
        filename: 'frame-%i.png',
        size: '320x180'
      })
      .on('end', () => {
        const frameFiles = fs.readdirSync(frameDir)
          .filter(file => file.endsWith('.png'))
          .map(file => path.join(frameDir, file))

        logger.info('Frame extraction completed', { userId, frameCount: frameFiles.length })
        resolve({ frames: frameFiles, tempDir: frameDir })
      })
      .on('error', (err) => {
        logger.error('Frame extraction failed', { userId, error: err.message })
        reject(err)
      })
      .run()
  })
}

// Analyze video pacing and rhythm
async function analyzePacing(videoPath, options = {}) {
  const { userId } = options

  // This would typically involve audio analysis for speech patterns
  // For now, we'll provide mock intelligent analysis

  const pacingAnalysis = {
    score: Math.floor(Math.random() * 30) + 70, // 70-100 score
    suggestions: [
      'Consider adding pauses between key points for better retention',
      'The pacing is generally good but could benefit from more dynamic transitions',
      'Audio levels are consistent throughout the video'
    ]
  }

  logger.info('Pacing analysis completed', { userId, score: pacingAnalysis.score })
  return pacingAnalysis
}

// Detect highlight moments using AI
async function detectHighlights(videoPath, options = {}) {
  const { userId } = options

  try {
    // Extract frames for analysis
    const { frames, tempDir } = await extractFrames(videoPath, { userId })

    // Mock highlight detection - in production, this would use ML models
    const highlights = [
      {
        startTime: 5,
        endTime: 15,
        confidence: 0.85,
        reason: 'High visual interest and clear focal point',
        suggestedAction: 'Keep this segment - strong opening'
      },
      {
        startTime: 42,
        endTime: 52,
        confidence: 0.72,
        reason: 'Emotional peak with good lighting',
        suggestedAction: 'Consider extending this moment'
      },
      {
        startTime: 78,
        endTime: 88,
        confidence: 0.91,
        reason: 'Clear call-to-action with strong composition',
        suggestedAction: 'Perfect closing segment'
      }
    ]

    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (e) {
      logger.warn('Failed to clean up temp frames', { tempDir })
    }

    logger.info('Highlight detection completed', { userId, highlightCount: highlights.length })
    return highlights

  } catch (error) {
    logger.error('Highlight detection failed', { userId, error: error.message })
    return []
  }
}

// Analyze engagement patterns
async function analyzeEngagement(videoPath, options = {}) {
  const { userId } = options

  // Mock engagement analysis
  const engagementAnalysis = {
    score: Math.floor(Math.random() * 25) + 75, // 75-100 score
    peakMoments: [
      { time: 12, intensity: 85 },
      { time: 45, intensity: 92 },
      { time: 78, intensity: 88 }
    ]
  }

  logger.info('Engagement analysis completed', { userId, score: engagementAnalysis.score })
  return engagementAnalysis
}

// Technical quality analysis
async function analyzeTechnicalQuality(videoPath, options = {}) {
  const { userId } = options

  // Get video metadata
  const metadata = await getVideoMetadata(videoPath)

  let quality = 'good'
  const issues = []
  const recommendations = []

  // Analyze resolution
  if (metadata.height < 720) {
    quality = 'fair'
    issues.push('Low resolution - consider 1080p or higher')
    recommendations.push('Export at 1080p for better quality')
  } else if (metadata.height >= 1080) {
    quality = 'excellent'
  }

  // Analyze bitrate
  const minBitrate = metadata.height >= 1080 ? 5000000 : 2000000 // 5Mbps for 1080p, 2Mbps for lower
  if (metadata.bitrate < minBitrate) {
    issues.push('Low bitrate may result in compression artifacts')
    recommendations.push('Increase bitrate for better quality')
  }

  // Analyze duration
  if (metadata.duration > 300) { // 5 minutes
    recommendations.push('Consider breaking long videos into shorter segments')
  }

  // Check audio
  if (!metadata.audioCodec) {
    issues.push('No audio detected')
    quality = quality === 'excellent' ? 'good' : quality
  }

  logger.info('Technical analysis completed', { userId, quality, issueCount: issues.length })
  return { quality, issues, recommendations }
}

// Get detailed video metadata
async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video')
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio')

      const result = {
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        frameRate: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : 0
      }

      resolve(result)
    })
  })
}

// Analyze content themes and mood
async function analyzeContent(videoPath, options = {}) {
  const { userId } = options

  try {
    // Extract a few frames for content analysis
    const { frames, tempDir } = await extractFrames(videoPath, { count: 3, userId })

    // Mock content analysis - in production, use computer vision APIs
    const contentAnalysis = {
      themes: ['educational', 'professional', 'engaging'],
      mood: 'confident',
      targetAudience: ['professionals', 'students', 'content creators']
    }

    // Clean up
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (e) {
      logger.warn('Failed to clean up content analysis frames', { tempDir })
    }

    logger.info('Content analysis completed', { userId, themes: contentAnalysis.themes.length })
    return contentAnalysis

  } catch (error) {
    logger.error('Content analysis failed', { userId, error: error.message })
    return {
      themes: [],
      mood: 'neutral',
      targetAudience: []
    }
  }
}

// Generate intelligent editing suggestions
async function generateEditingSuggestions(videoPath, analysisResults, options = {}) {
  const { userId } = options

  const suggestions = []

  // Analyze highlights for suggestions
  if (analysisResults.highlights?.length > 0) {
    analysisResults.highlights.forEach((highlight, index) => {
      if (highlight.confidence > 0.8) {
        suggestions.push({
          type: 'keep',
          startTime: highlight.startTime,
          endTime: highlight.endTime,
          description: `Keep this highlight - ${highlight.reason}`,
          priority: 'high'
        })
      }
    })
  }

  // Pacing suggestions
  if (analysisResults.pacing?.score < 80) {
    suggestions.push({
      type: 'enhance',
      startTime: 0,
      endTime: Math.min(30, analysisResults.technical?.duration || 30),
      description: 'Consider adding an engaging hook in the first 30 seconds',
      priority: 'high'
    })
  }

  // Technical suggestions
  if (analysisResults.technical?.issues?.length > 0) {
    analysisResults.technical.issues.forEach(issue => {
      suggestions.push({
        type: 'enhance',
        startTime: 0,
        endTime: analysisResults.technical?.duration || 60,
        description: `Technical improvement needed: ${issue}`,
        priority: 'medium'
      })
    })
  }

  // Content-based suggestions
  if (analysisResults.content?.mood === 'neutral') {
    suggestions.push({
      type: 'enhance',
      startTime: Math.floor((analysisResults.technical?.duration || 60) / 2),
      endTime: Math.floor((analysisResults.technical?.duration || 60) / 2) + 10,
      description: 'Consider adding more engaging elements to maintain viewer interest',
      priority: 'medium'
    })
  }

  // Default suggestions
  suggestions.push({
    type: 'transition',
    startTime: Math.floor((analysisResults.technical?.duration || 60) * 0.7),
    endTime: Math.floor((analysisResults.technical?.duration || 60) * 0.7) + 5,
    description: 'Add a smooth transition before the conclusion',
    priority: 'low'
  })

  logger.info('Editing suggestions generated', { userId, suggestionCount: suggestions.length })
  return suggestions
}

// Main analysis function
async function analyzeVideoContent(videoPath, options = {}) {
  const { analysisTypes = ['highlights', 'pacing', 'engagement', 'technical', 'content'], jobId, userId } = options

  logger.info('Starting comprehensive video analysis', { userId, jobId, analysisTypes })

  const results = {}

  // Run requested analyses
  if (analysisTypes.includes('technical')) {
    results.technical = await analyzeTechnicalQuality(videoPath, { userId })
  }

  if (analysisTypes.includes('highlights')) {
    results.highlights = await detectHighlights(videoPath, { userId })
  }

  if (analysisTypes.includes('pacing')) {
    results.pacing = await analyzePacing(videoPath, { userId })
  }

  if (analysisTypes.includes('engagement')) {
    results.engagement = await analyzeEngagement(videoPath, { userId })
  }

  if (analysisTypes.includes('content')) {
    results.content = await analyzeContent(videoPath, { userId })
  }

  // Generate editing suggestions based on all analyses
  results.suggestions = await generateEditingSuggestions(videoPath, results, { userId })

  logger.info('Video analysis completed', {
    userId,
    jobId,
    analysesCompleted: Object.keys(results).length,
    suggestionCount: results.suggestions?.length || 0
  })

  return results
}

module.exports = {
  analyzeVideoContent,
  detectHighlights,
  analyzePacing,
  analyzeEngagement,
  analyzeTechnicalQuality,
  analyzeContent,
  generateEditingSuggestions
}





