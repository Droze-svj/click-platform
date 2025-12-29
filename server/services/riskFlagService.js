// Risk Flag Service
// Automated risk detection and flagging

const RiskFlag = require('../models/RiskFlag');
const Content = require('../models/Content');
const WorkloadDashboard = require('../models/WorkloadDashboard');
const logger = require('../utils/logger');

/**
 * Detect and create risk flags
 */
async function detectRiskFlags(userId, clientId) {
  try {
    const flags = [];

    // Check falling engagement
    const engagementFlag = await checkFallingEngagement(userId, clientId);
    if (engagementFlag) flags.push(engagementFlag);

    // Check low posting frequency
    const frequencyFlag = await checkLowPostingFrequency(userId, clientId);
    if (frequencyFlag) flags.push(frequencyFlag);

    // Check negative sentiment
    const sentimentFlag = await checkNegativeSentiment(userId, clientId);
    if (sentimentFlag) flags.push(sentimentFlag);

    // Check content gaps
    const gapFlag = await checkContentGaps(userId, clientId);
    if (gapFlag) flags.push(gapFlag);

    // Check audience decline
    const audienceFlag = await checkAudienceDecline(userId, clientId);
    if (audienceFlag) flags.push(audienceFlag);

    return flags;
  } catch (error) {
    logger.error('Error detecting risk flags', { error: error.message, userId, clientId });
    return [];
  }
}

/**
 * Check falling engagement
 */
async function checkFallingEngagement(userId, clientId) {
  try {
    const now = new Date();
    const currentPeriod = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now
    };
    const previousPeriod = {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    // Get engagement metrics (would come from analytics)
    const currentEngagement = await getAverageEngagement(userId, clientId, currentPeriod);
    const previousEngagement = await getAverageEngagement(userId, clientId, previousPeriod);

    if (currentEngagement > 0 && previousEngagement > 0) {
      const change = ((currentEngagement - previousEngagement) / previousEngagement) * 100;
      
      if (change < -20) { // 20% drop
        const severity = change < -50 ? 'critical' : change < -30 ? 'high' : 'medium';
        
        return await createRiskFlag(userId, clientId, {
          riskType: 'falling_engagement',
          severity,
          details: {
            title: 'Falling Engagement Detected',
            description: `Engagement has dropped by ${Math.abs(Math.round(change))}% compared to last period.`,
            metrics: {
              current: currentEngagement,
              previous: previousEngagement,
              change: Math.round(change),
              threshold: -20
            },
            timeframe: {
              start: currentPeriod.start,
              end: currentPeriod.end,
              duration: Math.ceil((currentPeriod.end - currentPeriod.start) / (1000 * 60 * 60 * 24))
            }
          },
          recommendations: [
            {
              type: 'content_optimization',
              priority: 'high',
              description: 'Review and optimize content strategy',
              estimatedImpact: 'High'
            },
            {
              type: 'timing_optimization',
              priority: 'medium',
              description: 'Adjust posting times based on audience activity',
              estimatedImpact: 'Medium'
            }
          ]
        });
      }
    }

    return null;
  } catch (error) {
    logger.error('Error checking falling engagement', { error: error.message });
    return null;
  }
}

/**
 * Check low posting frequency
 */
async function checkLowPostingFrequency(userId, clientId) {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const postCount = await Content.countDocuments({
      userId,
      clientId,
      createdAt: { $gte: last30Days },
      status: { $in: ['published', 'scheduled'] }
    });

    const targetPosts = 20; // Minimum posts per month
    const postsPerWeek = postCount / 4.3;

    if (postCount < targetPosts) {
      const severity = postCount < targetPosts * 0.5 ? 'high' : 'medium';
      
      return await createRiskFlag(userId, clientId, {
        riskType: 'low_posting_frequency',
        severity,
        details: {
          title: 'Low Posting Frequency',
          description: `Only ${postCount} posts in the last 30 days. Target is ${targetPosts} posts.`,
          metrics: {
            current: postCount,
            previous: null,
            change: postCount - targetPosts,
            threshold: targetPosts
          },
          timeframe: {
            start: last30Days,
            end: now,
            duration: 30
          }
        },
        recommendations: [
          {
            type: 'increase_posting',
            priority: 'high',
            description: 'Increase posting frequency to meet targets',
            estimatedImpact: 'High'
          },
          {
            type: 'content_calendar',
            priority: 'medium',
            description: 'Create a content calendar to ensure consistent posting',
            estimatedImpact: 'Medium'
          }
        ]
      });
    }

    return null;
  } catch (error) {
    logger.error('Error checking posting frequency', { error: error.message });
    return null;
  }
}

