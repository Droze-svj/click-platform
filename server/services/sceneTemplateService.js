// Scene Template Service
// Pre-defined scene patterns and templates for workflows

const logger = require('../utils/logger');

/**
 * Scene template definitions
 */
const SCENE_TEMPLATES = {
  talkingHead: {
    name: 'Talking Head Scene',
    description: 'Scenes with faces and speech, suitable for clips',
    conditions: {
      'metadata.hasFaces': true,
      'metadata.hasSpeech': true
    },
    actions: ['create_clips_from_scenes'],
    config: {
      maxDuration: 60,
      minDuration: 5,
      platforms: ['tiktok', 'instagram', 'youtube-shorts']
    }
  },
  screenShare: {
    name: 'Screen Share Scene',
    description: 'Screen recording scenes, good for tutorials',
    conditions: {
      'metadata.label': 'screen share'
    },
    actions: ['generate_captions_for_scenes'],
    config: {
      includeCaptions: true
    }
  },
  bRoll: {
    name: 'B-Roll Scene',
    description: 'High motion scenes for visual content',
    conditions: {
      'metadata.label': 'B-roll',
      'metadata.motionLevel': { $gte: 0.5 }
    },
    actions: ['tag_key_moments'],
    config: {
      motionThreshold: 0.5
    }
  },
  keyMoments: {
    name: 'Key Moments',
    description: 'Important scenes with high motion or slide changes',
    conditions: {
      $or: [
        { 'metadata.motionLevel': { $gte: 0.7 } },
        { 'metadata.tags': 'screen-share' }
      ]
    },
    actions: ['tag_key_moments', 'create_clips_from_scenes'],
    config: {
      motionThreshold: 0.7,
      detectSlideChanges: true,
      maxDuration: 30
    }
  },
  shortClips: {
    name: 'Short Form Clips',
    description: 'Automatically create clips from scenes under 60s',
    conditions: {
      duration: { $lte: 60, $gte: 5 }
    },
    actions: ['create_clips_from_scenes'],
    config: {
      maxDuration: 60,
      minDuration: 5,
      generateCaptions: true,
      platforms: ['tiktok', 'instagram']
    }
  },
  carousel: {
    name: 'Carousel Content',
    description: 'Create carousel from top scenes',
    conditions: {
      $or: [
        { isHighlight: true },
        { isPromoted: true },
        { priority: { $gte: 5 } }
      ]
    },
    actions: ['create_carousel_from_scenes'],
    config: {
      format: 'carousel',
      maxScenes: 10,
      includeCaptions: true
    }
  }
};

/**
 * Apply template to scenes
 */
async function applyTemplate(templateName, contentId, userId) {
  try {
    const template = SCENE_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const Scene = require('../models/Scene');
    const { getScenesForAsset } = require('./sceneDetectionService');
    const { executeSceneWorkflowActions } = require('./sceneWorkflowService');
    const Content = require('../models/Content');

    // Get content
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Get scenes matching template conditions
    const scenesResult = await getScenesForAsset(contentId);
    const allScenes = await Scene.find({ contentId, userId }).lean();
    
    // Filter scenes by template conditions
    const matchingScenes = filterScenesByConditions(allScenes, template.conditions);

    if (matchingScenes.length === 0) {
      return { 
        success: true, 
        message: `No scenes match template conditions`,
        matchedScenes: 0
      };
    }

    // Build actions from template
    const actions = template.actions.map(actionType => ({
      type: actionType,
      config: template.config || {}
    }));

    // Execute actions
    const context = {
      contentId,
      userId: userId.toString(),
      scenes: matchingScenes,
      content
    };

    const results = await executeSceneWorkflowActions(actions, context);

    logger.info('Template applied', { templateName, contentId, matchedScenes: matchingScenes.length });

    return {
      success: true,
      template: templateName,
      matchedScenes: matchingScenes.length,
      results
    };
  } catch (error) {
    logger.error('Error applying template', { error: error.message, templateName, contentId });
    throw error;
  }
}

/**
 * Filter scenes by conditions
 */
function filterScenesByConditions(scenes, conditions) {
  return scenes.filter(scene => {
    for (const [key, value] of Object.entries(conditions)) {
      if (key === '$or') {
        // Handle $or conditions
        const orConditions = value;
        const matches = orConditions.some(condition => 
          checkSceneCondition(scene, condition)
        );
        if (!matches) return false;
      } else {
        if (!checkSceneCondition(scene, { [key]: value })) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Check if scene matches a condition
 */
function checkSceneCondition(scene, condition) {
  for (const [path, expectedValue] of Object.entries(condition)) {
    const actualValue = getNestedValue(scene, path);
    
    if (typeof expectedValue === 'object' && expectedValue.$gte !== undefined) {
      if (actualValue < expectedValue.$gte) return false;
    } else if (typeof expectedValue === 'object' && expectedValue.$lte !== undefined) {
      if (actualValue > expectedValue.$lte) return false;
    } else if (Array.isArray(expectedValue)) {
      if (!expectedValue.includes(actualValue)) return false;
    } else {
      if (actualValue !== expectedValue) return false;
    }
  }
  return true;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return undefined;
  }
  return value;
}

/**
 * Get available templates
 */
function getAvailableTemplates() {
  return Object.entries(SCENE_TEMPLATES).map(([key, template]) => ({
    id: key,
    name: template.name,
    description: template.description,
    actions: template.actions
  }));
}

module.exports = {
  applyTemplate,
  getAvailableTemplates,
  SCENE_TEMPLATES
};







