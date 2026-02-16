// Workflow automation service

const Workflow = require('../models/Workflow');
const UserAction = require('../models/UserAction');
const logger = require('../utils/logger');
const { isDevUser } = require('../utils/devUser');

/**
 * Track user action
 */
async function trackAction(userId, action, metadata = {}) {
  try {
    if (isDevUser(userId)) return null;

    // Wrap in try-catch to handle CastErrors gracefully
    try {
      const userAction = new UserAction({
        userId,
        action,
        entityType: metadata.entityType,
        entityId: metadata.entityId,
        metadata: {
          ...metadata,
          entityType: undefined,
          entityId: undefined
        },
        context: {
          previousAction: metadata.previousAction,
          sessionId: metadata.sessionId,
          page: metadata.page
        }
      });

      await userAction.save();
    } catch (dbError) {
      // If it's a CastError for dev users, just skip tracking
      if (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId')) {
        logger.warn('CastError in trackAction, skipping for dev user', { error: dbError.message, userId, action });
        return null;
      }
      throw dbError;
    }

    // Analyze patterns and suggest workflows
    await analyzePatterns(userId);

    return userAction;
  } catch (error) {
    logger.error('Error tracking action', { error: error.message, userId, action });
  }
}

/**
 * Analyze user patterns and suggest workflows
 */
async function analyzePatterns(userId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent actions
    const actions = await UserAction.find({
      userId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    if (actions.length < 3) {
      return; // Not enough data
    }

    // Find common action sequences
    const sequences = [];
    for (let i = 0; i < actions.length - 1; i++) {
      const sequence = [actions[i].action, actions[i + 1].action];
      sequences.push(sequence.join(' -> '));
    }

    // Count sequence frequency
    const sequenceCounts = {};
    sequences.forEach(seq => {
      sequenceCounts[seq] = (sequenceCounts[seq] || 0) + 1;
    });

    // Find frequent sequences (appears 3+ times)
    const frequentSequences = Object.entries(sequenceCounts)
      .filter(([_, count]) => count >= 3)
      .sort(([_, a], [__, b]) => b - a);

    // Create workflow suggestions from frequent sequences
    for (const [sequence, count] of frequentSequences) {
      const [action1, action2] = sequence.split(' -> ');

      // Check if workflow already exists
      const existing = await Workflow.findOne({
        userId,
        'steps.0.action': action1,
        'steps.1.action': action2,
        isActive: true
      });

      if (!existing) {
        // Create suggested workflow
        const workflow = new Workflow({
          userId,
          name: `Auto: ${action1} → ${action2}`,
          description: `Automated workflow based on your usage patterns`,
          steps: [
            { order: 1, action: action1, config: {} },
            { order: 2, action: action2, config: {} }
          ],
          frequency: count,
          lastUsed: new Date(),
          isTemplate: false,
          tags: ['auto-generated', 'suggested']
        });

        await workflow.save();
        logger.info('Workflow suggestion created', { userId, workflowId: workflow._id });
      }
    }
  } catch (error) {
    logger.error('Error analyzing patterns', { error: error.message, userId });
  }
}

/**
 * Get suggested next steps
 */
async function getSuggestedNextSteps(userId, currentAction = null) {
  try {
    if (isDevUser(userId)) return [];

    // Get recent actions - wrap in try-catch to handle CastErrors
    let recentActions = [];
    try {
      recentActions = await UserAction.find({
        userId
      })
        .sort({ timestamp: -1 })
        .limit(5);
    } catch (dbError) {
      // If it's a CastError, return empty array
      if (dbError.name === 'CastError' || dbError.message?.includes('Cast to ObjectId')) {
        logger.warn('CastError in getSuggestedNextSteps, returning empty array', { error: dbError.message, userId });
        return [];
      }
      throw dbError;
    }

    if (recentActions.length === 0) {
      return getDefaultSuggestions();
    }

    const lastAction = recentActions[0];

    // Find workflows that start with the last action
    const workflows = await Workflow.find({
      userId,
      'steps.0.action': lastAction.action,
      isActive: true
    })
      .sort({ frequency: -1, lastUsed: -1 })
      .limit(3);

    const suggestions = workflows.map(workflow => ({
      type: 'workflow',
      title: workflow.name,
      description: `Continue with: ${workflow.steps[1]?.action || 'next step'}`,
      workflowId: workflow._id,
      steps: workflow.steps
    }));

    // If no workflows, suggest common next steps
    if (suggestions.length === 0) {
      return getCommonNextSteps(lastAction.action);
    }

    return suggestions;
  } catch (error) {
    logger.error('Error getting suggested next steps', { error: error.message, userId });
    return getDefaultSuggestions();
  }
}

/**
 * Get common next steps based on action
 */
function getCommonNextSteps(action) {
  const commonFlows = {
    'upload_video': [
      { type: 'action', title: 'Apply Effects', action: 'apply_effects', description: 'Enhance your video with effects' },
      { type: 'action', title: 'Add Music', action: 'add_music', description: 'Add background music to your video' },
      { type: 'action', title: 'Generate Clips', action: 'generate_content', description: 'Create short-form clips' }
    ],
    'generate_content': [
      { type: 'action', title: 'Schedule Posts', action: 'schedule_post', description: 'Schedule your content' },
      { type: 'action', title: 'Create Quote Cards', action: 'create_quote', description: 'Turn quotes into graphics' }
    ],
    'generate_script': [
      { type: 'action', title: 'Create Video', action: 'upload_video', description: 'Record your script' },
      { type: 'action', title: 'Schedule Post', action: 'schedule_post', description: 'Schedule your script content' }
    ]
  };

  return commonFlows[action] || getDefaultSuggestions();
}

/**
 * Get default suggestions
 */
function getDefaultSuggestions() {
  return [
    { type: 'action', title: 'Upload Video', action: 'upload_video', description: 'Start by uploading a video' },
    { type: 'action', title: 'Generate Content', action: 'generate_content', description: 'Create social media content' },
    { type: 'action', title: 'Create Script', action: 'generate_script', description: 'Generate a script' }
  ];
}

/**
 * Get user preferences from history
 */
async function getUserPreferences(userId) {
  try {
    if (isDevUser(userId)) {
      return {
        commonActions: {},
        commonConfigs: {},
        preferredPlatforms: [],
        preferredEffects: [],
        preferredMusicGenres: []
      };
    }

    const actions = await UserAction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);

    const preferences = {
      commonActions: {},
      commonConfigs: {},
      preferredPlatforms: [],
      preferredEffects: [],
      preferredMusicGenres: []
    };

    actions.forEach(action => {
      // Count action frequency
      preferences.commonActions[action.action] =
        (preferences.commonActions[action.action] || 0) + 1;

      // Extract preferences from metadata
      if (action.metadata) {
        if (action.metadata.platform) {
          if (!preferences.preferredPlatforms.includes(action.metadata.platform)) {
            preferences.preferredPlatforms.push(action.metadata.platform);
          }
        }
        if (action.metadata.effects) {
          action.metadata.effects.forEach(effect => {
            if (!preferences.preferredEffects.includes(effect)) {
              preferences.preferredEffects.push(effect);
            }
          });
        }
        if (action.metadata.genre) {
          if (!preferences.preferredMusicGenres.includes(action.metadata.genre)) {
            preferences.preferredMusicGenres.push(action.metadata.genre);
          }
        }
      }
    });

    return preferences;
  } catch (error) {
    logger.error('Error getting user preferences', { error: error.message, userId });
    return {};
  }
}

