// SLA Tracking Service
// Track and enforce approval SLAs

const ApprovalSLA = require('../models/ApprovalSLA');
const ContentApproval = require('../models/ContentApproval');
const { sendNotification } = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Check and update SLA status
 */
async function checkSLAStatus(approvalId) {
  try {
    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot check SLA status');
      return [];
    }

    const slas = await ApprovalSLA.find({
      approvalId,
      status: { $in: ['on_time', 'at_risk', 'overdue'] }
    })
      .maxTimeMS(5000) // 5 second timeout
      .lean();

    const now = new Date();
    const updates = [];

    for (const sla of slas) {
      const hoursRemaining = (sla.targetCompletionAt - now) / (1000 * 60 * 60);
      let newStatus = sla.status;

      if (hoursRemaining < 0) {
        newStatus = 'overdue';
      } else if (hoursRemaining < (sla.targetHours * 0.2)) {
        newStatus = 'at_risk';
      } else {
        newStatus = 'on_time';
      }

      if (newStatus !== sla.status) {
        // Update status in database
        await ApprovalSLA.findByIdAndUpdate(sla._id, {
          status: newStatus,
          updatedAt: new Date()
        }, { maxTimeMS: 5000 }).exec();

        // Send notifications (pass the updated sla object)
        const updatedSla = { ...sla, status: newStatus };
        await sendSLANotification(updatedSla, newStatus);

        // Auto-escalate if overdue
        if (newStatus === 'overdue' && updatedSla.escalatedTo && !updatedSla.escalated) {
          await escalateApproval(approvalId, updatedSla);
        }
      }

      updates.push({
        slaId: sla._id,
        status: newStatus,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10
      });
    }

    return updates;
  } catch (error) {
    logger.error('Error checking SLA status', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Send SLA notification
 */
async function sendSLANotification(sla, status) {
  try {
    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot send SLA notification');
      return;
    }

    const approval = await ContentApproval.findById(sla.approvalId)
      .populate('assignedTo.userId')
      .maxTimeMS(5000)
      .lean();

    if (!approval || !sla._id) return;

    if (!approval) return;

    // Get approvers for this stage
    const stage = approval.stages.find(s => s.stageOrder === sla.stageOrder);
    if (!stage) return;

    const approvers = stage.approvals.filter(a => a.status === 'pending');
    
    for (const approver of approvers) {
      const notificationType = status === 'overdue' ? 'sla_overdue' :
                               status === 'at_risk' ? 'sla_at_risk' :
                               'sla_warning';

      await sendNotification(approver.approverId, {
        type: notificationType,
        title: `Approval ${status === 'overdue' ? 'Overdue' : 'At Risk'}`,
        message: `Approval for stage "${sla.stageName}" is ${status}`,
        link: `/approvals/${sla.approvalId}`,
        metadata: {
          approvalId: sla.approvalId.toString(),
          slaId: sla._id.toString(),
          hoursRemaining: Math.round((sla.targetCompletionAt - new Date()) / (1000 * 60 * 60))
        }
      });

      // Add reminder
      await ApprovalSLA.findByIdAndUpdate(sla._id, {
        $push: {
          reminders: {
            sentAt: new Date(),
            type: status === 'overdue' ? 'overdue' : status === 'at_risk' ? 'at_risk' : 'warning'
          }
        }
      }, { maxTimeMS: 5000 }).exec();
    }
  } catch (error) {
    logger.warn('Error sending SLA notification', { error: error.message });
  }
}

/**
 * Escalate approval
 */
async function escalateApproval(approvalId, sla) {
  try {
    if (!sla.escalatedTo) return;

    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot escalate approval');
      return;
    }

    const approval = await ContentApproval.findById(approvalId)
      .maxTimeMS(5000);
    if (!approval) return;

    // Add escalation to history
    approval.history.push({
      action: 'reassigned',
      userId: sla.escalatedTo,
      stageOrder: sla.stageOrder,
      comment: 'Auto-escalated due to SLA breach',
      timestamp: new Date()
    });

    // Update stage approvers
    const stage = approval.stages.find(s => s.stageOrder === sla.stageOrder);
    if (stage) {
      stage.approvals.push({
        approverId: sla.escalatedTo,
        status: 'pending',
        createdAt: new Date()
      });
    }

    await approval.save({ maxTimeMS: 5000 });

    // Mark SLA as escalated
    await ApprovalSLA.findByIdAndUpdate(sla._id, {
      escalated: true,
      escalatedAt: new Date(),
      updatedAt: new Date()
    }, { maxTimeMS: 5000 }).exec();

    // Notify escalated user
    await sendNotification(sla.escalatedTo, {
      type: 'approval_escalated',
      title: 'Approval Escalated to You',
      message: `Approval has been escalated due to SLA breach`,
      link: `/approvals/${approvalId}`
    });

    logger.info('Approval escalated', { approvalId, escalatedTo: sla.escalatedTo });
  } catch (error) {
    logger.error('Error escalating approval', { error: error.message, approvalId });
  }
}