/**
 * Check negative sentiment
 */
async function checkNegativeSentiment(userId, clientId) {
  try {
    // Get recent content with comments (would come from analytics)
    const recentContent = await Content.find({
      userId,
      clientId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).limit(20).lean();

    // Calculate sentiment (would use actual sentiment analysis)
    const negativeThreshold = 0.3; // 30% negative
    const negativeCount = 0; // placeholder - would calculate from comments
    const totalComments = 0; // placeholder

    if (totalComments > 10 && (negativeCount / totalComments) > negativeThreshold) {
      const severity = (negativeCount / totalComments) > 0.5 ? 'high' : 'medium';
      
      return await createRiskFlag(userId, clientId, {
        riskType: 'negative_sentiment',
        severity,
        details: {
          title: 'Negative Sentiment Detected',
          description: `${Math.round((negativeCount / totalComments) * 100)}% of recent comments are negative.`,
          metrics: {
            current: negativeCount,
            previous: null,
            change: (negativeCount / totalComments) * 100,
            threshold: negativeThreshold * 100
          },
          affectedPlatforms: ['twitter', 'linkedin'], // would detect from actual data
          timeframe: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date(),
            duration: 7
          }
        },
        recommendations: [
          {
            type: 'sentiment_analysis',
            priority: 'high',
            description: 'Review negative comments and address concerns',
            estimatedImpact: 'High'
          },
          {
            type: 'content_review',
            priority: 'medium',
            description: 'Review recent content for potential issues',
            estimatedImpact: 'Medium'
          }
        ]
      });
    }

    return null;
  } catch (error) {
    logger.error('Error checking negative sentiment', { error: error.message });
    return null;
  }
}

/**
 * Check content gaps
 */
async function checkContentGaps(userId, clientId) {
  try {
    const WorkloadDashboardService = require('./workloadDashboardService');
    const dashboard = await WorkloadDashboardService.getWorkloadDashboard(userId, clientId);

    if (dashboard.contentGaps.overallGapScore > 30) {
      const severity = dashboard.contentGaps.overallGapScore > 50 ? 'high' : 'medium';
      
      return await createRiskFlag(userId, clientId, {
        riskType: 'content_gap',
        severity,
        details: {
          title: 'Content Gap Detected',
          description: `Content gap score is ${dashboard.contentGaps.overallGapScore}%. Multiple platforms are below target.`,
          metrics: {
            current: dashboard.contentGaps.overallGapScore,
            previous: null,
            change: null,
            threshold: 30
          },
          affectedPlatforms: dashboard.contentGaps.platforms
            .filter(p => p.gap > 0)
            .map(p => p.platform)
        },
        recommendations: [
          {
            type: 'content_planning',
            priority: 'high',
            description: 'Create content plan to fill gaps',
            estimatedImpact: 'High'
          },
          {
            type: 'playbook_application',
            priority: 'medium',
            description: 'Apply content playbooks to increase posting',
            estimatedImpact: 'Medium'
          }
        ]
      });
    }

    return null;
  } catch (error) {
    logger.error('Error checking content gaps', { error: error.message });
    return null;
  }
}

/**
 * Check audience decline
 */
async function checkAudienceDecline(userId, clientId) {
  try {
    // Would get from analytics
    const currentFollowers = 0; // placeholder
    const previousFollowers = 0; // placeholder

    if (currentFollowers > 0 && previousFollowers > 0) {
      const change = ((currentFollowers - previousFollowers) / previousFollowers) * 100;
      
      if (change < -5) { // 5% decline
        const severity = change < -15 ? 'high' : 'medium';
        
        return await createRiskFlag(userId, clientId, {
          riskType: 'audience_decline',
          severity,
          details: {
            title: 'Audience Decline Detected',
            description: `Follower count has decreased by ${Math.abs(Math.round(change))}%.`,
            metrics: {
              current: currentFollowers,
              previous: previousFollowers,
              change: Math.round(change),
              threshold: -5
            }
          },
          recommendations: [
            {
              type: 'engagement_strategy',
              priority: 'high',
              description: 'Improve engagement to retain audience',
              estimatedImpact: 'High'
            }
          ]
        });
      }
    }

    return null;
  } catch (error) {
    logger.error('Error checking audience decline', { error: error.message });
    return null;
  }
}

/**
 * Create risk flag
 */
