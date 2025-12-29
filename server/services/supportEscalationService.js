// Support Escalation Service
// Escalate tickets, assign to teams, manage priority

const SupportTicket = require('../models/SupportTicket');
const SupportChat = require('../models/SupportChat');
const SupportSLA = require('../models/SupportSLA');
const logger = require('../utils/logger');

/**
 * Escalate ticket
 */
async function escalateTicket(ticketId, reason, escalatedBy) {
  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Increase priority
    const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
    const currentPriority = priorityOrder[ticket.priority] || 1;
    
    if (currentPriority < 4) {
      const newPriority = Object.keys(priorityOrder).find(
        key => priorityOrder[key] === currentPriority + 1
      );
      ticket.priority = newPriority || 'urgent';
    }

    // Add escalation note
    ticket.messages.push({
      from: 'system',
      userId: escalatedBy,
      text: `Ticket escalated: ${reason}`,
      createdAt: new Date()
    });

    // Update SLA target if escalated
    if (ticket.priority === 'urgent') {
      const sla = await SupportSLA.findOne({ userId: ticket.userId, isActive: true }).lean();
      if (sla) {
        ticket.sla.targetResponseTime = Math.min(
          ticket.sla.targetResponseTime || 60,
          15 // 15 minutes for urgent
        );
      }
    }

    await ticket.save();

    // Notify support team
    await notifySupportTeam(ticket, 'escalated');

    logger.info('Ticket escalated', { ticketId, newPriority: ticket.priority });
    return ticket;
  } catch (error) {
    logger.error('Error escalating ticket', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Assign ticket to team member
 */
async function assignTicket(ticketId, assigneeId, assignedBy) {
  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    ticket.assignedTo = assigneeId;
    ticket.status = 'in_progress';

    // Add assignment note
    ticket.messages.push({
      from: 'support',
      userId: assignedBy,
      text: `Ticket assigned to support team member.`,
      createdAt: new Date()
    });

    await ticket.save();

    // Notify assignee
    await notifyAssignee(assigneeId, ticket);

    logger.info('Ticket assigned', { ticketId, assigneeId });
    return ticket;
  } catch (error) {
    logger.error('Error assigning ticket', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Auto-escalate based on SLA
 */
async function autoEscalateTickets() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Find tickets without first response within SLA
    const tickets = await SupportTicket.find({
      status: { $in: ['open', 'in_progress'] },
      'sla.firstResponseAt': null,
      createdAt: { $lt: oneHourAgo },
      priority: { $ne: 'urgent' }
    }).lean();

    for (const ticket of tickets) {
      try {
        await escalateTicket(ticket._id, 'Auto-escalated: No response within SLA', null);
      } catch (error) {
        logger.error('Error auto-escalating ticket', { ticketId: ticket._id, error: error.message });
      }
    }

    logger.info('Auto-escalation completed', { count: tickets.length });
    return tickets.length;
  } catch (error) {
    logger.error('Error in auto-escalation', { error: error.message });
    return 0;
  }
}

/**
 * Get escalation rules
 */
function getEscalationRules() {
  return {
    timeBased: {
      noResponse: {
        threshold: 60, // minutes
        action: 'increase_priority'
      },
      notResolved: {
        threshold: 24 * 60, // 24 hours
        action: 'escalate_to_manager'
      }
    },
    priorityBased: {
      high: {
        autoEscalateAfter: 30, // minutes
        escalateTo: 'urgent'
      },
      urgent: {
        notifyManager: true,
        notifyOnCall: true
      }
    },
    categoryBased: {
      billing: {
        priority: 'high',
        autoAssign: true
      },
      technical: {
        priority: 'medium',
        assignTo: 'technical_team'
      }
    }
  };
}

/**
 * Notify support team
 */
async function notifySupportTeam(ticket, event) {
  // Would send notification to support team
  logger.info('Support team notified', { ticketId: ticket._id, event });
}

/**
 * Notify assignee
 */
async function notifyAssignee(assigneeId, ticket) {
  // Would send notification to assignee
  logger.info('Assignee notified', { assigneeId, ticketId: ticket._id });
}

module.exports = {
  escalateTicket,
  assignTicket,
  autoEscalateTickets,
  getEscalationRules
};


