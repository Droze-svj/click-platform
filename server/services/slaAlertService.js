// SLA Alert Service
// Monitor and send SLA alerts

const ApprovalSLA = require('../models/ApprovalSLA');
const ContentApproval = require('../models/ContentApproval');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check and send SLA alerts
 */
async function checkSLAAlerts() {
  try {
    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, skipping SLA alerts check');
      return [];
    }

    const now = new Date();
    
    // Find SLAs that need alerts
    const slas = await ApprovalSLA.find({
      status: { $in: ['at_risk', 'overdue'] },
      completedAt: null
    })
      .populate('approvalId')
      .maxTimeMS(5000) // 5 second timeout
      .lean();

    const alerts = [];

    for (const sla of slas) {
      const approval = await ContentApproval.findById(sla.approvalId)
        .maxTimeMS(5000)
        .lean();
      if (!approval) continue;

      // Check if alert already sent recently (within last hour)
      const recentReminder = sla.reminders?.find(r => {
        const reminderTime = new Date(r.sentAt);
        return (now - reminderTime) < (60 * 60 * 1000); // 1 hour
      });

      if (recentReminder) continue;

      // Determine alert type
      let alertType = 'warning';
      if (sla.status === 'overdue') {
        alertType = 'overdue';
      } else if (sla.status === 'at_risk') {
        alertType = 'at_risk';
      }

      // Get approvers for this stage
      const currentStage = approval.stages?.find(s => s.stageOrder === sla.stageOrder);
      if (!currentStage) continue;

      const approvers = currentStage.approvals
        .filter(a => a.status === 'pending')
        .map(a => a.approverId);

      // Send alerts to approvers
      for (const approverId of approvers) {
        try {
          await NotificationService.notifyUser(approverId.toString(), {
            type: 'sla_alert',
            title: `SLA ${sla.status === 'overdue' ? 'Overdue' : 'At Risk'}: ${sla.stageName}`,
            message: `Approval for "${approval.contentId}" is ${sla.status === 'overdue' ? 'overdue' : 'at risk'}. Target: ${new Date(sla.targetCompletionAt).toLocaleString()}`,
            data: {
              approvalId: approval._id,
              slaId: sla._id,
              stageName: sla.stageName,
              status: sla.status,
              targetCompletionAt: sla.targetCompletionAt
            },
            priority: sla.status === 'overdue' ? 'high' : 'medium'
          });

          alerts.push({
            approverId,
            approvalId: approval._id,
            slaId: sla._id,
            type: alertType
          });
        } catch (error) {
          logger.warn('Error sending SLA alert', { approverId, error: error.message });
        }
      }

      // Record reminder
      await ApprovalSLA.findByIdAndUpdate(sla._id, {
        $push: {
          reminders: {
            sentAt: now,
            type: alertType
          }
        }
      }, { maxTimeMS: 5000 });
    }

    logger.info('SLA alerts checked', { alertsSent: alerts.length });
    return alerts;
  } catch (error) {
    logger.error('Error checking SLA alerts', { error: error.message });
    throw error;
  }
}

/**
 * Get SLA alerts for user
 */
async function getUserSLAAlerts(userId) {
  try {
    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot get user SLA alerts');
      return [];
    }

    // Find approvals where user is an approver
    const approvals = await ContentApproval.find({
      'stages.approvals.approverId': userId,
      'stages.approvals.status': 'pending',
      status: { $in: ['pending', 'in_progress'] }
    })
      .maxTimeMS(5000)
      .lean();

    const approvalIds = approvals.map(a => a._id);

    // Get SLAs for these approvals
    const slas = await ApprovalSLA.find({
      approvalId: { $in: approvalIds },
      status: { $in: ['at_risk', 'overdue'] },
      completedAt: null
    })
      .populate('approvalId')
      .sort({ targetCompletionAt: 1 })
      .maxTimeMS(5000)
      .lean();

    return slas.map(sla => ({
      id: sla._id,
      approvalId: sla.approvalId._id,
      stageName: sla.stageName,
      status: sla.status,
      targetCompletionAt: sla.targetCompletionAt,
      hoursRemaining: Math.max(0, (new Date(sla.targetCompletionAt) - new Date()) / (1000 * 60 * 60)),
      contentTitle: sla.approvalId.contentId?.title || 'Untitled'
    }));
  } catch (error) {
    logger.error('Error getting user SLA alerts', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  checkSLAAlerts,
  getUserSLAAlerts
};


