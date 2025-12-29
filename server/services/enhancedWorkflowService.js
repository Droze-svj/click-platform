// Enhanced workflow automation service

const User = require('../models/User');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const WorkflowWebhook = require('../models/WorkflowWebhook');
const { triggerWorkflowWebhook } = require('./webhookService');
const logger = require('../utils/logger');

/**
 * Create automated workflow
 */
async function createWorkflow(userId, workflowData) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.workflows) {
      user.workflows = [];
    }

    const workflow = {
      id: require('mongoose').Types.ObjectId(),
      name: workflowData.name,
      description: workflowData.description,
      trigger: workflowData.trigger, // 'manual', 'scheduled', 'event'
      conditions: workflowData.conditions || [],
      actions: workflowData.actions || [],
      enabled: workflowData.enabled !== false,
      schedule: workflowData.schedule || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    user.workflows.push(workflow);
    await user.save();

    logger.info('Workflow created', { userId, workflowId: workflow.id });
    return workflow;
  } catch (error) {
    logger.error('Error creating workflow', { error: error.message, userId });
    throw error;
  }
}

/**
 * Execute workflow
 */
async function executeWorkflow(userId, workflowId, context = {}, options = {}) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.workflows) {
      throw new Error('User or workflows not found');
    }

    const workflow = user.workflows.find(w => w.id.toString() === workflowId.toString());
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (!workflow.enabled) {
      logger.info('Workflow disabled', { userId, workflowId });
      return { executed: false, reason: 'Workflow is disabled' };
    }

    // Check conditions
    const conditionsMet = await checkConditions(workflow.conditions, userId, context);
    if (!conditionsMet) {
      logger.info('Workflow conditions not met', { userId, workflowId });
      return { executed: false, reason: 'Conditions not met' };
    }

    // Execute actions
    const results = [];
    for (const action of workflow.actions) {
      try {
        const result = await executeAction(action, userId, context);
        results.push({ action: action.type, success: true, result });
      } catch (error) {
        logger.error('Error executing workflow action', { error: error.message, action: action.type });
        results.push({ action: action.type, success: false, error: error.message });
      }
    }

    // Trigger webhooks if configured
    try {
      const webhooks = await WorkflowWebhook.find({
        workflowId,
        userId,
        isActive: true,
        events: { $in: ['workflow.completed', 'workflow.started'] },
      });

      for (const webhook of webhooks) {
        try {
          await triggerWorkflowWebhook(webhook, 'workflow.completed', {
            workflowId: workflowId.toString(),
            userId: userId.toString(),
            results,
            executed: true,
          });
          webhook.successCount++;
          webhook.lastTriggered = new Date();
          await webhook.save();
        } catch (webhookError) {
          webhook.failureCount++;
          webhook.lastTriggered = new Date();
          await webhook.save();
          logger.error('Webhook trigger error', { error: webhookError.message, webhookId: webhook._id });
        }
      }
    } catch (webhookError) {
      logger.warn('Webhook processing error', { error: webhookError.message });
      // Don't fail workflow if webhook fails
    }

    logger.info('Workflow executed', { userId, workflowId, resultsCount: results.length });
    return { executed: true, results };
  } catch (error) {
    logger.error('Error executing workflow', { error: error.message, userId, workflowId });
    throw error;
  }
}

/**
 * Check workflow conditions
 */
async function checkConditions(conditions, userId, context) {
  try {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions = always true
    }

    for (const condition of conditions) {
      const met = await checkCondition(condition, userId, context);
      if (!met) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Error checking conditions', { error: error.message });
    return false;
  }
}

/**
 * Check single condition
 */
async function checkCondition(condition, userId, context) {
  try {
    switch (condition.type) {
      case 'content_count':
        const count = await Content.countDocuments({ userId });
        return compareValues(count, condition.operator || '>=', condition.value || 0);

      case 'post_count':
        const postCount = await ScheduledPost.countDocuments({ userId });
        return compareValues(postCount, condition.operator || '>=', condition.value || 0);

      case 'date':
        const now = new Date();
        const targetDate = new Date(condition.value);
        return compareDates(now, condition.operator || '>=', targetDate);

      case 'custom':
        // Custom condition evaluation
        return evaluateCustomCondition(condition, context);

      default:
        return true;
    }
  } catch (error) {
    logger.error('Error checking condition', { error: error.message, condition });
    return false;
  }
}

/**
 * Execute workflow action
 */
