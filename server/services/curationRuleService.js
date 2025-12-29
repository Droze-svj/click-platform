// Curation Rule Service
// Manages automated curation rules

const CurationRule = require('../models/CurationRule');
const { autoCurateContent } = require('./contentCurationService');
const logger = require('../utils/logger');

/**
 * Create curation rule
 */
async function createCurationRule(userId, ruleData) {
  try {
    const rule = new CurationRule({
      userId,
      name: ruleData.name,
      criteria: ruleData.criteria || {},
      actions: ruleData.actions || {},
      isActive: ruleData.isActive !== undefined ? ruleData.isActive : true
    });

    await rule.save();
    logger.info('Curation rule created', { ruleId: rule._id, userId });
    return rule;
  } catch (error) {
    logger.error('Error creating curation rule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's curation rules
 */
async function getUserRules(userId, activeOnly = false) {
  try {
    const query = { userId };
    if (activeOnly) {
      query.isActive = true;
    }

    const rules = await CurationRule.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return rules;
  } catch (error) {
    logger.error('Error getting curation rules', { error: error.message, userId });
    throw error;
  }
}

/**
 * Execute curation rule
 */
async function executeCurationRule(ruleId, userId) {
  try {
    const rule = await CurationRule.findOne({
      _id: ruleId,
      userId
    });

    if (!rule) {
      throw new Error('Curation rule not found');
    }

    if (!rule.isActive) {
      return {
        executed: false,
        message: 'Rule is not active'
      };
    }

    // Execute curation
    const result = await autoCurateContent(userId, {
      minScore: rule.criteria.minScore || 70,
      maxItems: rule.actions.maxItems || 10,
      platforms: rule.criteria.platforms || null,
      contentTypes: rule.criteria.contentTypes || null,
      scheduleAutomatically: rule.actions.autoSchedule || false,
      scheduleDate: rule.actions.scheduleDate || null
    });

    // Update rule stats
    rule.lastRun = new Date();
    rule.runCount += 1;
    rule.itemsCurated += result.curated || 0;
    await rule.save();

    return {
      executed: true,
      ruleId: rule._id,
      ruleName: rule.name,
      ...result
    };
  } catch (error) {
    logger.error('Error executing curation rule', { error: error.message, ruleId });
    throw error;
  }
}

/**
 * Execute all active rules for a user
 */
async function executeAllActiveRules(userId) {
  try {
    const rules = await CurationRule.find({
      userId,
      isActive: true
    }).lean();

    const results = [];

    for (const rule of rules) {
      try {
        // Check if rule should run based on interval
        if (rule.actions.scheduleInterval) {
          const shouldRun = shouldRunRule(rule);
          if (!shouldRun) {
            continue;
          }
        }

        const result = await executeCurationRule(rule._id, userId);
        results.push(result);
      } catch (error) {
        logger.error('Error executing rule', { error: error.message, ruleId: rule._id });
        results.push({
          executed: false,
          ruleId: rule._id,
          error: error.message
        });
      }
    }

    return {
      totalRules: rules.length,
      executed: results.filter(r => r.executed).length,
      results
    };
  } catch (error) {
    logger.error('Error executing all rules', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check if rule should run based on interval
 */
function shouldRunRule(rule) {
  if (!rule.lastRun) {
    return true; // Never run before
  }

  const now = new Date();
  const lastRun = new Date(rule.lastRun);
  const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

  switch (rule.actions.scheduleInterval) {
    case 'daily':
      return hoursSinceLastRun >= 24;
    case 'weekly':
      return hoursSinceLastRun >= 168; // 7 days
    case 'monthly':
      return hoursSinceLastRun >= 720; // 30 days
    default:
      return true;
  }
}

/**
 * Update curation rule
 */
async function updateCurationRule(ruleId, userId, updates) {
  try {
    const rule = await CurationRule.findOne({
      _id: ruleId,
      userId
    });

    if (!rule) {
      throw new Error('Curation rule not found');
    }

    Object.assign(rule, updates);
    await rule.save();

    return rule;
  } catch (error) {
    logger.error('Error updating curation rule', { error: error.message, ruleId });
    throw error;
  }
}

/**
 * Delete curation rule
 */
async function deleteCurationRule(ruleId, userId) {
  try {
    const rule = await CurationRule.findOneAndDelete({
      _id: ruleId,
      userId
    });

    if (!rule) {
      throw new Error('Curation rule not found');
    }

    return rule;
  } catch (error) {
    logger.error('Error deleting curation rule', { error: error.message, ruleId });
    throw error;
  }
}

module.exports = {
  createCurationRule,
  getUserRules,
  executeCurationRule,
  executeAllActiveRules,
  updateCurationRule,
  deleteCurationRule
};