/**
 * Get SLA analytics
 */
async function getSLAAnalytics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      stageOrder
    } = filters;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (stageOrder !== undefined) {
      query.stageOrder = stageOrder;
    }

    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot get SLA analytics');
      return {
        total: 0,
        onTime: 0,
        atRisk: 0,
        overdue: 0,
        escalated: 0,
        averageCompletionTime: 0,
        averageTargetTime: 0
      };
    }

    // Get approvals for this agency
    const approvals = await ContentApproval.find({
      'metadata.agencyId': agencyWorkspaceId
    })
      .select('_id')
      .maxTimeMS(5000)
      .lean();

    const approvalIds = approvals.map(a => a._id);
    query.approvalId = { $in: approvalIds };

    const slas = await ApprovalSLA.find(query)
      .maxTimeMS(5000)
      .lean();

    // Calculate metrics
    const metrics = {
      total: slas.length,
      onTime: slas.filter(s => s.status === 'on_time' || s.status === 'completed').length,
      atRisk: slas.filter(s => s.status === 'at_risk').length,
      overdue: slas.filter(s => s.status === 'overdue').length,
      escalated: slas.filter(s => s.escalated).length,
      averageCompletionTime: 0,
      averageTargetTime: 0
    };

    const completed = slas.filter(s => s.completedAt);
    if (completed.length > 0) {
      const totalCompletionTime = completed.reduce((sum, sla) => {
        const time = (sla.completedAt - sla.startedAt) / (1000 * 60 * 60);
        return sum + time;
      }, 0);
      metrics.averageCompletionTime = Math.round((totalCompletionTime / completed.length) * 10) / 10;
    }

    if (slas.length > 0) {
      const totalTargetTime = slas.reduce((sum, sla) => sum + sla.targetHours, 0);
      metrics.averageTargetTime = Math.round((totalTargetTime / slas.length) * 10) / 10;
    }

    return metrics;
  } catch (error) {
    logger.error('Error getting SLA analytics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Auto-approve if SLA allows
 */
async function checkAutoApprove(approvalId, stageOrder) {
  try {
    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return false;
    }

    const sla = await ApprovalSLA.findOne({ approvalId, stageOrder })
      .maxTimeMS(5000);
    if (!sla || !sla.targetCompletionAt) return false;

    const now = new Date();
    if (now > sla.targetCompletionAt) {
      // Check if auto-approve is enabled
      const approval = await ContentApproval.findById(approvalId)
        .maxTimeMS(5000)
        .exec();
      const stage = approval.stages.find(s => s.stageOrder === stageOrder);
      
      // This would check template settings for auto-approve
      // For now, return false (manual approval required)
      return false;
    }

    return false;
  } catch (error) {
    logger.error('Error checking auto-approve', { error: error.message, approvalId });
    return false;
  }
}

module.exports = {
  checkSLAStatus,
  escalateApproval,
  getSLAAnalytics,
  checkAutoApprove
};


