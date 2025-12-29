// Billing Support Service
// Fast human support for billing issues

const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Create billing support ticket
 */
async function createBillingTicket(userId, ticketData) {
  try {
    const {
      subject,
      description,
      subscriptionId,
      invoiceId,
      priority = 'high' // Billing tickets are high priority
    } = ticketData;

    const ticket = new SupportTicket({
      userId,
      category: 'billing',
      priority,
      subject,
      description,
      billingRelated: true,
      subscriptionId,
      invoiceId,
      status: 'open',
      sla: {
        targetResponseTime: 60 // 1 hour for billing
      },
      messages: [{
        from: 'user',
        userId,
        text: description,
        createdAt: new Date()
      }]
    });

    await ticket.save();

    // Notify support team (would send notification)
    await notifyBillingSupport(ticket);

    logger.info('Billing ticket created', { ticketId: ticket._id, userId });
    return ticket;
  } catch (error) {
    logger.error('Error creating billing ticket', { error: error.message, userId });
    throw error;
  }
}

/**
 * Respond to ticket
 */
async function respondToTicket(ticketId, responseData) {
  try {
    const {
      text,
      from = 'support',
      userId,
      attachments = []
    } = responseData;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Add message
    ticket.messages.push({
      from,
      userId,
      text,
      attachments,
      createdAt: new Date()
    });

    // Update status
    if (ticket.status === 'open' && from === 'support') {
      ticket.status = 'in_progress';
      ticket.sla.firstResponseAt = new Date();
      
      // Check if on time
      const responseTime = (ticket.sla.firstResponseAt - ticket.createdAt) / (1000 * 60);
      ticket.sla.onTime = responseTime <= ticket.sla.targetResponseTime;
    }

    // Auto-resolve if user confirms
    if (from === 'user' && text.toLowerCase().includes('resolved') || text.toLowerCase().includes('fixed')) {
      ticket.status = 'resolved';
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    // Notify user if from support
    if (from === 'support') {
      await notifyUser(ticket.userId, {
        type: 'support_response',
        title: 'Support Response',
        message: `Response to ticket ${ticket.ticketNumber}: ${text.substring(0, 100)}...`
      });
    }

    logger.info('Ticket responded', { ticketId, from });
    return ticket;
  } catch (error) {
    logger.error('Error responding to ticket', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Get user tickets
 */
async function getUserTickets(userId, filters = {}) {
  try {
    const {
      category = null,
      status = null,
      billingRelated = null
    } = filters;

    const query = { userId };
    if (category) query.category = category;
    if (status) query.status = status;
    if (billingRelated !== null) query.billingRelated = billingRelated;

    const tickets = await SupportTicket.find(query)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return tickets;
  } catch (error) {
    logger.error('Error getting user tickets', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get ticket
 */
async function getTicket(ticketId) {
  try {
    const ticket = await SupportTicket.findById(ticketId)
      .populate('userId', 'name email')
      .populate('assignedTo', 'name email')
      .lean();

    return ticket;
  } catch (error) {
    logger.error('Error getting ticket', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Resolve ticket
 */
async function resolveTicket(ticketId, resolvedBy) {
  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    ticket.assignedTo = resolvedBy;
    await ticket.save();

    // Notify user
    await notifyUser(ticket.userId, {
      type: 'ticket_resolved',
      title: 'Ticket Resolved',
      message: `Your ticket ${ticket.ticketNumber} has been resolved.`
    });

    logger.info('Ticket resolved', { ticketId, resolvedBy });
    return ticket;
  } catch (error) {
    logger.error('Error resolving ticket', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Get billing tickets requiring attention
 */
async function getBillingTicketsRequiringAttention() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Tickets without first response within SLA
    const overdue = await SupportTicket.find({
      category: 'billing',
      status: { $in: ['open', 'in_progress'] },
      'sla.firstResponseAt': null,
      createdAt: { $lt: oneHourAgo }
    })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    return overdue;
  } catch (error) {
    logger.error('Error getting billing tickets requiring attention', { error: error.message });
    return [];
  }
}

/**
 * Notify billing support
 */
async function notifyBillingSupport(ticket) {
  // Would send notification to support team
  logger.info('Billing support notified', { ticketId: ticket._id });
}

/**
 * Notify user
 */
async function notifyUser(userId, notification) {
  try {
    const NotificationService = require('./notificationService');
    await NotificationService.notifyUser(userId.toString(), notification);
  } catch (error) {
    logger.warn('Error notifying user', { userId, error: error.message });
  }
}

module.exports = {
  createBillingTicket,
  respondToTicket,
  getUserTickets,
  getTicket,
  resolveTicket,
  getBillingTicketsRequiringAttention
};