async function executeAction(action, userId, context) {
  try {
    switch (action.type) {
      case 'create_content':
        return await createContentFromAction(action, userId, context);

      case 'schedule_post':
        return await schedulePostFromAction(action, userId, context);

      case 'send_notification':
        return await sendNotificationFromAction(action, userId, context);

      case 'update_content':
        return await updateContentFromAction(action, userId, context);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  } catch (error) {
    logger.error('Error executing action', { error: error.message, action });
    throw error;
  }
}

/**
 * Create content from workflow action
 */
async function createContentFromAction(action, userId, context) {
  try {
    const content = new Content({
      userId,
      type: action.contentType || 'article',
      title: action.title || 'Auto-generated Content',
      description: action.description || '',
      status: 'draft',
      ...action.metadata
    });

    await content.save();
    return { contentId: content._id, success: true };
  } catch (error) {
    logger.error('Error creating content from workflow', { error: error.message });
    throw error;
  }
}

/**
 * Schedule post from workflow action
 */
async function schedulePostFromAction(action, userId, context) {
  try {
    const scheduledTime = action.scheduledTime || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: tomorrow

    const post = new ScheduledPost({
      userId,
      platform: action.platform || 'twitter',
      content: {
        text: action.text || '',
        hashtags: action.hashtags || []
      },
      scheduledTime: new Date(scheduledTime),
      status: 'scheduled'
    });

    await post.save();
    return { postId: post._id, success: true };
  } catch (error) {
    logger.error('Error scheduling post from workflow', { error: error.message });
    throw error;
  }
}

/**
 * Send notification from workflow action
 */
async function sendNotificationFromAction(action, userId, context) {
  try {
    const notificationService = require('./notificationService');
    await notificationService.createNotification(
      userId,
      action.title || 'Workflow Notification',
      action.message || '',
      action.level || 'info',
      action.link || '/dashboard'
    );
    return { success: true };
  } catch (error) {
    logger.error('Error sending notification from workflow', { error: error.message });
    throw error;
  }
}

/**
 * Update content from workflow action
 */
async function updateContentFromAction(action, userId, context) {
  try {
    const contentId = action.contentId || context.contentId;
    if (!contentId) {
      throw new Error('Content ID required');
    }

    const content = await Content.findOne({ _id: contentId, userId });
    if (!content) {
      throw new Error('Content not found');
    }

    if (action.updates) {
      Object.assign(content, action.updates);
      await content.save();
    }

    return { contentId, success: true };
  } catch (error) {
    logger.error('Error updating content from workflow', { error: error.message });
    throw error;
  }
}

/**
 * Helper functions
 */
function compareValues(value, operator, target) {
  switch (operator) {
    case '>': return value > target;
    case '>=': return value >= target;
    case '<': return value < target;
    case '<=': return value <= target;
    case '==': return value === target;
    case '!=': return value !== target;
    default: return value >= target;
  }
}

function compareDates(date1, operator, date2) {
  const time1 = date1.getTime();
  const time2 = date2.getTime();
  return compareValues(time1, operator, time2);
}

function evaluateCustomCondition(condition, context) {
  // Simple custom condition evaluation
  // In production, this could use a more sophisticated expression evaluator
  try {
    const value = context[condition.field];
    return compareValues(value, condition.operator, condition.value);
  } catch (error) {
    return false;
  }
}

/**
 * Get workflow suggestions based on user patterns
 */
async function getWorkflowSuggestions(userId) {
  try {
    const patterns = await analyzeUserPatterns(userId);
    const suggestions = [];

    // Suggest content creation workflow if user creates content regularly
    if (patterns.contentCreationFrequency > 3) {
      suggestions.push({
        type: 'content_creation',
        name: 'Auto-create Weekly Content',
        description: 'Automatically create content every week',
        trigger: 'scheduled',
        schedule: { frequency: 'weekly', day: 1, time: '09:00' },
        actions: [
          {
            type: 'create_content',
            contentType: patterns.mostUsedContentType || 'article',
            title: 'Weekly Content - {{date}}'
          }
        ]
      });
    }

    // Suggest posting workflow if user schedules posts regularly
    if (patterns.postingFrequency > 5) {
      suggestions.push({
        type: 'auto_posting',
        name: 'Auto-schedule Posts',
        description: 'Automatically schedule posts from generated content',
        trigger: 'event',
        conditions: [
          { type: 'content_count', operator: '>', value: 0 }
        ],
        actions: [
          {
            type: 'schedule_post',
            platform: patterns.mostUsedPlatform || 'twitter',
            scheduledTime: '{{now + 1 day}}'
          }
        ]
      });
    }

    return suggestions;
  } catch (error) {
    logger.error('Error getting workflow suggestions', { error: error.message, userId });
    return [];
  }
}

/**
 * Analyze user patterns for workflow suggestions
 */
async function analyzeUserPatterns(userId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [content, posts] = await Promise.all([
      Content.find({ userId, createdAt: { $gte: startDate } }),
      ScheduledPost.find({ userId, createdAt: { $gte: startDate } })
    ]);

    // Calculate frequencies
    const contentCreationFrequency = content.length / days;
    const postingFrequency = posts.length / days;

    // Find most used types/platforms
    const contentTypes = {};
    content.forEach(c => {
      contentTypes[c.type] = (contentTypes[c.type] || 0) + 1;
    });

    const platforms = {};
    posts.forEach(p => {
      platforms[p.platform] = (platforms[p.platform] || 0) + 1;
    });

    const mostUsedContentType = Object.entries(contentTypes)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const mostUsedPlatform = Object.entries(platforms)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      contentCreationFrequency,
      postingFrequency,
      mostUsedContentType,
      mostUsedPlatform,
      totalContent: content.length,
      totalPosts: posts.length
    };
  } catch (error) {
    logger.error('Error analyzing user patterns', { error: error.message, userId });
    return {
      contentCreationFrequency: 0,
      postingFrequency: 0,
      mostUsedContentType: null,
      mostUsedPlatform: null,
      totalContent: 0,
      totalPosts: 0
    };
  }
}

module.exports = {
  createWorkflow,
  executeWorkflow,
  getWorkflowSuggestions,
  analyzeUserPatterns
};


