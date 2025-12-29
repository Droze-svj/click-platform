// Multi-Modal Scene Detection Service
// Combines visual, audio, and text cues for accurate scene detection

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Multi-modal scene detection combining visual, audio, and text cues
 */
async function detectScenesMultiModal(videoPath, options = {}) {
  const {
    fps = 3,
    sensitivity = 0.3,
    minSceneLength = 1.0,
    maxSceneLength = null,
    workflowType = 'general', // 'tiktok', 'youtube', 'general'
    mergeShortScenes = true,
    shortSceneThreshold = 2.0,
    useClustering = false, // Use shot clustering instead of boundary detection
    clusteringOptions = {} // Options for clustering
  } = options;

  try {
    // Get video duration
    const duration = await getVideoDuration(videoPath);

    // Get workflow-specific constraints
    const constraints = getWorkflowConstraints(workflowType);

    // Step 1: Visual detection (existing method) - these are shot boundaries
    logger.info('Starting visual scene detection (shot boundaries)', { videoPath });
    const visualShotBoundaries = await detectVisualScenes(videoPath, fps, sensitivity, duration);
    
    // Convert to boundary format
    const visualBoundaries = visualShotBoundaries.map(scene => ({
      timestamp: scene.timestamp,
      confidence: scene.confidence || 0.5,
      cues: scene.cues || {}
    }));

    // Step 2: Audio-based detection (enhanced with advanced features and change point detection)
    logger.info('Starting audio scene detection', { videoPath });
    let audioCues = await detectAudioCuesAdvanced(videoPath, duration);
    
    // Also extract advanced audio features if multi-modal is enabled
    if (options.useMultiModal !== false) {
      try {
        const { extractAudioFeatures } = require('./advancedAudioFeatureExtraction');
        const { detectChangePointsFromAudio } = require('./audioChangePointDetection');
        
        const audioFeatures = await extractAudioFeatures(videoPath, {
          windowSize: 0.5,
          hopSize: 0.25,
          aggregateByShots: false // Get windows for change point detection
        });
        
        // Detect audio change points using advanced algorithms
        if (audioFeatures.windows && audioFeatures.windows.length > 0) {
          logger.info('Detecting audio change points', { windowCount: audioFeatures.windows.length });
          
          // Auto-tune parameters
          const { autoTuneParameters } = require('./audioChangePointDetectionAdvanced');
          const { computeFeatureDistances } = require('./audioChangePointDetection');
          const rawDistances = computeFeatureDistances(audioFeatures.windows, 'weighted');
          const tunedParams = autoTuneParameters(rawDistances, audioFeatures.windows);
          
          // Use advanced detection
          const { detectAudioChangePointsAdvanced } = require('./audioChangePointDetectionAdvanced');
          const changePoints = detectAudioChangePointsAdvanced(audioFeatures.windows, {
            distanceMetric: 'weighted',
            threshold: tunedParams.threshold,
            minDistance: tunedParams.minDistance,
            detectClassTransitions: true,
            peakDetectionMethod: 'adaptive',
            smoothing: tunedParams.smoothing,
            smoothingWindow: tunedParams.smoothingWindow,
            multiScale: tunedParams.multiScale,
            validateChangePoints: true,
            hierarchical: true
          });

          // Convert change points to audio cues (prioritize major changes)
          const majorChanges = changePoints.hierarchy?.major || [];
          const minorChanges = changePoints.hierarchy?.minor || [];
          
          // Add major change points first
          [...majorChanges, ...minorChanges].forEach(point => {
            const window = audioFeatures.windows[point.index];
            if (window) {
              audioCues.push({
                timestamp: window.start,
                type: point.type === 'class_transition' 
                  ? `${point.fromClass}_to_${point.toClass}`
                  : 'audio_change',
                confidence: point.confidence || point.validationScore || 0.7,
                distance: point.distance,
                method: point.method || 'feature_distance',
                level: point.level || 'standard',
                validationScore: point.validationScore,
                features: {
                  changeType: point.type,
                  fromClass: point.fromClass,
                  toClass: point.toClass,
                  prominence: point.prominence,
                  scale: point.scale
                }
              });
            }
          });

          logger.info('Audio change points detected', { 
            count: changePoints.changePoints.length,
            segments: changePoints.segments.length 
          });
        }
        
        // Enhance audio cues with aggregated shot features if available
        if (audioFeatures.shots) {
          audioCues = enhanceAudioCuesWithFeatures(audioCues, audioFeatures.shots);
        }
      } catch (error) {
        logger.warn('Advanced audio feature extraction failed, using basic detection', { error: error.message });
      }
    }

    // Step 3: Text-based semantic segmentation (enhanced with NLP)
    logger.info('Starting text-based segmentation', { videoPath });
    const textSegments = await detectTextSegmentsAdvanced(videoPath, duration);

    // Step 4: Visual-Audio Fusion (Visual-first strategy)
    logger.info('Fusing visual and audio boundaries', { videoPath });
    let fusedScenes = [];
    let audioFeatureWindows = null;
    
    // Get audio features for fusion if available
    if (options.useMultiModal !== false && audioCues.length > 0) {
      try {
        const { extractAudioFeatures } = require('./advancedAudioFeatureExtraction');
        const audioFeatures = await extractAudioFeatures(videoPath, {
          windowSize: 0.5,
          hopSize: 0.25,
          aggregateByShots: false
        });
        audioFeatureWindows = audioFeatures;
        
        // Fuse visual boundaries with audio features (advanced)
        const { fuseVisualAudioBoundariesAdvanced, refineBoundariesMultiPass } = require('./visualAudioFusionAdvanced');
        const fusionResult = fuseVisualAudioBoundariesAdvanced(
          visualBoundaries,
          audioFeatures,
          {
            audioThreshold: null, // Auto-tune
            visualThreshold: null, // Auto-tune
            classChangeThreshold: 0.5,
            requireBoth: false, // Use OR logic (more lenient)
            useML: true, // Use ML-based refinement
            temporalConsistency: true, // Check temporal consistency
            adaptiveThresholds: true, // Auto-tune thresholds
            confidenceCalibration: true // Calibrate confidence
          }
        );
        
        // Convert fused boundaries to scene format
        fusedScenes = fusionResult.sceneBoundaries.map((boundary, index) => ({
          start: index > 0 ? fusionResult.sceneBoundaries[index - 1].timestamp : 0,
          end: boundary.timestamp,
          confidence: boundary.confidence,
          sources: boundary.sources || ['visual', 'audio'],
          visualChange: boundary.visualChange,
          audioDistance: boundary.audioDistance,
          audioClassChange: boundary.audioClassChange
        }));
        
        // Add final scene
        if (fusedScenes.length > 0) {
          fusedScenes.push({
            start: fusedScenes[fusedScenes.length - 1].end,
            end: duration,
            confidence: 0.7,
            sources: ['default']
          });
        }
        
        logger.info('Visual-audio fusion completed', {
          visualBoundaries: visualBoundaries.length,
          sceneBoundaries: fusionResult.sceneBoundaries.length,
          shotCuts: fusionResult.shotCuts.length,
          statistics: fusionResult.statistics
        });
        
        // Multi-pass refinement
        const refinedBoundaries = refineBoundariesMultiPass(
          fusionResult.sceneBoundaries,
          audioFeatures,
          {
            maxPasses: 3,
            minConfidenceGain: 0.05
          }
        );
        
        // Update fused scenes if refinement found additional boundaries
        if (refinedBoundaries.length > fusionResult.sceneBoundaries.length) {
          fusedScenes = refinedBoundaries.map((boundary, index) => ({
            start: index > 0 ? refinedBoundaries[index - 1].timestamp : 0,
            end: boundary.timestamp,
            confidence: boundary.confidence,
            sources: boundary.sources || ['visual', 'audio'],
            visualChange: boundary.visualChange,
            audioDistance: boundary.audioDistance
          }));
          
          // Add final scene
          fusedScenes.push({
            start: fusedScenes[fusedScenes.length - 1].end,
            end: duration,
            confidence: 0.7,
            sources: ['default']
          });
        }
      } catch (error) {
        logger.warn('Visual-audio fusion failed, using visual-only', { error: error.message });
        // Fallback to standard fusion
        fusedScenes = fuseMultiModalCues(
          visualBoundaries.map(v => ({ timestamp: v.timestamp, confidence: v.confidence })),
          audioCues,
          textSegments,
          duration,
          constraints
        );
      }
    } else {
      // Fallback to standard fusion if audio features not available
      fusedScenes = fuseMultiModalCues(
        visualBoundaries.map(v => ({ timestamp: v.timestamp, confidence: v.confidence })),
        audioCues,
        textSegments,
        duration,
        constraints
      );
    }

    // Step 5: Post-processing (only if we used standard fusion, visual-audio fusion handles its own)
    logger.info('Post-processing scenes', { videoPath });
    let finalScenes = fusedScenes;
    
    // Only apply post-processing if we used standard fusion
    // Visual-audio fusion already handles scene boundaries properly
    if (!audioFeatureWindows || finalScenes.length === 0 || !finalScenes[0].sources) {
      finalScenes = postProcessScenes(
        fusedScenes,
        {
          minLength: constraints.minLength || minSceneLength,
          maxLength: constraints.maxLength || maxSceneLength,
          mergeShort: mergeShortScenes,
          shortThreshold: shortSceneThreshold
        }
      );
    } else {
      // Light post-processing for visual-audio fused scenes
      finalScenes = finalScenes.filter(scene => {
        const duration = scene.end - scene.start;
        return duration >= (constraints.minLength || minSceneLength);
      });
    }

    // Step 6: Score and rank scenes by quality
    logger.info('Scoring scene quality', { videoPath });
    const { rankScenesByQuality } = require('./sceneQualityService');
    finalScenes = rankScenesByQuality(finalScenes, {
      optimalDuration: constraints.preferredLength
    });

    logger.info('Multi-modal scene detection completed', {
      visualScenes: visualScenes.length,
      audioCues: audioCues.length,
      textSegments: textSegments.length,
      finalScenes: finalScenes.length
    });

    return finalScenes;
  } catch (error) {
    logger.error('Error in multi-modal scene detection', { error: error.message });
    captureException(error, { tags: { service: 'multi_modal_scene_detection' } });
    throw error;
  }
}