/**
 * Execute workflow
 */
async function executeWorkflow(workflowId, userId, inputData = {}) {
  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      userId,
      isActive: true
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Update workflow usage
    workflow.frequency += 1;
    workflow.lastUsed = new Date();
    await workflow.save();

    // Track workflow execution
    await trackAction(userId, 'execute_workflow', {
      workflowId: workflow._id,
      workflowName: workflow.name
    });

    // Return workflow steps for execution
    return {
      workflow,
      steps: workflow.steps.map(step => ({
        ...step.toObject(),
        config: { ...step.config, ...inputData }
      }))
    };
  } catch (error) {
    logger.error('Error executing workflow', { error: error.message, workflowId, userId });
    throw error;
  }
}

/**
 * Save workflow from user actions
 */
async function saveWorkflowFromActions(userId, name, actionIds) {
  try {
    const actions = await UserAction.find({
      _id: { $in: actionIds },
      userId
    }).sort({ timestamp: 1 });

    if (actions.length === 0) {
      throw new Error('No actions found');
    }

    const steps = actions.map((action, index) => ({
      order: index + 1,
      action: action.action,
      config: action.metadata || {}
    }));

    const workflow = new Workflow({
      userId,
      name,
      description: `Workflow created from ${actions.length} actions`,
      steps,
      isTemplate: false
    });

    await workflow.save();
    return workflow;
  } catch (error) {
    logger.error('Error saving workflow from actions', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  trackAction,
  analyzePatterns,
  getSuggestedNextSteps,
  getUserPreferences,
  executeWorkflow,
  saveWorkflowFromActions
};







