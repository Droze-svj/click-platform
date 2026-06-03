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
 * Resolve the acting user id from action config or execution context.
 */
function resolveUserId(config, context) {
  return (
    config.userId ||
    context.userId ||
    context.user?._id?.toString() ||
    context.user?.id ||
    null
  );
}

/**
 * Resolve a content id from action config or execution context.
 */
function resolveContentId(config, context) {
  return (
    config.contentId ||
    context.contentId ||
    context.content?._id?.toString() ||
    context.content?.id ||
    null
  );
}

/**
 * Create content — inserts a real Content document.
 */
async function createContent(config, context) {
  const Content = require('../models/Content');
  const userId = resolveUserId(config, context);
  if (!userId) throw new Error('userId required to create content');

  const doc = await Content.create({
    userId: String(userId),
    type: config.type || 'video',
    title: config.title || 'Automated content',
    description: config.description || '',
    status: config.status || 'processing',
    workspaceId: context.workspaceId || config.workspaceId,
    tags: Array.isArray(config.tags) ? config.tags : [],
  });

  logger.info('Automation: content created', { contentId: doc._id.toString(), userId });
  return { success: true, contentId: doc._id.toString() };
}

/**
 * Update content — applies a whitelisted set of field updates to a Content doc.
 */
async function updateContent(config, context) {
  const Content = require('../models/Content');
  const contentId = resolveContentId(config, context);
  if (!contentId) throw new Error('contentId required to update content');

  const updates = config.updates || config.fields || {};
  const allowed = ['title', 'description', 'status', 'tags', 'category', 'isFavorite', 'isArchived'];
  const $set = { updatedAt: new Date() };
  for (const key of allowed) {
    if (updates[key] !== undefined) $set[key] = updates[key];
  }

  const doc = await Content.findByIdAndUpdate(contentId, { $set }, { new: true });
  if (!doc) throw new Error('Content not found');
  return { success: true, contentId, updated: Object.keys($set).filter((k) => k !== 'updatedAt') };
}

/**
 * Publish content — schedules the post for immediate publishing so the
 * existing publishing worker picks it up on its next pass.
 */
async function publishContent(config, context) {
  const { scheduleWithOptimalTiming } = require('./contentSchedulingService');
  const userId = resolveUserId(config, context);
  const contentId = resolveContentId(config, context);
  const platform = config.platform || context.platform;
  if (!userId || !contentId || !platform) {
    throw new Error('userId, contentId and platform required to publish content');
  }

  const post = await scheduleWithOptimalTiming(userId, contentId, platform, {
    scheduledTime: new Date(), // publish now
  });
  return { success: true, scheduledPostId: post._id.toString(), platform, publishAt: post.scheduledTime };
}

/**
 * Schedule content — creates a ScheduledPost at the requested (or optimal) time.
 */
async function scheduleContent(config, context) {
  const { scheduleWithOptimalTiming } = require('./contentSchedulingService');
  const userId = resolveUserId(config, context);
  const contentId = resolveContentId(config, context);
  const platform = config.platform || context.platform;
  if (!userId || !contentId || !platform) {
    throw new Error('userId, contentId and platform required to schedule content');
  }

  const options = {};
  if (config.scheduledTime) options.scheduledTime = config.scheduledTime;
  const post = await scheduleWithOptimalTiming(userId, contentId, platform, options);
  return { success: true, scheduledPostId: post._id.toString(), platform, scheduledTime: post.scheduledTime };
}

/**
 * Send notification — persists an in-app notification for the user.
 */
async function sendNotification(config, context) {
  const notificationService = require('./notificationService');
  const userId = resolveUserId(config, context);
  if (!userId) throw new Error('userId required to send notification');

  const notification = await notificationService.createNotification(
    userId,
    config.title || 'Automation',
    config.message || config.body || 'An automation rule ran.',
    config.notificationType || config.type || 'automation',
    config.link || null,
    config.options || {}
  );
  return { success: true, notificationId: notification?._id?.toString?.() || notification?.id || null };
}

/**
 * Assign task — creates a Task assigned to the target user.
 */
async function assignTask(config, context) {
  const Task = require('../models/Task');
  const assigneeId = config.assigneeId || config.assignTo || resolveUserId(config, context);
  if (!assigneeId) throw new Error('assigneeId required to assign task');
  if (!config.title) throw new Error('title required to assign task');

  const task = await Task.create({
    userId: assigneeId,
    title: config.title,
    description: config.description || '',
    priority: config.priority || 'medium',
    dueDate: config.dueDate ? new Date(config.dueDate) : undefined,
    workspaceId: context.workspaceId || config.workspaceId,
    tags: Array.isArray(config.tags) ? config.tags : [],
  });
  return { success: true, taskId: task._id.toString() };
}

/**
 * Update status — updates the status field on a Content document.
 */
async function updateStatus(config, context) {
  const Content = require('../models/Content');
  const contentId = resolveContentId(config, context);
  const status = config.status;
  if (!contentId) throw new Error('contentId required to update status');
  if (!status) throw new Error('status required to update status');

  const doc = await Content.findByIdAndUpdate(
    contentId,
    { $set: { status, updatedAt: new Date() } },
    { new: true }
  );
  if (!doc) throw new Error('Content not found');
  return { success: true, contentId, status };
}

/**
 * Call webhook — POSTs the configured payload to an external URL.
 */
async function callWebhook(config, context) {
  const url = config.url || config.webhookUrl;
  if (!url) throw new Error('url required to call webhook');

  const payload = config.payload || {
    event: 'automation.action',
    ruleId: context.ruleId || null,
    contentId: resolveContentId(config, context),
    timestamp: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 10000);
  try {
    const response = await fetch(url, {
      method: config.method || 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { success: response.ok, status: response.status, url };
  } catch (error) {
    throw new Error(`Webhook call failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Send email — delivers a real email via the configured transport.
 */
async function sendEmail(config, context) {
  const emailService = require('./emailService');
  const to = config.to || context.user?.email || config.email;
  if (!to) throw new Error('recipient (to) required to send email');
  if (!config.subject) throw new Error('subject required to send email');

  const result = await emailService.sendEmail({
    to,
    subject: config.subject,
    html: config.html || config.body || config.text,
    text: config.text,
    cc: config.cc,
    bcc: config.bcc,
  });
  if (!result.success) {
    throw new Error(result.error || 'Email send failed');
  }
  return { success: true, messageId: result.messageId, to };
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
      case 'has_audio_tag': {
        const requiredTags = condition.audioCriteria.audioTags || [];
        const hasRequiredTags = filteredScenes.length > 0;
        if (!hasRequiredTags && requiredTags.length > 0) {
          return false;
        }
        break;
      }
      case 'audio_energy_range': {
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


