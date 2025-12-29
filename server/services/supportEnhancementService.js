// Support Enhancement Service
// Live chat, proactive support, analytics, knowledge base

const SupportChat = require('../models/SupportChat');
const SupportTicket = require('../models/SupportTicket');
const SupportSLA = require('../models/SupportSLA');
const logger = require('../utils/logger');

/**
 * Create support chat
 */
async function createSupportChat(userId, chatData) {
  try {
    const chat = new SupportChat({
      userId,
      category: chatData.category || 'other',
      priority: chatData.priority || 'medium',
      participants: [{
        userId,
        role: 'user',
        joinedAt: new Date()
      }],
      messages: chatData.initialMessage ? [{
        from: userId,
        role: 'user',
        text: chatData.initialMessage,
        createdAt: new Date()
      }] : [],
      status: 'active',
      sla: {
        firstResponse: {
          target: await getSLATarget(userId, 'firstResponse')
        },
        resolution: {
          target: await getSLATarget(userId, 'resolution')
        }
      }
    });

    await chat.save();

    // Notify support team
    await notifySupportTeam(chat);

    return chat;
  } catch (error) {
    logger.error('Error creating support chat', { error: error.message, userId });
    throw error;
  }
}

/**
 * Send chat message
 */
async function sendChatMessage(chatId, userId, messageData) {
  try {
    const chat = await SupportChat.findById(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    // Add message
    chat.messages.push({
      from: userId,
      role: chat.participants.find(p => p.userId.toString() === userId.toString())?.role || 'user',
      text: messageData.text,
      attachments: messageData.attachments || [],
      createdAt: new Date()
    });

    // Update status
    if (chat.status === 'waiting' && messageData.fromSupport) {
      chat.status = 'active';
    }

    // Check first response
    if (messageData.fromSupport && !chat.sla.firstResponse.actual) {
      const responseTime = (new Date() - chat.createdAt) / (1000 * 60); // minutes
      chat.sla.firstResponse.actual = responseTime;
      chat.sla.firstResponse.onTime = responseTime <= chat.sla.firstResponse.target;
    }

    await chat.save();

    // Notify other participants
    await notifyChatParticipants(chat, userId, messageData.text);

    return chat;
  } catch (error) {
    logger.error('Error sending chat message', { error: error.message, chatId });
    throw error;
  }
}

/**
 * Get support analytics
 */
async function getSupportAnalytics(userId = null, period = 'month') {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const query = { createdAt: { $gte: startDate } };
    if (userId) {
      query.userId = userId;
    }

    const [chats, tickets] = await Promise.all([
      SupportChat.find(query).lean(),
      SupportTicket.find(query).lean()
    ]);

    const analytics = {
      totalInteractions: chats.length + tickets.length,
      chats: {
        total: chats.length,
        active: chats.filter(c => c.status === 'active').length,
        resolved: chats.filter(c => c.status === 'resolved').length,
        averageResponseTime: calculateAverageResponseTime(chats),
        satisfaction: calculateAverageSatisfaction(chats)
      },
      tickets: {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        averageResolutionTime: calculateAverageResolutionTime(tickets)
      },
      sla: {
        firstResponseOnTime: calculateSLACompliance(chats, 'firstResponse'),
        resolutionOnTime: calculateSLACompliance(tickets, 'resolution')
      },
      byCategory: groupByCategory([...chats, ...tickets]),
      trends: calculateTrends(chats, tickets, period)
    };

    return analytics;
  } catch (error) {
    logger.error('Error getting support analytics', { error: error.message });
    throw error;
  }
}

/**
 * Proactive support check
 */
async function checkProactiveSupport(userId) {
  try {
    const triggers = [];

    // Check for usage issues
    const usageIssues = await checkUsageIssues(userId);
    if (usageIssues.length > 0) {
      triggers.push({
        type: 'usage',
        severity: 'medium',
        message: 'Usage approaching limits',
        actions: ['upgrade_prompt', 'usage_tips']
      });
    }

    // Check for error patterns
    const errorPatterns = await checkErrorPatterns(userId);
    if (errorPatterns.length > 0) {
      triggers.push({
        type: 'errors',
        severity: 'high',
        message: 'Multiple errors detected',
        actions: ['support_reach_out', 'troubleshooting_guide']
      });
    }

    // Check for inactivity
    const inactivity = await checkInactivity(userId);
    if (inactivity) {
      triggers.push({
        type: 'inactivity',
        severity: 'low',
        message: 'Account inactive',
        actions: ['re_engagement', 'feature_highlights']
      });
    }

    return triggers;
  } catch (error) {
    logger.error('Error checking proactive support', { error: error.message, userId });
    return [];
  }
}