async function createRiskFlag(userId, clientId, flagData) {
  try {
    // Check if similar flag already exists
    const existing = await RiskFlag.findOne({
      userId,
      clientId,
      riskType: flagData.riskType,
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).lean();

    if (existing) {
      // Update existing flag
      await RiskFlag.findByIdAndUpdate(existing._id, {
        severity: flagData.severity,
        details: flagData.details,
        recommendations: flagData.recommendations,
        updatedAt: new Date()
      });
      return existing;
    }

    // Create new flag
    const flag = new RiskFlag({
      userId,
      clientId,
      riskType: flagData.riskType,
      severity: flagData.severity,
      details: flagData.details,
      recommendations: flagData.recommendations,
      actions: [
        { type: 'notify', taken: false },
        { type: 'suggest_playbook', taken: false }
      ],
      status: 'active'
    });

    await flag.save();

    // Trigger actions
    await triggerRiskActions(flag);

    return flag;
  } catch (error) {
    logger.error('Error creating risk flag', { error: error.message });
    throw error;
  }
}

/**
 * Get average engagement
 */
async function getAverageEngagement(userId, clientId, period) {
  // Would calculate from analytics
  // For now, return placeholder
  return 5.0; // 5% engagement rate
}

/**
 * Trigger risk actions
 */
async function triggerRiskActions(flag) {
  try {
    // Notify account manager
    await notifyAccountManager(flag);

    // Suggest playbooks if applicable
    if (flag.riskType === 'content_gap' || flag.riskType === 'low_posting_frequency') {
      await suggestPlaybooksForRisk(flag);
    }
  } catch (error) {
    logger.error('Error triggering risk actions', { error: error.message, flagId: flag._id });
  }
}

/**
 * Notify account manager
 */
async function notifyAccountManager(flag) {
  // Would send notification
  logger.info('Account manager notified', { flagId: flag._id, clientId: flag.clientId });
}

/**
 * Suggest playbooks for risk
 */
async function suggestPlaybooksForRisk(flag) {
  // Would suggest relevant playbooks
  logger.info('Playbooks suggested', { flagId: flag._id });
}

/**
 * Get risk flags for client
 */
async function getRiskFlags(userId, clientId, filters = {}) {
  try {
    const {
      status = null,
      severity = null,
      riskType = null
    } = filters;

    const query = { userId, clientId };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (riskType) query.riskType = riskType;

    const flags = await RiskFlag.find(query)
      .sort({ severity: 1, createdAt: -1 })
      .lean();

    return flags;
  } catch (error) {
    logger.error('Error getting risk flags', { error: error.message, userId, clientId });
    throw error;
  }
}

/**
 * Get all risk flags for user (all clients)
 */
async function getAllRiskFlags(userId, filters = {}) {
  try {
    const {
      status = 'active',
      severity = null,
      riskType = null
    } = filters;

    const query = { userId };
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (riskType) query.riskType = riskType;

    const flags = await RiskFlag.find(query)
      .populate('clientId', 'name')
      .sort({ severity: 1, createdAt: -1 })
      .lean();

    return flags;
  } catch (error) {
    logger.error('Error getting all risk flags', { error: error.message, userId });
    throw error;
  }
}

/**
 * Acknowledge risk flag
 */
async function acknowledgeRiskFlag(flagId, userId) {
  try {
    const flag = await RiskFlag.findById(flagId);
    if (!flag) {
      throw new Error('Risk flag not found');
    }

    flag.status = 'acknowledged';
    flag.timeline.push({
      event: 'Flag acknowledged',
      timestamp: new Date(),
      userId
    });

    await flag.save();
    return flag;
  } catch (error) {
    logger.error('Error acknowledging risk flag', { error: error.message, flagId });
    throw error;
  }
}

/**
 * Resolve risk flag
 */
async function resolveRiskFlag(flagId, userId, resolutionNotes, resolutionActions) {
  try {
    const flag = await RiskFlag.findById(flagId);
    if (!flag) {
      throw new Error('Risk flag not found');
    }

    flag.status = 'resolved';
    flag.resolution = {
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolutionNotes,
      resolutionActions: resolutionActions || []
    };

    flag.timeline.push({
      event: 'Flag resolved',
      timestamp: new Date(),
      userId
    });

    await flag.save();
    return flag;
  } catch (error) {
    logger.error('Error resolving risk flag', { error: error.message, flagId });
    throw error;
  }
}

module.exports = {
  detectRiskFlags,
  getRiskFlags,
  getAllRiskFlags,
  acknowledgeRiskFlag,
  resolveRiskFlag
};


