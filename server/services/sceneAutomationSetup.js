// Scene Automation Setup Service
// Creates default automation rules for scene detection

const AutomationRule = require('../models/AutomationRule');
const logger = require('../utils/logger');

/**
 * Setup default scene detection automation after video upload
 */
async function setupDefaultSceneDetectionAutomation(userId) {
  try {
    // Check if rule already exists
    const existingRule = await AutomationRule.findOne({
      userId,
      'trigger.type': 'event',
      'trigger.event': 'video_uploaded',
      'actions.type': 'detect_scenes'
    });

    if (existingRule) {
      logger.info('Default scene detection automation already exists', { userId });
      return existingRule;
    }

    // Create default rule
    const rule = new AutomationRule({
      userId,
      name: 'Auto-detect scenes after upload',
      description: 'Automatically detects scenes with audio-visual fusion when a video is uploaded',
      trigger: {
        type: 'event',
        event: 'video_uploaded'
      },
      actions: [
        {
          type: 'detect_scenes',
          config: {
            useMultiModal: true,
            workflowType: 'general',
            extractMetadata: true,
            fps: 3,
            sensitivity: 0.3,
            minSceneLength: 1.0
          }
        }
      ],
      enabled: true
    });

    await rule.save();
    logger.info('Default scene detection automation created', { userId, ruleId: rule._id });

    return rule;
  } catch (error) {
    logger.error('Error setting up default scene detection automation', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Setup example automation: Create clips with speech and high energy
 */
async function setupSpeechHighEnergyClipAutomation(userId) {
  try {
    const existingRule = await AutomationRule.findOne({
      userId,
      name: 'Create clips with speech and high energy'
    });

    if (existingRule) {
      return existingRule;
    }

    const rule = new AutomationRule({
      userId,
      name: 'Create clips with speech and high energy',
      description: 'Creates clips only from scenes with speech and high energy',
      trigger: {
        type: 'event',
        event: 'scenes_processed'
      },
      conditions: [],
      actions: [
        {
          type: 'create_clips_with_audio_criteria',
          config: {
            audioCriteria: {
              requireSpeech: true,
              minSpeechConfidence: 0.6,
              requireHighEnergy: true,
              minEnergy: 0.7,
              skipSilence: true,
              maxSilenceRatio: 0.2,
              skipNoise: true,
              requireTopicChange: false,
              audioTags: ['speech', 'high_energy'],
              excludeTags: ['silence', 'noise']
            },
            clipConfig: {
              platform: 'tiktok',
              maxDuration: 60
            }
          }
        }
      ],
      enabled: false // Disabled by default, user can enable
    });

    await rule.save();
    logger.info('Speech high energy clip automation created', { userId, ruleId: rule._id });

    return rule;
  } catch (error) {
    logger.error('Error setting up speech high energy clip automation', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Setup example automation: Skip silent segments
 */
async function setupSkipSilentSegmentsAutomation(userId) {
  try {
    const existingRule = await AutomationRule.findOne({
      userId,
      name: 'Skip silent segments'
    });

    if (existingRule) {
      return existingRule;
    }

    const rule = new AutomationRule({
      userId,
      name: 'Skip silent segments',
      description: 'Marks scenes with long silence or background noise as skipped',
      trigger: {
        type: 'event',
        event: 'scenes_processed'
      },
      actions: [
        {
          type: 'skip_segments_by_audio',
          config: {
            audioCriteria: {
              skipSilence: true,
              maxSilenceRatio: 0.5,
              skipNoise: true,
              excludeTags: ['noise'],
              action: 'mark_skipped'
            }
          }
        }
      ],
      enabled: false // Disabled by default
    });

    await rule.save();
    logger.info('Skip silent segments automation created', { userId, ruleId: rule._id });

    return rule;
  } catch (error) {
    logger.error('Error setting up skip silent segments automation', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Setup all default scene automations
 */
async function setupAllDefaultSceneAutomations(userId) {
  try {
    const results = {
      sceneDetection: await setupDefaultSceneDetectionAutomation(userId),
      speechHighEnergy: await setupSpeechHighEnergyClipAutomation(userId),
      skipSilent: await setupSkipSilentSegmentsAutomation(userId)
    };

    logger.info('All default scene automations setup', { userId, results });
    return results;
  } catch (error) {
    logger.error('Error setting up default scene automations', {
      error: error.message,
      userId
    });
    throw error;
  }
}

module.exports = {
  setupDefaultSceneDetectionAutomation,
  setupSpeechHighEnergyClipAutomation,
  setupSkipSilentSegmentsAutomation,
  setupAllDefaultSceneAutomations
};







