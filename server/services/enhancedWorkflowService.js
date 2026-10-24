// Enhanced workflow automation service

const mongoose = require('mongoose');
const Workflow = require('../models/Workflow');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const WorkflowWebhook = require('../models/WorkflowWebhook');
const { triggerWorkflowWebhook } = require('./webhookService');
const logger = require('../utils/logger');

/**
 * Workflows live in the Workflow collection. They used to be pushed onto
 * `user.workflows`, a path the User schema does not declare — strict mode
 * dropped it on save, so no enhanced workflow was ever stored and every
 * execute answered "User or workflows not found".
 *
 * The enhanced spec (trigger / conditions / actions / schedule, in this
 * service's own vocabulary) is kept whole in `definition`; `triggers`,
 * `actions` and `status` are filled too so the list endpoints and the
 * builder can show it.
 */
const TRIGGER_TO_MODEL = { scheduled: 'schedule', event: 'event', conditional: 'conditional' };

function toEnhancedSpec(workflowData = {}) {
  const trigger = ['manual', 'scheduled', 'event'].includes(workflowData.trigger) ? workflowData.trigger : 'manual';
  return {
    kind: 'enhanced',
    trigger,
    conditions: Array.isArray(workflowData.conditions) ? workflowData.conditions : [],
    actions: Array.isArray(workflowData.actions) ? workflowData.actions.filter((a) => a && typeof a.type === 'string') : [],
    schedule: workflowData.schedule || null,
  };
}

async function createWorkflow(userId, workflowData = {}) {
  try {
    const name = typeof workflowData.name === 'string' ? workflowData.name.trim() : '';
    if (!name) {
      const e = new Error('Workflow name is required'); e.statusCode = 400; throw e;
    }
    const spec = toEnhancedSpec(workflowData);
    const workflow = await Workflow.create({
      userId: String(userId),
      name,
      description: workflowData.description || '',
      definition: spec,
      triggers: TRIGGER_TO_MODEL[spec.trigger]
        ? [{ type: TRIGGER_TO_MODEL[spec.trigger], config: spec.schedule ? { schedule: spec.schedule } : {} }]
        : [],
      actions: spec.actions.map((a) => ({ type: a.type, config: a })),
      status: workflowData.enabled === false ? 'paused' : 'active',
      advanced: true,
    });

    logger.info('Workflow created', { userId: String(userId), workflowId: String(workflow._id) });
    return workflow.toObject();
  } catch (error) {
    logger.error('Error creating workflow', { error: error.message, userId });
    throw error;
  }
}

/**
 * Execute workflow (owner-scoped).
 */
async function executeWorkflow(userId, workflowId, context = {}, options = {}) {
  try {
    const notFound = () => { const e = new Error('Workflow not found'); e.statusCode = 404; return e; };
    if (!mongoose.Types.ObjectId.isValid(String(workflowId))) throw notFound();
    const workflow = await Workflow.findOne({ _id: workflowId, userId: String(userId), isActive: { $ne: false } });
    if (!workflow) throw notFound();

    if (workflow.status !== 'active') {
      logger.info('Workflow disabled', { userId, workflowId });
      return { executed: false, reason: 'Workflow is paused' };
    }

    const spec = workflow.definition && workflow.definition.kind === 'enhanced'
      ? workflow.definition
      : {
        conditions: [],
        actions: (workflow.actions || []).map((a) => ({ ...(a.config || {}), type: a.type })).filter((a) => a.type),
      };

    // Check conditions
    const conditionsMet = await checkConditions(spec.conditions, userId, context || {});
    if (!conditionsMet) {
      logger.info('Workflow conditions not met', { userId, workflowId });
      return { executed: false, reason: 'Conditions not met' };
    }

    const startedAt = Date.now();
    // Execute actions
    const results = [];
    for (const action of spec.actions || []) {
      try {
        const result = await executeAction(action, userId, context || {});
        results.push({ action: action.type, success: true, result });
      } catch (error) {
        logger.error('Error executing workflow action', { error: error.message, action: action.type });
        results.push({ action: action.type, success: false, error: error.message });
      }
    }

    const allOk = results.every((r) => r.success);
    try {
      await Workflow.updateOne({ _id: workflow._id }, {
        $inc: { executionCount: 1, frequency: 1, [allOk ? 'successCount' : 'failureCount']: 1 },
        $set: { lastExecuted: new Date(), lastUsed: new Date(), avgExecutionTime: Date.now() - startedAt },
      });
    } catch (statErr) {
      logger.warn('Workflow stats update failed', { error: statErr.message, workflowId });
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
    { const count = await Content.countDocuments({ userId });
      return compareValues(count, condition.operator || '>=', condition.value || 0); }

    case 'post_count':
    { const postCount = await ScheduledPost.countDocuments({ userId });
      return compareValues(postCount, condition.operator || '>=', condition.value || 0); }

    case 'date':
    { const now = new Date();
      const targetDate = new Date(condition.value);
      return compareDates(now, condition.operator || '>=', targetDate); }

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
    const meta = action.metadata && typeof action.metadata === 'object' ? action.metadata : {};
    const content = new Content({
      // Caller-supplied metadata first, so it can never override the owner.
      ...meta,
      userId: String(userId),
      type: ['video', 'article', 'podcast', 'transcript'].includes(action.contentType) ? action.contentType : 'article',
      title: action.title || 'Auto-generated Content',
      description: action.description || '',
      // 'draft' is not in the Content status enum — every save failed validation.
      status: 'completed',
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
    // In development mode, return empty array for dev users
    if (process.env.NODE_ENV !== 'production' && userId && userId.toString().startsWith('dev-')) {
      logger.info('Returning empty workflow suggestions in development for dev user');
      return [];
    }
    
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
    // In development mode, return mock data for dev users
    if (process.env.NODE_ENV !== 'production' && userId && (userId.toString().startsWith('dev-') || userId.toString().startsWith('test-'))) {
      return {
        contentCreationFrequency: 0,
        postingFrequency: 0,
        mostUsedContentType: null,
        mostUsedPlatform: null,
        totalContent: 0,
        totalPosts: 0
      };
    }

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


