// Scene Editing Service
// Handle scene merging, splitting, and editing operations

const Scene = require('../models/Scene');
const Content = require('../models/Content');
const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');

/**
 * Merge multiple scenes into one
 */
async function mergeScenes(contentId, sceneIds, userId) {
  try {
    // Fetch scenes to merge
    const scenes = await Scene.find({
      _id: { $in: sceneIds },
      contentId,
      userId
    }).sort({ sceneIndex: 1 });

    if (scenes.length < 2) {
      throw new Error('At least 2 scenes required for merging');
    }

    // Calculate merged scene boundaries
    const start = Math.min(...scenes.map(s => s.start));
    const end = Math.max(...scenes.map(s => s.end));
    const duration = end - start;

    // Merge metadata
    const mergedMetadata = mergeSceneMetadata(scenes);

    // Create new merged scene
    const mergedScene = new Scene({
      contentId,
      userId,
      start,
      end,
      duration,
      sceneIndex: scenes[0].sceneIndex, // Use first scene's index
      confidence: Math.max(...scenes.map(s => s.confidence || 0.5)),
      metadata: mergedMetadata,
      isMerged: true,
      mergedFrom: sceneIds,
      version: 1,
      detectionParams: scenes[0].detectionParams || {}
    });

    await mergedScene.save();

    // Mark original scenes as merged
    await Scene.updateMany(
      { _id: { $in: sceneIds } },
      { 
        $set: { 
          isMerged: true,
          splitInto: [mergedScene._id]
        }
      }
    );

    // Reindex remaining scenes
    await reindexScenes(contentId);

    logger.info('Scenes merged', { contentId, sceneIds, mergedSceneId: mergedScene._id });

    // Track edit in analytics
    try {
      const { trackSceneEdit } = require('./sceneDetectionAnalyticsService');
      await trackSceneEdit(contentId, userId, 'scenesMerged');
      
      // Trigger adaptive learning (async, don't block)
      const { updateWorkspaceWithLearnedValues } = require('./adaptiveThresholdService');
      const Scene = require('../models/Scene');
      const scene = await Scene.findById(mergedScene._id);
      if (scene && scene.workspaceId) {
        updateWorkspaceWithLearnedValues(scene.workspaceId.toString()).catch(err => {
          logger.warn('Error updating workspace with learned values', { error: err.message });
        });
      }
    } catch (error) {
      logger.warn('Error tracking scene merge', { error: error.message });
    }

    return mergedScene;
  } catch (error) {
    logger.error('Error merging scenes', { error: error.message, contentId, sceneIds });
    captureException(error, { tags: { service: 'scene_editing', operation: 'merge' } });
    throw error;
  }
}

/**
 * Split a scene into multiple scenes
 */
async function splitScene(sceneId, splitPoints, userId) {
  try {
    const scene = await Scene.findById(sceneId);
    if (!scene || scene.userId.toString() !== userId.toString()) {
      throw new Error('Scene not found');
    }

    if (!splitPoints || splitPoints.length === 0) {
      throw new Error('Split points required');
    }

    // Sort split points
    const sortedPoints = [...splitPoints].sort((a, b) => a - b);
    
    // Validate split points are within scene boundaries
    for (const point of sortedPoints) {
      if (point <= scene.start || point >= scene.end) {
        throw new Error(`Split point ${point} must be within scene boundaries (${scene.start} - ${scene.end})`);
      }
    }

    // Create split scenes
    const newScenes = [];
    let currentStart = scene.start;

    for (let i = 0; i <= sortedPoints.length; i++) {
      const currentEnd = i < sortedPoints.length ? sortedPoints[i] : scene.end;
      const duration = currentEnd - currentStart;

      // Copy metadata proportionally
      const metadata = { ...scene.metadata };
      
      const newScene = new Scene({
        contentId: scene.contentId,
        userId: scene.userId,
        start: currentStart,
        end: currentEnd,
        duration,
        sceneIndex: scene.sceneIndex + i,
        confidence: scene.confidence,
        metadata,
        isMerged: false,
        mergedFrom: [],
        version: scene.version + 1,
        detectionParams: scene.detectionParams,
        isHighlight: scene.isHighlight,
        isPromoted: scene.isPromoted,
        priority: scene.priority
      });

      await newScene.save();
      newScenes.push(newScene);
      currentStart = currentEnd;
    }

    // Mark original scene as split
    await Scene.findByIdAndUpdate(sceneId, {
      $set: {
        isMerged: true,
        splitInto: newScenes.map(s => s._id)
      }
    });

    // Reindex scenes
    await reindexScenes(scene.contentId);

    logger.info('Scene split', { sceneId, splitPoints, newScenesCount: newScenes.length });

    // Track edit in analytics
    try {
      const { trackSceneEdit } = require('./sceneDetectionAnalyticsService');
      await trackSceneEdit(scene.contentId.toString(), userId, 'scenesSplit');
    } catch (error) {
      logger.warn('Error tracking scene split', { error: error.message });
    }

    return newScenes;
  } catch (error) {
    logger.error('Error splitting scene', { error: error.message, sceneId });
    captureException(error, { tags: { service: 'scene_editing', operation: 'split' } });
    throw error;
  }
}

/**
 * Update scene boundaries
 */
