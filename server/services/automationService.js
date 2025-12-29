// Automation Service
// Execute automation rules

const AutomationRule = require('../models/AutomationRule');
const logger = require('../utils/logger');

/**
 * Execute automation rule
 */
async function executeAutomationRule(ruleId, context = {}) {
  try {
    const rule = await AutomationRule.findById(ruleId);
    if (!rule || !rule.enabled) {
      throw new Error('Rule not found or disabled');
    }

    // Check conditions
    if (rule.conditions && rule.conditions.length > 0) {
      const conditionsMet = await checkConditions(rule.conditions, context);
      if (!conditionsMet) {
        logger.info('Automation conditions not met', { ruleId, context });
        return { executed: false, reason: 'conditions_not_met' };
      }
    }

    // Execute actions
    const results = [];
    for (const action of rule.actions) {
      try {
        // Add ruleId to context for analytics tracking
        const actionContext = {
          ...context,
          ruleId: rule._id.toString()
        };
        const result = await executeAction(action, actionContext);
        results.push({ action: action.type, success: true, result });
      } catch (error) {
        logger.error('Error executing action', { ruleId, action: action.type, error: error.message });
        results.push({ action: action.type, success: false, error: error.message });
        rule.stats.failures++;
      }
    }

    // Update stats
    rule.stats.executions++;
    rule.stats.successes++;
    rule.stats.lastExecuted = new Date();
    await rule.save();

    return { executed: true, results };
  } catch (error) {
    logger.error('Error executing automation rule', { error: error.message, ruleId });
    
    // Update failure stats
    const rule = await AutomationRule.findById(ruleId);
    if (rule) {
      rule.stats.failures++;
      rule.stats.lastError = error.message;
      await rule.save();
    }

    throw error;
  }
}

/**
 * Check conditions
 */
async function checkConditions(conditions, context) {
  // Check if we have scenes in context for audio conditions
  if (context.scenes && Array.isArray(context.scenes)) {
    const audioConditions = conditions.filter(c => c.audioCriteria);
    if (audioConditions.length > 0) {
      const audioMet = await checkAudioConditions(context.scenes, audioConditions);
      if (!audioMet) {
        return false;
      }
    }
  }

  // Check standard conditions
  for (const condition of conditions) {
    // Skip audio conditions (already checked)
    if (condition.audioCriteria) {
      continue;
    }

    const value = getValueFromContext(context, condition.field);
    const met = evaluateCondition(value, condition.operator, condition.value);
    
    if (!met) {
      return false;
    }
  }
  return true;
}

/**
 * Get value from context
 */
function getValueFromContext(context, field) {
  const parts = field.split('.');
  let value = context;
  
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) {
      return null;
    }
  }
  
  return value;
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
    case 'contains':
      return String(value).includes(String(expected));
    case 'greater_than':
      return Number(value) > Number(expected);
    case 'less_than':
      return Number(value) < Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(value);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(value);
    default:
      return false;
  }
}

/**
 * Execute action with enhanced error handling
 */
async function executeAction(action, context) {
  const { executeWithCircuitBreakerAndRetry, handleAutomationError } = require('./automationErrorHandling');

  try {
    return await executeWithCircuitBreakerAndRetry(async (ctx) => {
      return await executeActionInternal(action, ctx);
    }, action.type, context);
  } catch (error) {
    const errorContext = handleAutomationError(error, {
      ...context,
      actionType: action.type
    });
    throw error;
  }
}

/**
 * Internal action execution
 */
