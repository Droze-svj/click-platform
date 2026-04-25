// Scene Audio Visualization Routes
// Provides audio cues and waveform data for UI visualization

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const Scene = require('../../models/Scene');
const { enrichScenesWithAudioTags } = require('../../services/audioAwareSceneAutomation');
const { extractAudioFeatures } = require('../../services/advancedAudioFeatureExtraction');
const router = express.Router();

/**
 * @route GET /api/video/scenes/:contentId/audio-visualization
 * @desc Get scenes with audio cues and waveform data for visualization
 * @access Private
 */
router.get('/:contentId/audio-visualization', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.params;
  const { includeWaveform = true, waveformResolution = 1000 } = req.query;

  try {
    // Get scenes for content
    const scenes = await Scene.find({
      contentId,
      userId: req.user._id
    }).sort({ sceneIndex: 1 });

    if (scenes.length === 0) {
      return sendError(res, 'No scenes found for content', 404);
    }

    // Enrich scenes with audio tags
    const enrichedScenes = enrichScenesWithAudioTags(scenes);

    // Get waveform data if requested
    let waveformData = null;
    if (includeWaveform !== 'false') {
      try {
        const { getVideoFilePath } = require('../../services/sceneDetectionService');
        const videoPath = await getVideoFilePath(contentId);
        
        // Extract audio features for waveform
        const audioFeatures = await extractAudioFeatures(videoPath, {
          windowSize: 0.1, // 100ms windows for waveform
          hopSize: 0.05,
          duration: null
        });

        waveformData = generateWaveformData(audioFeatures, parseInt(waveformResolution) || 1000);
      } catch (error) {
        logger.warn('Failed to generate waveform data', { error: error.message, contentId });
        // Continue without waveform data
      }
    }

    // Build response with scene boundaries and audio cues
    const sceneBoundaries = enrichedScenes.map(scene => ({
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      sceneIndex: scene.sceneIndex,
      confidence: scene.confidence,
      audioTags: scene.audioTags,
      audioSummary: scene.audioSummary
    }));

    // Extract audio cues for timeline markers
    const audioCues = extractAudioCuesForTimeline(enrichedScenes);

    sendSuccess(res, 'Audio visualization data retrieved', 200, {
      scenes: enrichedScenes,
      sceneBoundaries,
      audioCues,
      waveform: waveformData,
      metadata: {
        sceneCount: enrichedScenes.length,
        totalDuration: enrichedScenes.reduce((sum, s) => sum + s.duration, 0),
        audioTagsDistribution: getAudioTagsDistribution(enrichedScenes)
      }
    });
  } catch (error) {
    logger.error('Error getting audio visualization data', {
      error: error.message,
      contentId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to get audio visualization data', 500);
  }
}));

/**
 * Generate waveform data from audio features
 */
function generateWaveformData(audioFeatures, resolution = 1000) {
  if (!audioFeatures || !audioFeatures.windows || audioFeatures.windows.length === 0) {
    return null;
  }

  const windows = audioFeatures.windows;
  const totalSamples = Math.min(resolution, windows.length);

  // Sample windows to match resolution
  const step = Math.max(1, Math.floor(windows.length / totalSamples));
  const samples = [];

  for (let i = 0; i < windows.length; i += step) {
    const window = windows[i];
    const energy = window.energy?.energy || window.features?.energy || 0;
    const time = window.start || (i * (window.duration || 0.1));

    // Normalize energy to 0-1 range for visualization
    const normalizedEnergy = Math.min(1, Math.max(0, energy));

    samples.push({
      time,
      energy: normalizedEnergy,
      // Classification for color coding
      classification: window.classification || {
        voice: 0.33,
        music: 0.33,
        silence: 0.34
      }
    });

    if (samples.length >= totalSamples) break;
  }

  return {
    samples,
    duration: windows.length > 0 ? (windows[windows.length - 1].end || 0) : 0,
    sampleRate: totalSamples
  };
}

/**
 * Extract audio cues for timeline visualization
 */
function extractAudioCuesForTimeline(scenes) {
  const cues = [];

  scenes.forEach(scene => {
    const audioCues = scene.audioCues || [];
    const audioFeatures = scene.audioFeatures || {};

    // Add scene boundary marker
    cues.push({
      time: scene.start,
      type: 'scene_boundary',
      level: 'major',
      sceneIndex: scene.sceneIndex,
      confidence: scene.confidence
    });

    // Add audio cue markers
    audioCues.forEach(cue => {
      const cueTime = cue.timestamp || scene.start;
      
      // Only add if within scene bounds
      if (cueTime >= scene.start && cueTime <= scene.end) {
        cues.push({
          time: cueTime,
          type: cue.type || 'audio_cue',
          level: cue.level || 'minor',
          confidence: cue.confidence || 0.5,
          sceneIndex: scene.sceneIndex,
          metadata: {
            duration: cue.duration,
            metrics: cue.metrics
          }
        });
      }
    });

    // Add classification regions (speech/music/silence)
    const classification = audioFeatures.classification || {};
    const dominantClass = audioFeatures.dominantClass || 
                         (classification.voice > 0.5 ? 'voice' :
                          classification.music > 0.5 ? 'music' :
                          classification.silence > 0.5 ? 'silence' : 'unknown');

    cues.push({
      time: scene.start,
      type: 'audio_region',
      level: 'region',
      sceneIndex: scene.sceneIndex,
      region: {
        start: scene.start,
        end: scene.end,
        class: dominantClass,
        voice: classification.voice || 0,
        music: classification.music || 0,
        silence: classification.silence || 0
      }
    });
  });

  // Sort by time
  cues.sort((a, b) => a.time - b.time);

  return cues;
}

/**
 * Get audio tags distribution
 */
function getAudioTagsDistribution(scenes) {
  const distribution = {};

  scenes.forEach(scene => {
    const tags = scene.audioTags || [];
    tags.forEach(tag => {
      distribution[tag] = (distribution[tag] || 0) + 1;
    });
  });

  return distribution;
}

module.exports = router;