async function updateSceneBoundaries(sceneId, start, end, userId) {
  try {
    const scene = await Scene.findById(sceneId);
    if (!scene || scene.userId.toString() !== userId.toString()) {
      throw new Error('Scene not found');
    }

    // Validate boundaries
    if (start >= end) {
      throw new Error('Start time must be less than end time');
    }

    // Check for overlaps with other scenes
    const overlapping = await Scene.findOne({
      contentId: scene.contentId,
      _id: { $ne: sceneId },
      $or: [
        { start: { $gte: start, $lt: end } },
        { end: { $gt: start, $lte: end } },
        { start: { $lte: start }, end: { $gte: end } }
      ]
    });

    if (overlapping) {
      throw new Error('Scene boundaries overlap with another scene');
    }

    const duration = end - start;

    await Scene.findByIdAndUpdate(sceneId, {
      $set: {
        start,
        end,
        duration,
        version: (scene.version || 1) + 1
      }
    });

    logger.info('Scene boundaries updated', { sceneId, start, end });
    return await Scene.findById(sceneId);
  } catch (error) {
    logger.error('Error updating scene boundaries', { error: error.message, sceneId });
    throw error;
  }
}

/**
 * Merge scene metadata from multiple scenes
 */
function mergeSceneMetadata(scenes) {
  const merged = {
    dominantColors: [],
    hasFaces: false,
    faceCount: 0,
    hasSpeech: false,
    speechConfidence: 0,
    tags: new Set(),
    brightness: 0,
    motionLevel: 0,
    label: null
  };

  let totalDuration = 0;

  scenes.forEach(scene => {
    const duration = scene.duration || (scene.end - scene.start);
    totalDuration += duration;

    // Merge dominant colors (weighted by duration)
    if (scene.metadata?.dominantColors) {
      scene.metadata.dominantColors.forEach(color => {
        const weightedColor = {
          ...color,
          percentage: color.percentage * (duration / totalDuration)
        };
        merged.dominantColors.push(weightedColor);
      });
    }

    // Merge face detection (true if any scene has faces)
    if (scene.metadata?.hasFaces) {
      merged.hasFaces = true;
      merged.faceCount += scene.metadata.faceCount || 0;
    }

    // Merge speech (true if any scene has speech)
    if (scene.metadata?.hasSpeech) {
      merged.hasSpeech = true;
      merged.speechConfidence = Math.max(
        merged.speechConfidence,
        scene.metadata.speechConfidence || 0
      );
    }

    // Merge tags
    if (scene.metadata?.tags) {
      scene.metadata.tags.forEach(tag => merged.tags.add(tag));
    }

    // Average brightness and motion (weighted by duration)
    if (scene.metadata?.brightness) {
      merged.brightness += scene.metadata.brightness * (duration / totalDuration);
    }
    if (scene.metadata?.motionLevel) {
      merged.motionLevel += scene.metadata.motionLevel * (duration / totalDuration);
    }

    // Use most common label or first scene's label
    if (!merged.label && scene.metadata?.label) {
      merged.label = scene.metadata.label;
    }
  });

  // Convert Set to Array for tags
  merged.tags = Array.from(merged.tags);

  return merged;
}

/**
 * Reindex scenes after merge/split operations
 */
async function reindexScenes(contentId) {
  const scenes = await Scene.find({ contentId }).sort({ start: 1 });
  
  for (let i = 0; i < scenes.length; i++) {
    await Scene.findByIdAndUpdate(scenes[i]._id, {
      $set: { sceneIndex: i }
    });
  }
}

/**
 * Delete a scene
 */
async function deleteScene(sceneId, userId) {
  try {
    const scene = await Scene.findById(sceneId);
    if (!scene || scene.userId.toString() !== userId.toString()) {
      throw new Error('Scene not found');
    }

    await Scene.findByIdAndDelete(sceneId);
    await reindexScenes(scene.contentId);

    logger.info('Scene deleted', { sceneId });

    // Track edit in analytics
    try {
      const { trackSceneEdit } = require('./sceneDetectionAnalyticsService');
      await trackSceneEdit(scene.contentId.toString(), userId, 'scenesDeleted');
    } catch (error) {
      logger.warn('Error tracking scene deletion', { error: error.message });
    }

    return { success: true };
  } catch (error) {
    logger.error('Error deleting scene', { error: error.message, sceneId });
    throw error;
  }
}

/**
 * Add notes to a scene
 */
async function addSceneNotes(sceneId, notes, userId) {
  try {
    const scene = await Scene.findById(sceneId);
    if (!scene || scene.userId.toString() !== userId.toString()) {
      throw new Error('Scene not found');
    }

    await Scene.findByIdAndUpdate(sceneId, {
      $set: { notes }
    });

    return await Scene.findById(sceneId);
  } catch (error) {
    logger.error('Error adding scene notes', { error: error.message, sceneId });
    throw error;
  }
}

/**
 * Add custom tags to a scene
 */
async function addSceneTags(sceneId, tags, userId) {
  try {
    const scene = await Scene.findById(sceneId);
    if (!scene || scene.userId.toString() !== userId.toString()) {
      throw new Error('Scene not found');
    }

    const currentTags = scene.customTags || [];
    const newTags = Array.isArray(tags) ? tags : [tags];
    const uniqueTags = [...new Set([...currentTags, ...newTags])];

    await Scene.findByIdAndUpdate(sceneId, {
      $set: { customTags: uniqueTags }
    });

    return await Scene.findById(sceneId);
  } catch (error) {
    logger.error('Error adding scene tags', { error: error.message, sceneId });
    throw error;
  }
}

module.exports = {
  mergeScenes,
  splitScene,
  updateSceneBoundaries,
  deleteScene,
  addSceneNotes,
  addSceneTags,
  reindexScenes
};