/**
 * Get SLA target
 */
async function getSLATarget(userId, type) {
  try {
    const SupportSLAService = require('./prioritySupportService');
    const sla = await SupportSLAService.getSupportSLA(userId);
    
    if (type === 'firstResponse') {
      return sla.targets.firstResponse.minutes;
    } else if (type === 'resolution') {
      return sla.targets.resolution.hours * 60; // Convert to minutes
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting SLA target', { error: error.message });
    return 60; // Default 1 hour
  }
}

/**
 * Calculate average response time
 */
function calculateAverageResponseTime(chats) {
  const withResponse = chats.filter(c => c.sla.firstResponse.actual);
  if (withResponse.length === 0) return 0;
  
  const total = withResponse.reduce((sum, c) => sum + c.sla.firstResponse.actual, 0);
  return Math.round(total / withResponse.length);
}

/**
 * Calculate average satisfaction
 */
function calculateAverageSatisfaction(chats) {
  const withRating = chats.filter(c => c.satisfaction.rating);
  if (withRating.length === 0) return null;
  
  const total = withRating.reduce((sum, c) => sum + c.satisfaction.rating, 0);
  return Math.round((total / withRating.length) * 10) / 10;
}

/**
 * Calculate average resolution time
 */
function calculateAverageResolutionTime(tickets) {
  const resolved = tickets.filter(t => t.sla.resolvedAt);
  if (resolved.length === 0) return 0;
  
  const total = resolved.reduce((sum, t) => {
    const duration = (t.sla.resolvedAt - t.createdAt) / (1000 * 60 * 60); // hours
    return sum + duration;
  }, 0);
  
  return Math.round((total / resolved.length) * 10) / 10;
}

/**
 * Calculate SLA compliance
 */
function calculateSLACompliance(items, type) {
  const withSLA = items.filter(i => {
    if (type === 'firstResponse') {
      return i.sla?.firstResponse?.onTime !== undefined;
    } else {
      return i.sla?.onTime !== undefined;
    }
  });
  
  if (withSLA.length === 0) return null;
  
  const onTime = withSLA.filter(i => {
    if (type === 'firstResponse') {
      return i.sla.firstResponse.onTime;
    } else {
      return i.sla.onTime;
    }
  }).length;
  
  return Math.round((onTime / withSLA.length) * 100);
}

/**
 * Group by category
 */
function groupByCategory(items) {
  const grouped = {};
  items.forEach(item => {
    const category = item.category || 'other';
    grouped[category] = (grouped[category] || 0) + 1;
  });
  return grouped;
}

/**
 * Calculate trends
 */
function calculateTrends(chats, tickets, period) {
  // Would calculate trends over time
  return {
    chats: 'stable',
    tickets: 'stable',
    satisfaction: 'stable'
  };
}

/**
 * Check usage issues
 */
async function checkUsageIssues(userId) {
  // Would check actual usage
  return [];
}

/**
 * Check error patterns
 */
async function checkErrorPatterns(userId) {
  // Would check error logs
  return [];
}

/**
 * Check inactivity
 */
async function checkInactivity(userId) {
  // Would check last activity
  return false;
}

/**
 * Notify support team
 */
async function notifySupportTeam(chat) {
  // Would send notification
  logger.info('Support team notified', { chatId: chat.chatId });
}

/**
 * Notify chat participants
 */
async function notifyChatParticipants(chat, fromUserId, message) {
  // Would send notifications
  logger.info('Chat participants notified', { chatId: chat.chatId });
}

module.exports = {
  createSupportChat,
  sendChatMessage,
  getSupportAnalytics,
  checkProactiveSupport
};


