// Scene Workflow Service
// Handles scene-based workflow triggers and actions

const Scene = require('../models/Scene');
const Content = require('../models/Content');
const Workflow = require('../models/Workflow');
const AutomationRule = require('../models/AutomationRule');
const logger = require('../utils/logger');
const { detectScenes } = require('./sceneDetectionService');
const { trimVideo } = require('./advancedVideoProcessingService');
const { generateTranscriptFromVideo } = require('./whisperService');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Trigger scene-based workflows when scenes are detected
 */
async function triggerSceneWorkflows(contentId, scenes) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const userId = content.userId;

    // Find workflows triggered by scene detection
    const workflows = await Workflow.find({
      userId,
      'triggers.type': 'event',
      'triggers.config.event': 'scenes_detected',
      isActive: true,
      status: 'active'
    }).lean();

    const triggered = [];

    for (const workflow of workflows) {
      try {
        // Check conditions (e.g., scene count, scene types)
        const conditionsMet = await checkSceneConditions(workflow.conditions || [], scenes, content);
        
        if (conditionsMet) {
          // Execute workflow actions with scene context
          const context = {
            contentId,
            userId: userId.toString(),
            scenes,
            content
          };

          const results = await executeSceneWorkflowActions(workflow.actions || [], context);
          
          triggered.push({
            workflowId: workflow._id,
            workflowName: workflow.name,
            status: 'executed',
            results
          });
        }
      } catch (error) {
        logger.error('Error executing scene workflow', { workflowId: workflow._id, error: error.message });
        triggered.push({
          workflowId: workflow._id,
          workflowName: workflow.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    logger.info('Scene workflows triggered', { contentId, triggered: triggered.length });
    return triggered;
  } catch (error) {
    logger.error('Error triggering scene workflows', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Check if scene conditions are met
 */
async function checkSceneConditions(conditions, scenes, content) {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means always execute
  }

  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    let conditionValue;
    
    // Extract value from scenes or content
    if (field.startsWith('scene.')) {
      const sceneField = field.replace('scene.', '');
      conditionValue = getSceneAggregateValue(scenes, sceneField);
    } else if (field.startsWith('scenes.')) {
      conditionValue = getScenesAggregateValue(scenes, field);
    } else {
      conditionValue = content[field];
    }

    if (!evaluateCondition(conditionValue, operator, value)) {
      return false;
    }
  }

  return true;
}

/**
 * Get aggregate value from scenes
 */
function getSceneAggregateValue(scenes, field) {
  if (field === 'count') {
    return scenes.length;
  }
  if (field === 'hasHighlights') {
    return scenes.some(s => s.isHighlight || s.isPromoted);
  }
  if (field === 'hasKeyMoments') {
    return scenes.some(s => s.isKeyMoment);
  }
  if (field === 'averageDuration') {
    return scenes.reduce((sum, s) => sum + (s.duration || 0), 0) / scenes.length;
  }
  return null;
}

/**
 * Get aggregate value from scenes collection
 */
function getScenesAggregateValue(scenes, field) {
  // Handle fields like 'scenes.count', 'scenes.withSpeech', etc.
  const parts = field.split('.');
  if (parts.length === 2) {
    const subField = parts[1];
    if (subField === 'count') {
      return scenes.length;
    }
    if (subField === 'withSpeech') {
      return scenes.filter(s => s.metadata?.hasSpeech).length;
    }
    if (subField === 'withFaces') {
      return scenes.filter(s => s.metadata?.hasFaces).length;
    }
    if (subField === 'under60s') {
      return scenes.filter(s => (s.duration || 0) < 60).length;
    }
  }
  return null;
}

/**
 * Evaluate condition
 */
function evaluateCondition(value, operator, expected) {
  switch (operator) {
    case 'equals':
      return value === expected;
    case 'not_equals':
      return value !== expected;
    case 'greater_than':
      return Number(value) > Number(expected);
    case 'less_than':
      return Number(value) < Number(expected);
    case 'contains':
      return String(value).includes(String(expected));
    case 'in':
      return Array.isArray(expected) && expected.includes(value);
    default:
      return false;
  }
}

/**
 * Execute scene-based workflow actions
 */
async function executeSceneWorkflowActions(actions, context) {
  const results = [];

  for (const action of actions) {
    try {
      let result;

      switch (action.type) {
        case 'create_clips_from_scenes':
          result = await createClipsFromScenesInternal(context, action.config);
          break;
        case 'generate_captions_for_scenes':
          result = await generateCaptionsForScenesInternal(context, action.config);
          break;
        case 'create_carousel_from_scenes':
          result = await createCarouselFromScenesInternal(context, action.config);
          break;
        case 'tag_key_moments':
          result = await tagKeyMomentsInternal(context, action.config);
          break;
        case 'export_scene_analytics':
          result = await exportSceneAnalyticsInternal(context, action.config);
          break;
        case 'notify':
          result = await notifySceneDetection(context, action.config);
          break;
        default:
          logger.warn('Unknown scene workflow action', { actionType: action.type });
          result = { success: false, error: 'Unknown action type' };
      }

      results.push({ action: action.type, success: true, result });
    } catch (error) {
      logger.error('Error executing scene workflow action', { actionType: action.type, error: error.message });
      results.push({ action: action.type, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Create clips from scenes (for automation service)
 */
async function createClipsFromScenesAction(config, context) {
  const { contentId } = config;
  const Content = require('../models/Content');
  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error('Content not found');
  }

  const { getScenesForAsset } = require('./sceneDetectionService');
  const scenesResult = await getScenesForAsset(contentId);
  
  return await createClipsFromScenes({
    contentId,
    userId: context.userId || content.userId.toString(),
    scenes: scenesResult.scenes,
    content
  }, config);
}

/**
 * Generate captions for scenes (for automation service)
 */
async function generateCaptionsForScenesAction(config, context) {
  const { contentId } = config;
  const Content = require('../models/Content');
  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error('Content not found');
  }

  const { getScenesForAsset } = require('./sceneDetectionService');
  const scenesResult = await getScenesForAsset(contentId);
  
  return await generateCaptionsForScenes({
    contentId,
    scenes: scenesResult.scenes,
    content
  }, config);
}

/**
 * Create carousel from scenes (for automation service)
 */
async function createCarouselFromScenesAction(config, context) {
  const { contentId } = config;
  const Content = require('../models/Content');
  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error('Content not found');
  }

  const { getScenesForAsset } = require('./sceneDetectionService');
  const scenesResult = await getScenesForAsset(contentId);
  
  return await createCarouselFromScenes({
    contentId,
    scenes: scenesResult.scenes,
    content
  }, config);
}

/**
 * Tag key moments (for automation service)
 */
async function tagKeyMomentsAction(config, context) {
  const { contentId } = config;
  const { getScenesForAsset } = require('./sceneDetectionService');
  const scenesResult = await getScenesForAsset(contentId);
  
  return await tagKeyMoments({
    contentId,
    scenes: scenesResult.scenes
  }, config);
}

/**
 * Export scene analytics (for automation service)
 */
async function exportSceneAnalyticsAction(config, context) {
  const { contentId } = config;
  const { getScenesForAsset } = require('./sceneDetectionService');
  const scenesResult = await getScenesForAsset(contentId);
  
  return await exportSceneAnalytics({
    contentId,
    scenes: scenesResult.scenes
  }, config);
}

/**
 * Internal implementations (used by workflow service)
 */
const createClipsFromScenesInternal = createClipsFromScenes;
const generateCaptionsForScenesInternal = generateCaptionsForScenes;
const createCarouselFromScenesInternal = createCarouselFromScenes;
const tagKeyMomentsInternal = tagKeyMoments;
const exportSceneAnalyticsInternal = exportSceneAnalytics;

/**
 * Create clips from scenes
 */
async function createClipsFromScenes(context, config = {}) {
  const { contentId, scenes, content } = context;
  const {
    maxDuration = 60,
    minDuration = 5,
    platforms = ['tiktok', 'instagram'],
    generateCaptions = true
  } = config;

  const clipsCreated = [];

  // Filter scenes by duration
  const eligibleScenes = scenes.filter(scene => {
    const duration = scene.duration || (scene.end - scene.start);
    return duration >= minDuration && duration <= maxDuration;
  });

  // Get video file path
  const videoUrl = content.originalFile?.url;
  if (!videoUrl) {
    throw new Error('Video file not found');
  }

  // Download video to temp location
  const tempVideoPath = await downloadVideo(videoUrl);

  try {
    for (const scene of eligibleScenes) {
      const clipPath = path.join(__dirname, '../../uploads/clips', `scene-${contentId}-${scene.sceneIndex}.mp4`);
      const clipDir = path.dirname(clipPath);
      if (!fs.existsSync(clipDir)) {
        fs.mkdirSync(clipDir, { recursive: true });
      }

      // Extract clip
      await trimVideo(tempVideoPath, clipPath, scene.start, scene.end - scene.start);

      // Generate caption if requested
      let caption = null;
      if (generateCaptions) {
        try {
          const transcript = await generateTranscriptFromVideo(clipPath);
          caption = transcript || `Scene ${scene.sceneIndex + 1}`;
        } catch (error) {
          logger.warn('Error generating caption for clip', { error: error.message });
        }
      }

      clipsCreated.push({
        sceneId: scene._id || scene.sceneIndex,
        clipPath,
        start: scene.start,
        end: scene.end,
        duration: scene.end - scene.start,
        caption,
        platforms
      });
    }

    logger.info('Clips created from scenes', { contentId, count: clipsCreated.length });
    return { clips: clipsCreated, count: clipsCreated.length };
  } finally {
    // Cleanup temp video
    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      fs.unlinkSync(tempVideoPath);
    }
  }
}

/**
 * Generate captions for scenes
 */
async function generateCaptionsForScenes(context, config = {}) {
  const { scenes, content } = context;
  const captions = [];

  for (const scene of scenes) {
    try {
      // Extract scene segment and generate transcript
      let tempVideoPath;
      try {
        const { getVideoFilePath } = require('./sceneDetectionService');
        tempVideoPath = await getVideoFilePath(contentId);
      } catch (error) {
        const videoUrl = content.originalFile?.url;
        if (!videoUrl) continue;
        tempVideoPath = await downloadVideo(videoUrl);
      }

      const os = require('os');
      const tempClipPath = path.join(os.tmpdir(), `scene-${scene.sceneIndex}-${Date.now()}.mp4`);

      try {
        await trimVideo(tempVideoPath, tempClipPath, scene.start, scene.end - scene.start);
        const transcript = await generateTranscriptFromVideo(tempClipPath);

        captions.push({
          sceneId: scene._id || scene.sceneIndex,
          caption: transcript,
          start: scene.start,
          end: scene.end
        });

        // Update scene in database if it has _id
        if (scene._id) {
          await Scene.findByIdAndUpdate(scene._id, {
            $set: { 'metadata.caption': transcript }
          });
        }
      } finally {
        if (fs.existsSync(tempClipPath)) fs.unlinkSync(tempClipPath);
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      }
    } catch (error) {
      logger.warn('Error generating caption for scene', { sceneIndex: scene.sceneIndex, error: error.message });
    }
  }

  return { captions, count: captions.length };
}

/**
 * Create carousel/thread from scenes
 */
async function createCarouselFromScenes(context, config = {}) {
  const { contentId, scenes, content } = context;
  const {
    format = 'carousel', // 'carousel' or 'thread'
    maxScenes = 10,
    includeCaptions = true
  } = config;

  // Select top scenes (by priority, highlights, or order)
  const selectedScenes = scenes
    .sort((a, b) => {
      if (a.isPromoted !== b.isPromoted) return b.isPromoted - a.isPromoted;
      if (a.isHighlight !== b.isHighlight) return b.isHighlight - a.isHighlight;
      return (b.priority || 0) - (a.priority || 0);
    })
    .slice(0, maxScenes);

  const carouselItems = selectedScenes.map((scene, index) => ({
    order: index + 1,
    sceneId: scene._id || scene.sceneIndex,
    start: scene.start,
    end: scene.end,
    thumbnail: scene.metadata?.thumbnailUrl,
    caption: includeCaptions ? scene.metadata?.caption : null,
    label: scene.metadata?.label
  }));

  // Store carousel configuration in content
  await Content.findByIdAndUpdate(contentId, {
    $set: {
      'generatedContent.carousel': {
        format,
        items: carouselItems,
        createdAt: new Date()
      }
    }
  });

  return { carousel: carouselItems, format, count: carouselItems.length };
}

/**
 * Tag key moments in scenes
 */
async function tagKeyMoments(context, config = {}) {
  const { scenes, contentId } = context;
  const {
    motionThreshold = 0.7,
    detectSlideChanges = true
  } = config;

  let taggedCount = 0;

  for (const scene of scenes) {
    const shouldTag = 
      (scene.metadata?.motionLevel || 0) > motionThreshold ||
      (detectSlideChanges && scene.metadata?.tags?.includes('screen-share'));

    if (shouldTag && scene._id) {
      await Scene.findByIdAndUpdate(scene._id, {
        $set: {
          isKeyMoment: true,
          keyMomentReason: scene.metadata?.motionLevel > motionThreshold ? 'motion_spike' : 'slide_change'
        }
      });
      taggedCount++;
    }
  }

  logger.info('Key moments tagged', { contentId, count: taggedCount });
  return { taggedCount };
}

/**
 * Export scene analytics
 */
async function exportSceneAnalytics(context, config = {}) {
  const { contentId, scenes } = context;
  
  // Get video performance data if available
  const VideoMetrics = require('../models/VideoMetrics');
  const videoMetrics = await VideoMetrics.findOne({ postId: contentId }).lean();
  
  // Build analytics with scene-level insights
  const analytics = {
    totalScenes: scenes.length,
    averageDuration: scenes.reduce((sum, s) => sum + (s.duration || 0), 0) / scenes.length,
    sceneTypes: {},
    highlights: scenes.filter(s => s.isHighlight || s.isPromoted).length,
    keyMoments: scenes.filter(s => s.isKeyMoment).length,
    scenesWithSpeech: scenes.filter(s => s.metadata?.hasSpeech).length,
    scenesWithFaces: scenes.filter(s => s.metadata?.hasFaces).length,
    sceneBreakdown: []
  };

  // Analyze each scene
  scenes.forEach(scene => {
    const label = scene.metadata?.label || 'unknown';
    analytics.sceneTypes[label] = (analytics.sceneTypes[label] || 0) + 1;

    // Map performance metrics to scenes if available
    let performance = null;
    if (videoMetrics) {
      // Estimate scene performance based on watch time curves
      // This is a simplified version - in production, use actual watch-time data
      performance = {
        estimatedViewRate: Math.random() * 0.3 + 0.5, // Placeholder
        estimatedEngagement: Math.random() * 0.2 + 0.4 // Placeholder
      };
    }

    analytics.sceneBreakdown.push({
      sceneId: scene._id || scene.sceneIndex,
      start: scene.start,
      end: scene.end,
      duration: scene.duration,
      label: scene.metadata?.label,
      isHighlight: scene.isHighlight || scene.isPromoted,
      isKeyMoment: scene.isKeyMoment,
      performance
    });
  });

  // Store in content analytics
  await Content.findByIdAndUpdate(contentId, {
    $set: { 'analytics.sceneAnalytics': analytics }
  });

  // If export format specified, generate export
  if (config.format === 'json' || config.exportToFile) {
    // Could generate JSON/CSV export file here
    logger.info('Scene analytics ready for export', { contentId });
  }

  return analytics;
}

/**
 * Notify about scene detection
 */
async function notifySceneDetection(context, config = {}) {
  const { contentId, scenes, userId } = context;
  const { sendNotification } = require('./notificationService');

  await sendNotification(userId, {
    title: 'Scenes Detected',
    message: `Detected ${scenes.length} scenes in your video`,
    type: 'info',
    data: { contentId, sceneCount: scenes.length }
  });

  return { notified: true };
}

/**
 * Download video from URL (fallback method)
 */
async function downloadVideo(videoUrl) {
  const axios = require('axios');
  const os = require('os');
  const tempPath = path.join(os.tmpdir(), `scene-workflow-${Date.now()}.mp4`);

  try {
    const response = await axios({
      url: videoUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 300000
    });

    const writer = fs.createWriteStream(tempPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(tempPath));
      writer.on('error', reject);
    });
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

// Export functions
module.exports = {
  triggerSceneWorkflows,
  executeSceneWorkflowActions,
  // Functions used by routes (with full context)
  createClipsFromScenes: createClipsFromScenesInternal,
  generateCaptionsForScenes: generateCaptionsForScenesInternal,
  createCarouselFromScenes: createCarouselFromScenesInternal,
  tagKeyMoments: tagKeyMomentsInternal,
  exportSceneAnalytics: exportSceneAnalyticsInternal,
  // Functions for automation service (accept config and context separately)
  createClipsFromScenesAction,
  generateCaptionsForScenesAction,
  createCarouselFromScenesAction,
  tagKeyMomentsAction,
  exportSceneAnalyticsAction
};