async function executeActionInternal(action, context) {
  switch (action.type) {
    case 'create_content':
      return await createContent(action.config, context);
    case 'update_content':
      return await updateContent(action.config, context);
    case 'publish_content':
      return await publishContent(action.config, context);
    case 'schedule_content':
      return await scheduleContent(action.config, context);
    case 'send_notification':
      return await sendNotification(action.config, context);
    case 'assign_task':
      return await assignTask(action.config, context);
    case 'update_status':
      return await updateStatus(action.config, context);
    case 'webhook':
      return await callWebhook(action.config, context);
    case 'email':
      return await sendEmail(action.config, context);
    case 'detect_scenes':
      return await detectScenes(action.config, context);
    case 'create_clips_from_scenes':
      if (!sceneWorkflowActions) throw new Error('Scene workflow service not available');
      return await sceneWorkflowActions.createClipsFromScenes(action.config, context);
    case 'generate_captions_for_scenes':
      if (!sceneWorkflowActions) throw new Error('Scene workflow service not available');
      return await sceneWorkflowActions.generateCaptionsForScenes(action.config, context);
    case 'create_carousel_from_scenes':
      if (!sceneWorkflowActions) throw new Error('Scene workflow service not available');
      return await sceneWorkflowActions.createCarouselFromScenes(action.config, context);
    case 'tag_key_moments':
      if (!sceneWorkflowActions) throw new Error('Scene workflow service not available');
      return await sceneWorkflowActions.tagKeyMoments(action.config, context);
    case 'export_scene_analytics':
      if (!sceneWorkflowActions) throw new Error('Scene workflow service not available');
      return await sceneWorkflowActions.exportSceneAnalytics(action.config, context);
    case 'create_clips_with_audio_criteria':
      return await createClipsWithAudioCriteria(action.config, context);
    case 'skip_segments_by_audio':
      return await skipSegmentsByAudio(action.config, context);
    case 'generate_music_for_scenes':
      return await generateMusicForScenes(action.config, context);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * Scene workflow actions (imported functions for automation)
 */
let sceneWorkflowActions;
try {
  sceneWorkflowActions = require('./sceneWorkflowService');
} catch (error) {
  logger.warn('Scene workflow service not available', { error: error.message });
}

/**
 * Detect scenes in video
 */
async function detectScenes(config, context) {
  try {
    const { detectScenes: detectScenesService } = require('./sceneDetectionService');
    const { videoUrl, videoId, sensitivity, minSceneLength, maxScenes, fps, extractMetadata } = config;
    const userId = context.userId || context.user?._id?.toString();

    // Determine video identifier
    let videoUrlOrId = videoId || videoUrl;
    
    if (!videoUrlOrId) {
      // Try to get videoId from context
      const contentId = context.contentId || context.content?._id?.toString();
      if (!contentId) {
        throw new Error('videoUrl or videoId required for scene detection');
      }
      videoUrlOrId = contentId;
    }

    return await detectScenesService(videoUrlOrId, {
      sensitivity,
      minSceneLength,
      maxScenes,
      fps,
      extractMetadata,
      userId
    });
  } catch (error) {
    logger.error('Automation: Detect scenes error', { error: error.message, config, context });
    throw error;
  }
}

/**
 * Create content (placeholder)
 */
async function createContent(config, context) {
  // Would create content
  logger.info('Automation: Create content', { config, context });
  return { success: true };
}

/**
 * Update content (placeholder)
 */
async function updateContent(config, context) {
  logger.info('Automation: Update content', { config, context });
  return { success: true };
}

/**
 * Publish content (placeholder)
 */
async function publishContent(config, context) {
  logger.info('Automation: Publish content', { config, context });
  return { success: true };
}

/**
 * Schedule content (placeholder)
 */
async function scheduleContent(config, context) {
  logger.info('Automation: Schedule content', { config, context });
  return { success: true };
}

/**
 * Send notification (placeholder)
 */
async function sendNotification(config, context) {
  logger.info('Automation: Send notification', { config, context });
  return { success: true };
}

/**
 * Assign task (placeholder)
 */
async function assignTask(config, context) {
  logger.info('Automation: Assign task', { config, context });
  return { success: true };
}

/**
 * Update status (placeholder)
 */
async function updateStatus(config, context) {
  logger.info('Automation: Update status', { config, context });
  return { success: true };
}

/**
 * Call webhook (placeholder)
 */
async function callWebhook(config, context) {
  logger.info('Automation: Call webhook', { config, context });
  return { success: true };
}

/**
 * Send email (placeholder)
 */
async function sendEmail(config, context) {
  logger.info('Automation: Send email', { config, context });
  return { success: true };
}

/**
 * Create clips with audio criteria
 */
async function createClipsWithAudioCriteria(config, context) {
  const startTime = Date.now();
  let result;

  try {
    const useAdaptiveLearning = config.useAdaptiveLearning !== false;
    
    let createClipsFunction;
    if (useAdaptiveLearning) {
      const { createClipsWithAdaptiveLearning } = require('./audioAwareSceneAutomationAdvanced');
      createClipsFunction = createClipsWithAdaptiveLearning;
    } else {
      const { createClipsFromAudioFilteredScenes } = require('./audioAwareSceneAutomation');
      createClipsFunction = createClipsFromAudioFilteredScenes;
    }

    const contentId = config.contentId || context.contentId || context.content?._id?.toString();
    const userId = context.userId || context.user?._id?.toString();

    if (!contentId || !userId) {
      throw new Error('contentId and userId required for audio-filtered clip creation');
    }

    const criteria = config.audioCriteria || {};
    const clipConfig = config.clipConfig || {};

    result = await createClipsFunction(contentId, userId, criteria, clipConfig);

    // Track analytics
    const duration = Date.now() - startTime;
    if (context.ruleId) {
      const { trackAutomationExecution } = require('./automationAnalyticsService');
      await trackAutomationExecution(context.ruleId, {
        duration,
        scenesProcessed: result.scenesProcessed || 0,
        scenesFiltered: result.scenesFiltered || 0,
        clipsCreated: result.clipsCreated || 0,
        success: true,
        criteria,
        adaptiveThresholds: result.adaptiveThresholds || null
      }).catch(err => logger.warn('Failed to track automation analytics', { error: err.message }));
    }

    return result;
  } catch (error) {
    logger.error('Automation: Create clips with audio criteria error', {
      error: error.message,
      config,
      context
    });

    // Track failed execution
    const duration = Date.now() - startTime;
    if (context.ruleId) {
      const { trackAutomationExecution } = require('./automationAnalyticsService');
      await trackAutomationExecution(context.ruleId, {
        duration,
        scenesProcessed: 0,
        scenesFiltered: 0,
        clipsCreated: 0,
        success: false,
        errors: [error.message]
      }).catch(err => logger.warn('Failed to track automation analytics', { error: err.message }));
    }

    throw error;
  }
}

/**
 * Skip segments by audio criteria
 */
async function skipSegmentsByAudio(config, context) {
  try {
    const { skipSegmentsByAudioCriteria } = require('./audioAwareSceneAutomation');
    const contentId = config.contentId || context.contentId || context.content?._id?.toString();
    const userId = context.userId || context.user?._id?.toString();

    if (!contentId || !userId) {
      throw new Error('contentId and userId required for skipping segments');
    }

    const criteria = config.audioCriteria || {};

    return await skipSegmentsByAudioCriteria(contentId, userId, criteria);
  } catch (error) {
    logger.error('Automation: Skip segments by audio error', {
      error: error.message,
      config,
      context
    });
    throw error;
  }
}

/**
 * Check audio-aware conditions
 */
async function checkAudioConditions(scenes, conditions) {
  const { filterScenesByAudioCriteria } = require('./audioAwareSceneAutomation');

  for (const condition of conditions) {
    if (condition.audioCriteria) {
      // Filter scenes based on audio criteria
      const filteredScenes = filterScenesByAudioCriteria(scenes, condition.audioCriteria);

      // Check if condition is met
      switch (condition.operator) {
        case 'has_audio_tag':
          const requiredTags = condition.audioCriteria.audioTags || [];
          const hasRequiredTags = filteredScenes.length > 0;
          if (!hasRequiredTags && requiredTags.length > 0) {
            return false;
          }
          break;
        case 'audio_energy_range':
          const minEnergy = condition.value?.min || 0;
          const maxEnergy = condition.value?.max || 1;
          const allInRange = filteredScenes.every(scene => {
            const energy = scene.audioFeatures?.energy || scene.audioFeatures?.averageEnergy || 0;
            return energy >= minEnergy && energy <= maxEnergy;
          });
          if (!allInRange) {
            return false;
          }
          break;
      }
    }
  }

  return true;
}

/**
 * Generate music for scenes
 */
async function generateMusicForScenes(config, context) {
  try {
    const { recommendMusicForScenes } = require('./aiMusicRecommendationService');
    const { generateMusicTrack } = require('./aiMusicGenerationService');
    const { queueGeneration } = require('./aiMusicGenerationQueue');

    const contentId = config.contentId || context.contentId || context.content?._id?.toString();
    const userId = context.userId || context.user?._id?.toString();

    if (!contentId || !userId) {
      throw new Error('contentId and userId required for music generation');
    }

    const Scene = require('../models/Scene');
    const scenes = await Scene.find({
      contentId,
      userId
    }).sort({ sceneIndex: 1 });

    if (scenes.length === 0) {
      logger.warn('No scenes found for music generation', { contentId });
      return { generated: 0, scenes: [] };
    }

    const useRecommendations = config.useRecommendations !== false;
    const provider = config.provider || 'mubert';
    const autoDownload = config.autoDownload || false;

    // Get recommendations if enabled
    const recommendations = useRecommendations
      ? await recommendMusicForScenes(scenes.map(s => s._id), userId)
      : scenes.map(() => ({ recommendations: { mood: 'energetic', genre: 'electronic', duration: 60 } }));

    // Generate music for each scene
    const generations = [];
    for (let i = 0; i < scenes.length; i++) {
      try {
        const scene = scenes[i];
        const rec = recommendations[i] || { recommendations: { mood: 'energetic', genre: 'electronic', duration: scene.duration || 60 } };

        const generation = await generateMusicTrack(
          provider,
          rec.recommendations,
          userId
        );

        // Queue for status checking
        await queueGeneration(generation.generationId, provider, 0);

        generations.push({
          sceneId: scene._id,
          sceneIndex: scene.sceneIndex,
          generationId: generation.generationId,
          status: generation.status
        });
      } catch (error) {
        logger.warn('Failed to generate music for scene', {
          sceneId: scenes[i]._id,
          error: error.message
        });
      }
    }

    logger.info('Music generation started for scenes', {
      contentId,
      totalScenes: scenes.length,
      generationsStarted: generations.length
    });

    return {
      generated: generations.length,
      totalScenes: scenes.length,
      generations
    };
  } catch (error) {
    logger.error('Automation: Generate music for scenes error', {
      error: error.message,
      config,
      context
    });
    throw error;
  }
}

/**
 * Trigger automation by event
 */
async function triggerByEvent(userId, event, context) {
  try {
    const rules = await AutomationRule.find({
      userId,
      enabled: true,
      'trigger.type': 'event',
      'trigger.event': event
    }).lean();

    const results = [];
    for (const rule of rules) {
      try {
        const result = await executeAutomationRule(rule._id, context);
        results.push({ ruleId: rule._id, ruleName: rule.name, ...result });
      } catch (error) {
        logger.error('Error triggering automation', { ruleId: rule._id, error: error.message });
        results.push({ ruleId: rule._id, ruleName: rule.name, executed: false, error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error triggering automation by event', { error: error.message, userId, event });
    return [];
  }
}

module.exports = {
  executeAutomationRule,
  triggerByEvent
};