/**
 * Detect visual scene changes (enhanced with composition and camera angle)
 */
async function detectVisualScenes(videoPath, fps, sensitivity, duration) {
  // Use existing histogram-based detection but enhanced
  const sceneChanges = [];
  const tempDir = path.join(os.tmpdir(), `visual-scene-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract frames at specified FPS
    const framePattern = path.join(tempDir, 'frame-%06d.jpg');
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .fps(fps)
        .outputOptions(['-q:v', '2'])
        .output(framePattern)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const frames = fs.readdirSync(tempDir)
      .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
      .map(f => path.join(tempDir, f))
      .sort();

    if (frames.length < 2) {
      return [];
    }

    // Analyze frames for multiple visual cues
    const frameAnalyses = await Promise.all(
      frames.map((frame, index) => analyzeFrame(frame, index))
    );

    // Compare consecutive frames
    const threshold = sensitivity;
    for (let i = 1; i < frameAnalyses.length; i++) {
      const diff = compareFrameAnalyses(frameAnalyses[i - 1], frameAnalyses[i]);
      
      if (diff > threshold) {
        const timestamp = (i / fps);
        if (timestamp < duration) {
          sceneChanges.push({
            timestamp,
            confidence: diff,
            cues: {
              color: frameAnalyses[i].colorDiff,
              composition: frameAnalyses[i].compositionDiff,
              camera: frameAnalyses[i].cameraAngleDiff
            }
          });
        }
      }
    }

    // Cleanup
    frames.forEach(frame => {
      if (fs.existsSync(frame)) fs.unlinkSync(frame);
    });
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);

    return sceneChanges;
  } catch (error) {
    logger.warn('Visual scene detection failed', { error: error.message });
    // Cleanup on error
    try {
      const frames = fs.readdirSync(tempDir);
      frames.forEach(frame => {
        const framePath = path.join(tempDir, frame);
        if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
      });
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    return [];
  }
}

/**
 * Analyze frame for multiple visual cues
 */
async function analyzeFrame(framePath, index) {
  const sharp = require('sharp');
  
  try {
    const image = sharp(framePath);
    const { data, info } = await image
      .resize(200, 200, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate histogram for color analysis
    const histogram = calculateHistogram(data, info);

    // Analyze composition (center vs edges)
    const composition = analyzeComposition(data, info);

    // Estimate camera angle (simplified - based on edge detection)
    const cameraAngle = estimateCameraAngle(data, info);

    return {
      index,
      histogram,
      composition,
      cameraAngle,
      colorDiff: 0, // Will be calculated during comparison
      compositionDiff: 0,
      cameraAngleDiff: 0
    };
  } catch (error) {
    logger.warn('Error analyzing frame', { framePath, error: error.message });
    return {
      index,
      histogram: null,
      composition: null,
      cameraAngle: null,
      colorDiff: 0,
      compositionDiff: 0,
      cameraAngleDiff: 0
    };
  }
}

/**
 * Calculate histogram from pixel data
 */
function calculateHistogram(data, info) {
  const bins = { r: new Array(32).fill(0), g: new Array(32).fill(0), b: new Array(32).fill(0) };
  const pixelCount = data.length / info.channels;

  for (let i = 0; i < data.length; i += info.channels) {
    bins.r[Math.floor(data[i] / 8)]++;
    bins.g[Math.floor(data[i + 1] / 8)]++;
    bins.b[Math.floor(data[i + 2] / 8)]++;
  }

  // Normalize
  bins.r = bins.r.map(v => v / pixelCount);
  bins.g = bins.g.map(v => v / pixelCount);
  bins.b = bins.b.map(v => v / pixelCount);

  return bins;
}

/**
 * Analyze composition (center vs edges)
 */
function analyzeComposition(data, info) {
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  
  // Divide frame into regions: center, edges
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const regionSize = Math.min(width, height) / 4;

  let centerBrightness = 0;
  let edgeBrightness = 0;
  let centerCount = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;

      const isCenter = 
        Math.abs(x - centerX) < regionSize && 
        Math.abs(y - centerY) < regionSize;

      if (isCenter) {
        centerBrightness += brightness;
        centerCount++;
      } else {
        edgeBrightness += brightness;
        edgeCount++;
      }
    }
  }

  return {
    centerBrightness: centerCount > 0 ? centerBrightness / centerCount : 0,
    edgeBrightness: edgeCount > 0 ? edgeBrightness / edgeCount : 0,
    ratio: centerCount > 0 && edgeCount > 0 
      ? (centerBrightness / centerCount) / (edgeBrightness / edgeCount)
      : 1
  };
}

/**
 * Estimate camera angle (simplified - based on edge distribution)
 */
function estimateCameraAngle(data, info) {
  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  // Simple edge detection using Sobel-like approach
  let horizontalEdges = 0;
  let verticalEdges = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];

      // Horizontal gradient
      const hDiff = Math.abs(
        data[((y - 1) * width + x) * channels] - 
        data[((y + 1) * width + x) * channels]
      );
      horizontalEdges += hDiff;

      // Vertical gradient
      const vDiff = Math.abs(
        data[(y * width + (x - 1)) * channels] - 
        data[(y * width + (x + 1)) * channels]
      );
      verticalEdges += vDiff;
    }
  }

  const totalPixels = (width - 2) * (height - 2);
  return {
    horizontalEdgeStrength: horizontalEdges / totalPixels,
    verticalEdgeStrength: verticalEdges / totalPixels,
    angle: Math.atan2(verticalEdges, horizontalEdges) * (180 / Math.PI)
  };
}

/**
 * Compare two frame analyses
 */
function compareFrameAnalyses(analysis1, analysis2) {
  let totalDiff = 0;
  let weightSum = 0;

  // Color difference (weight: 0.4)
  if (analysis1.histogram && analysis2.histogram) {
    const colorDiff = compareHistograms(analysis1.histogram, analysis2.histogram);
    analysis2.colorDiff = colorDiff;
    totalDiff += colorDiff * 0.4;
    weightSum += 0.4;
  }

  // Composition difference (weight: 0.3)
  if (analysis1.composition && analysis2.composition) {
    const compDiff = Math.abs(
      analysis1.composition.ratio - analysis2.composition.ratio
    );
    analysis2.compositionDiff = compDiff;
    totalDiff += compDiff * 0.3;
    weightSum += 0.3;
  }

  // Camera angle difference (weight: 0.3)
  if (analysis1.cameraAngle && analysis2.cameraAngle) {
    const angleDiff = Math.abs(
      analysis1.cameraAngle.angle - analysis2.cameraAngle.angle
    ) / 180; // Normalize to 0-1
    analysis2.cameraAngleDiff = angleDiff;
    totalDiff += angleDiff * 0.3;
    weightSum += 0.3;
  }

  return weightSum > 0 ? totalDiff / weightSum : 0;
}

/**
 * Compare histograms
 */
function compareHistograms(hist1, hist2) {
  let totalDiff = 0;
  
  for (const channel of ['r', 'g', 'b']) {
    for (let i = 0; i < hist1[channel].length; i++) {
      const diff = Math.pow(hist1[channel][i] - hist2[channel][i], 2);
      totalDiff += diff;
    }
  }

  return Math.min(1.0, totalDiff / (hist1.r.length * 3));
}

/**
 * Detect audio cues using advanced analysis
 */
async function detectAudioCuesAdvanced(videoPath, duration) {
  try {
    const { analyzeAudioSegmentAdvanced, compareAudioAnalysesAdvanced } = require('./advancedAudioAnalysis');
    
    const cues = [];
    const segmentDuration = 1.0; // 1 second segments
    const segments = Math.ceil(duration / segmentDuration);
    let previousAnalysis = null;

    for (let i = 0; i < segments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);

      try {
        const analysis = await analyzeAudioSegmentAdvanced(videoPath, startTime, endTime);
        
        // Compare with previous segment
        if (previousAnalysis) {
          const comparison = compareAudioAnalysesAdvanced(previousAnalysis, analysis);

          // Detect significant changes
          if (comparison.totalChange > 0.3) {
            // Determine change type
            let changeType = 'volume_change';
            if (comparison.metrics.musicChange > 0.4) {
              changeType = 'music_change';
            } else if (comparison.metrics.speechChange > 0.5) {
              changeType = 'speech_change';
            }

            cues.push({
              timestamp: startTime,
              type: changeType,
              confidence: comparison.totalChange,
              metrics: comparison.metrics
            });
          }
        }

        // Detect silence
        if (analysis.isSilence) {
          cues.push({
            timestamp: startTime,
            type: 'silence',
            confidence: 0.9,
            duration: endTime - startTime
          });
        }

        // Detect applause
        if (analysis.isApplause) {
          cues.push({
            timestamp: startTime,
            type: 'applause',
            confidence: analysis.applauseConfidence
          });
        }

        previousAnalysis = analysis;
      } catch (error) {
        logger.warn('Error analyzing audio segment', { startTime, error: error.message });
      }
    }

    return cues;
  } catch (error) {
    logger.warn('Advanced audio cue detection failed, using simple method', { error: error.message });
    return await detectAudioCues(videoPath, duration);
  }
}

/**
 * Detect audio cues (music changes, silence, applause) - simple version
 */
async function detectAudioCues(videoPath, duration) {
  const cues = [];
  const tempAudioPath = path.join(os.tmpdir(), `audio-analysis-${Date.now()}.wav`);

  try {
    // Extract audio
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .output(tempAudioPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Analyze audio in segments
    const segmentDuration = 1.0; // 1 second segments
    const segments = Math.ceil(duration / segmentDuration);

    for (let i = 0; i < segments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, duration);

      try {
        const analysis = await analyzeAudioSegment(videoPath, startTime, endTime);
        
        // Detect significant changes
        if (i > 0) {
          const prevAnalysis = await analyzeAudioSegment(videoPath, (i - 1) * segmentDuration, i * segmentDuration);
          const diff = compareAudioAnalyses(prevAnalysis, analysis);

          if (diff.musicChange > 0.3) {
            cues.push({
              timestamp: startTime,
              type: 'music_change',
              confidence: diff.musicChange
            });
          }

          if (diff.volumeChange > 0.4) {
            cues.push({
              timestamp: startTime,
              type: 'volume_change',
              confidence: diff.volumeChange
            });
          }
        }

        // Detect silence
        if (analysis.isSilence) {
          cues.push({
            timestamp: startTime,
            type: 'silence',
            confidence: 0.9,
            duration: endTime - startTime
          });
        }

        // Detect applause (high frequency, rhythmic pattern)
        if (analysis.isApplause) {
          cues.push({
            timestamp: startTime,
            type: 'applause',
            confidence: analysis.applauseConfidence
          });
        }
      } catch (error) {
        logger.warn('Error analyzing audio segment', { startTime, error: error.message });
      }
    }

    // Cleanup
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }

    return cues;
  } catch (error) {
    logger.warn('Audio cue detection failed', { error: error.message });
    // Cleanup
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }
    return [];
  }
}

/**
 * Analyze audio segment
 */
async function analyzeAudioSegment(videoPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    const tempSegment = path.join(os.tmpdir(), `audio-seg-${Date.now()}.wav`);

    ffmpeg(videoPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .output(tempSegment)
      .on('end', async () => {
        try {
          // Use ffmpeg to analyze audio
          const analysis = await getAudioAnalysis(tempSegment);
          
          // Cleanup
          if (fs.existsSync(tempSegment)) {
            fs.unlinkSync(tempSegment);
          }

          resolve(analysis);
        } catch (error) {
          if (fs.existsSync(tempSegment)) {
            fs.unlinkSync(tempSegment);
          }
          reject(error);
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(tempSegment)) {
          fs.unlinkSync(tempSegment);
        }
        reject(error);
      })
      .run();
  });
}

/**
 * Get audio analysis using ffmpeg
 */
function getAudioAnalysis(audioPath) {
  return new Promise((resolve, reject) => {
    // Use ffmpeg's silencedetect and volumedetect filters
    let volume = -50;
    let isSilence = false;
    let spectralData = null;

    ffmpeg(audioPath)
      .outputOptions([
        '-af', 'volumedetect',
        '-f', 'null'
      ])
      .on('stderr', (stderrLine) => {
        // Parse volume detection
        const meanVolumeMatch = stderrLine.match(/mean_volume: ([\d.-]+) dB/);
        if (meanVolumeMatch) {
          volume = parseFloat(meanVolumeMatch[1]);
          isSilence = volume < -40; // Threshold for silence
        }
      })
      .on('end', () => {
        // Detect applause (simplified - high frequency content)
        // In production, use proper audio analysis library
        const isApplause = volume > -20 && !isSilence;
        
        resolve({
          volume,
          isSilence,
          isApplause,
          applauseConfidence: isApplause ? 0.7 : 0,
          spectralData
        });
      })
      .on('error', (error) => {
        // Fallback
        resolve({
          volume: -30,
          isSilence: false,
          isApplause: false,
          applauseConfidence: 0,
          spectralData: null
        });
      })
      .run();
  });
}

/**
 * Compare audio analyses
 */
function compareAudioAnalyses(analysis1, analysis2) {
  const volumeDiff = Math.abs(analysis1.volume - analysis2.volume) / 60; // Normalize to 0-1
  const musicChange = volumeDiff > 0.3 ? volumeDiff : 0; // Significant change indicates music change

  return {
    volumeChange: Math.min(1.0, volumeDiff),
    musicChange: musicChange
  };
}

/**
 * Detect text-based semantic segments using advanced NLP
 */
async function detectTextSegmentsAdvanced(videoPath, duration) {
  try {
    const { generateTranscriptFromVideo } = require('./whisperService');
    const { segmentTranscriptAdvanced } = require('./textSegmentationService');
    
    // Generate transcript
    const transcriptText = await generateTranscriptFromVideo(videoPath);

    if (!transcriptText || transcriptText.trim().length === 0) {
      return [];
    }

    // Use advanced NLP-based segmentation
    const segments = segmentTranscriptAdvanced(transcriptText, duration);

    return segments.map(seg => ({
      start: seg.start,
      end: seg.end,
      type: 'semantic',
      confidence: seg.confidence || 0.8,
      reason: seg.reason
    }));
  } catch (error) {
    logger.warn('Advanced text segmentation failed, using simple method', { error: error.message });
    return await detectTextSegments(videoPath, duration);
  }
}

/**
 * Detect text-based semantic segments from transcript (simple version)
 */
async function detectTextSegments(videoPath, duration) {
  try {
    const { generateTranscriptFromVideo } = require('./whisperService');
    
    // Generate transcript
    const transcriptText = await generateTranscriptFromVideo(videoPath);

    if (!transcriptText || transcriptText.trim().length === 0) {
      return [];
    }

    // Split transcript into paragraphs
    const paragraphs = transcriptText.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      return [];
    }

    // Estimate time per paragraph (assuming uniform distribution)
    const timePerParagraph = duration / paragraphs.length;
    const segments = [];

    for (let i = 0; i < paragraphs.length - 1; i++) {
      segments.push({
        start: i * timePerParagraph,
        end: (i + 1) * timePerParagraph,
        type: 'semantic',
        confidence: 0.6
      });
    }

    return segments;
  } catch (error) {
    logger.warn('Text-based segmentation failed', { error: error.message });
    return [];
  }
}

/**
 * Detect topic change in text
 */
function detectTopicChange(text, currentTopic) {
  // Simple heuristic: detect paragraph breaks, question marks, topic keywords
  const topicKeywords = ['now', 'next', 'let\'s', 'moving on', 'another', 'finally'];
  const hasTopicKeyword = topicKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );

  const hasQuestion = text.includes('?');
  const hasParagraphBreak = text.includes('\n\n') || text.length > 200;

  return hasTopicKeyword || (hasQuestion && hasParagraphBreak);
}

/**
 * Extract topic from text
 */
function extractTopic(text) {
  // Simple: use first few words as topic
  const words = text.split(' ').slice(0, 5);
  return words.join(' ').toLowerCase();
}

/**
 * Fuse multi-modal cues into final scene boundaries
 */
function fuseMultiModalCues(visualScenes, audioCues, textSegments, duration, constraints) {
  const allBoundaries = [];
  const weights = {
    visual: 0.4,
    audio: 0.3,
    text: 0.3
  };

  // Collect all boundaries with weights
  visualScenes.forEach(scene => {
    allBoundaries.push({
      timestamp: scene.timestamp,
      confidence: scene.confidence * weights.visual,
      source: 'visual',
      cues: scene.cues
    });
  });

  audioCues.forEach(cue => {
    allBoundaries.push({
      timestamp: cue.timestamp,
      confidence: cue.confidence * weights.audio,
      source: 'audio',
      type: cue.type
    });
  });

  textSegments.forEach(segment => {
    allBoundaries.push({
      timestamp: segment.start,
      confidence: segment.confidence * weights.text,
      source: 'text',
      type: 'semantic'
    });
  });

  // Sort by timestamp
  allBoundaries.sort((a, b) => a.timestamp - b.timestamp);

  // Merge nearby boundaries (within 1 second)
  const mergedBoundaries = [];
  let currentBoundary = null;

  for (const boundary of allBoundaries) {
    if (!currentBoundary) {
      currentBoundary = { ...boundary };
    } else if (boundary.timestamp - currentBoundary.timestamp < 1.0) {
      // Merge boundaries
      currentBoundary.confidence = Math.max(
        currentBoundary.confidence,
        boundary.confidence
      );
      // Combine sources
      if (!currentBoundary.sources) {
        currentBoundary.sources = [currentBoundary.source];
      }
      currentBoundary.sources.push(boundary.source);
    } else {
      mergedBoundaries.push(currentBoundary);
      currentBoundary = { ...boundary };
    }
  }

  if (currentBoundary) {
    mergedBoundaries.push(currentBoundary);
  }

  // Collect audio cues by timestamp for scene assignment
  const audioCuesByTime = {};
  audioCues.forEach(cue => {
    const timeKey = Math.floor(cue.timestamp);
    if (!audioCuesByTime[timeKey]) {
      audioCuesByTime[timeKey] = [];
    }
    audioCuesByTime[timeKey].push(cue);
  });

  // Build scene boundaries
  const scenes = [];
  let startTime = 0;

  for (const boundary of mergedBoundaries) {
    const sceneDuration = boundary.timestamp - startTime;
    
    // Apply minimum length constraint
    if (sceneDuration >= (constraints.minLength || 1.0)) {
      // Get audio cues for this scene
      const sceneAudioCues = [];
      for (let t = Math.floor(startTime); t < Math.floor(boundary.timestamp); t++) {
        if (audioCuesByTime[t]) {
          sceneAudioCues.push(...audioCuesByTime[t]);
        }
      }

      scenes.push({
        start: startTime,
        end: boundary.timestamp,
        duration: boundary.timestamp - startTime,
        confidence: boundary.confidence,
        sources: boundary.sources || [boundary.source],
        cues: boundary.cues || {},
        audioCues: sceneAudioCues.map(cue => ({
          type: cue.type,
          timestamp: cue.timestamp,
          confidence: cue.confidence,
          duration: cue.duration,
          metrics: cue.metrics
        })),
        metadata: {} // Will be populated later
      });
      startTime = boundary.timestamp;
    }
  }

  // Add final scene
  const finalDuration = duration - startTime;
  if (finalDuration >= (constraints.minLength || 1.0)) {
    // Get audio cues for final scene
    const sceneAudioCues = [];
    for (let t = Math.floor(startTime); t < Math.floor(duration); t++) {
      if (audioCuesByTime[t]) {
        sceneAudioCues.push(...audioCuesByTime[t]);
      }
    }

    scenes.push({
      start: startTime,
      end: duration,
      duration: duration - startTime,
      confidence: 0.7,
      sources: ['default'],
      cues: {},
      audioCues: sceneAudioCues.map(cue => ({
        type: cue.type,
        timestamp: cue.timestamp,
        confidence: cue.confidence,
        duration: cue.duration,
        metrics: cue.metrics
      })),
      metadata: {} // Will be populated later
    });
  }

  return scenes;
}

/**
 * Post-process scenes: merge short scenes, enforce constraints
 */
function postProcessScenes(scenes, options = {}) {
  const {
    minLength = 1.0,
    maxLength = null,
    mergeShort = true,
    shortThreshold = 2.0
  } = options;

  let processed = [...scenes];

  // Merge very short scenes into neighbors
  if (mergeShort) {
    processed = mergeShortScenes(processed, shortThreshold, minLength);
  }

  // Enforce minimum length
  processed = processed.filter(scene => {
    const duration = scene.end - scene.start;
    return duration >= minLength;
  });

  // Enforce maximum length (split if needed)
  if (maxLength) {
    processed = splitLongScenes(processed, maxLength);
  }

  return processed;
}

/**
 * Merge short scenes into neighbors (improved algorithm)
 */
function mergeShortScenes(scenes, threshold, minLength) {
  if (scenes.length === 0) return [];
  
  const merged = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const duration = scene.duration || (scene.end - scene.start);

    if (duration < threshold && duration < minLength) {
      // Smart merging: prefer merging with scene that has lower confidence
      // or is also short, creating better-balanced scenes
      if (i > 0 && i < scenes.length - 1) {
        // Check both neighbors
        const prevDuration = merged[merged.length - 1].duration || 
          (merged[merged.length - 1].end - merged[merged.length - 1].start);
        const nextDuration = scenes[i + 1].duration || 
          (scenes[i + 1].end - scenes[i + 1].start);
        
        // Merge with shorter neighbor to balance scene lengths
        if (prevDuration <= nextDuration) {
          merged[merged.length - 1].end = scene.end;
          merged[merged.length - 1].duration = merged[merged.length - 1].end - merged[merged.length - 1].start;
          merged[merged.length - 1].confidence = Math.max(
            merged[merged.length - 1].confidence,
            scene.confidence
          );
          // Merge audio cues
          if (scene.audioCues) {
            merged[merged.length - 1].audioCues = [
              ...(merged[merged.length - 1].audioCues || []),
              ...scene.audioCues
            ];
          }
        } else {
          // Merge with next (will be handled in next iteration)
          scenes[i + 1].start = scene.start;
          scenes[i + 1].duration = scenes[i + 1].end - scenes[i + 1].start;
          scenes[i + 1].confidence = Math.max(scenes[i + 1].confidence, scene.confidence);
          if (scene.audioCues) {
            scenes[i + 1].audioCues = [...(scenes[i + 1].audioCues || []), ...scene.audioCues];
          }
        }
      } else if (i > 0) {
        // Only previous neighbor exists
        merged[merged.length - 1].end = scene.end;
        merged[merged.length - 1].duration = merged[merged.length - 1].end - merged[merged.length - 1].start;
        merged[merged.length - 1].confidence = Math.max(
          merged[merged.length - 1].confidence,
          scene.confidence
        );
        if (scene.audioCues) {
          merged[merged.length - 1].audioCues = [
            ...(merged[merged.length - 1].audioCues || []),
            ...scene.audioCues
          ];
        }
      } else {
        // First scene, keep it
        merged.push({ ...scene, duration });
      }
    } else {
      merged.push({ ...scene, duration });
    }
  }

  return merged;
}

/**
 * Split scenes that exceed maximum length
 */
function splitLongScenes(scenes, maxLength) {
  const split = [];

  for (const scene of scenes) {
    const duration = scene.end - scene.start;

    if (duration > maxLength) {
      // Split into multiple scenes
      const numSplits = Math.ceil(duration / maxLength);
      const splitDuration = duration / numSplits;

      for (let i = 0; i < numSplits; i++) {
        split.push({
          start: scene.start + (i * splitDuration),
          end: scene.start + ((i + 1) * splitDuration),
          confidence: scene.confidence,
          sources: scene.sources,
          cues: scene.cues
        });
      }
    } else {
      split.push(scene);
    }
  }

  return split;
}

/**
 * Enhance audio cues with advanced features
 */
function enhanceAudioCuesWithFeatures(audioCues, shotFeatures) {
  // Add speaker change cues
  shotFeatures.forEach((shot, index) => {
    if (shot.features?.speakerChange?.hasChange) {
      audioCues.push({
        timestamp: shot.start,
        type: 'speaker_change',
        confidence: shot.features.speakerChange.probability,
        features: {
          mfccDistance: shot.features.mfccs?.[0]?.variance || 0,
          spectralVariance: shot.features.spectral?.centroid?.variance || 0
        }
      });
    }
    
    // Add voice/music transition cues
    if (index > 0) {
      const prev = shotFeatures[index - 1];
      const prevVoice = prev.features?.classification?.voice || 0;
      const prevMusic = prev.features?.classification?.music || 0;
      const currVoice = shot.features?.classification?.voice || 0;
      const currMusic = shot.features?.classification?.music || 0;
      
      // Voice to music or vice versa
      if ((prevVoice > 0.6 && currMusic > 0.6) || (prevMusic > 0.6 && currVoice > 0.6)) {
        audioCues.push({
          timestamp: shot.start,
          type: 'music_change',
          confidence: 0.8,
          reason: 'voice_music_transition'
        });
      }
    }
    
    // Add energy spike cues
    if (shot.features?.energy?.changes?.max > 0.3) {
      audioCues.push({
        timestamp: shot.start,
        type: 'volume_change',
        confidence: shot.features.energy.changes.max,
        features: {
          energyChange: shot.features.energy.changes.max
        }
      });
    }
  });
  
  return audioCues;
}

/**
 * Get workflow-specific constraints
 */
function getWorkflowConstraints(workflowType) {
  const constraints = {
    tiktok: {
      minLength: 1.0,
      maxLength: 60.0,
      preferredLength: 15.0
    },
    youtube: {
      minLength: 5.0,
      maxLength: 300.0,
      preferredLength: 60.0
    },
    instagram: {
      minLength: 1.0,
      maxLength: 60.0,
      preferredLength: 30.0
    },
    general: {
      minLength: 1.0,
      maxLength: null,
      preferredLength: null
    }
  };

  return constraints[workflowType] || constraints.general;
}

/**
 * Get video duration
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

/**
 * Detect scenes using shot clustering approach
 */
async function detectScenesWithClustering(videoPath, visualShotBoundaries, duration, options = {}) {
  const {
    minSceneLength = 2.0,
    maxSceneLength = 60.0,
    workflowType = 'general',
    useAdvanced = true,
    optimizeCoherence = true,
    dynamicThresholds = true,
    refineBoundaries = true,
    classifySceneTypes = true
  } = options;

  try {
    // Convert visual boundaries to shots
    const shots = visualShotBoundaries.map((boundary, index) => ({
      start: index > 0 ? visualShotBoundaries[index - 1].timestamp : 0,
      end: boundary.timestamp,
      timestamp: boundary.timestamp,
      confidence: boundary.confidence || 0.5,
      cues: boundary.cues || {}
    }));

    // Add final shot
    if (shots.length > 0) {
      shots.push({
        start: shots[shots.length - 1].end,
        end: duration,
        timestamp: duration,
        confidence: 0.5,
        cues: {}
      });
    }

    // Extract audio features
    const { extractAudioFeatures } = require('./advancedAudioFeatureExtraction');
    const audioFeatures = await extractAudioFeatures(videoPath, {
      windowSize: 0.5,
      hopSize: 0.25,
      duration
    });

    // Cluster shots into scenes
    const { clusterShotsIntoScenesAdvanced } = require('./shotClusteringAdvanced');
    const clusteringResult = clusterShotsIntoScenesAdvanced(shots, audioFeatures, {
      minSceneLength,
      maxSceneLength,
      useAdvanced,
      optimizeCoherence,
      dynamicThresholds,
      refineBoundaries,
      classifySceneTypes
    });

    // Convert to scene format compatible with multi-modal detection
    const scenes = clusteringResult.scenes.map((scene, index) => ({
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      confidence: scene.features ? 
        (scene.features.visual?.averageChange || 0.7) : 0.7,
      sceneIndex: index,
      sources: ['clustering'],
      cues: [],
      decision: {
        isSceneBoundary: true,
        reason: `Clustered scene (${scene.sceneType || 'general'})`
      },
      sceneType: scene.sceneType,
      typeConfidence: scene.typeConfidence,
      shotCount: scene.shotCount,
      features: scene.features
    }));

    return scenes;
  } catch (error) {
    logger.error('Error in clustering-based scene detection', { error: error.message });
    throw error;
  }
}

module.exports = {
  detectScenesMultiModal,
  detectVisualScenes,
  detectAudioCues,
  detectAudioCuesAdvanced,
  detectTextSegments,
  detectTextSegmentsAdvanced,
  fuseMultiModalCues,
  postProcessScenes,
  detectScenesWithClustering
};

