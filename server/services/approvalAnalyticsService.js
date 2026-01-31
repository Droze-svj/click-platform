// Approval Analytics Service
// Analytics and insights for approval workflows

const ContentApproval = require('../models/ContentApproval');
const ApprovalSLA = require('../models/ApprovalSLA');
const logger = require('../utils/logger');

/**
 * Get approval analytics
 */
async function getApprovalAnalytics(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      clientWorkspaceId
    } = filters;

    const query = {
      'metadata.agencyId': agencyWorkspaceId
    };

    if (clientWorkspaceId) {
      query['metadata.clientId'] = clientWorkspaceId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const approvals = await ContentApproval.find(query).lean();

    // Calculate metrics
    const metrics = {
      total: approvals.length,
      byStatus: {
        pending: approvals.filter(a => a.status === 'pending').length,
        approved: approvals.filter(a => a.status === 'approved').length,
        rejected: approvals.filter(a => a.status === 'rejected').length,
        changes_requested: approvals.filter(a => a.status === 'changes_requested').length
      },
      byStage: {},
      averageTime: {},
      bottlenecks: []
    };

    // Calculate stage metrics
    approvals.forEach(approval => {
      approval.stages.forEach(stage => {
        if (!metrics.byStage[stage.stageName]) {
          metrics.byStage[stage.stageName] = {
            total: 0,
            completed: 0,
            averageTime: 0,
            pending: 0
          };
        }

        metrics.byStage[stage.stageName].total++;
        
        if (stage.status === 'completed' || stage.status === 'approved') {
          metrics.byStage[stage.stageName].completed++;
          
          if (stage.completedAt && stage.startedAt) {
            const time = (stage.completedAt - stage.startedAt) / (1000 * 60 * 60); // hours
            const current = metrics.byStage[stage.stageName].averageTime;
            const count = metrics.byStage[stage.stageName].completed;
            metrics.byStage[stage.stageName].averageTime = 
              ((current * (count - 1)) + time) / count;
          }
        } else if (stage.status === 'pending' || stage.status === 'in_progress') {
          metrics.byStage[stage.stageName].pending++;
        }
      });
    });

    // Identify bottlenecks
    Object.entries(metrics.byStage).forEach(([stageName, data]) => {
      if (data.pending > 0 && data.pending / data.total > 0.3) {
        metrics.bottlenecks.push({
          stage: stageName,
          pendingCount: data.pending,
          pendingPercentage: Math.round((data.pending / data.total) * 100),
          averageTime: Math.round(data.averageTime * 10) / 10
        });
      }
    });

    // Calculate overall average time
    const completed = approvals.filter(a => a.status === 'approved' && a.approvedAt);
    if (completed.length > 0) {
      const totalTime = completed.reduce((sum, a) => {
        const time = (a.approvedAt - a.createdAt) / (1000 * 60 * 60);
        return sum + time;
      }, 0);
      metrics.averageTime.total = Math.round((totalTime / completed.length) * 10) / 10;
    }

    return metrics;
  } catch (error) {
    logger.error('Error getting approval analytics', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get approval dashboard data
 */
async function getApprovalDashboard(userId, filters = {}) {
  try {
    const {
      workspaceId,
      assignedToMe = false
    } = filters;

    const query = {};
    if (workspaceId) query.workspaceId = workspaceId;
    if (assignedToMe) {
      query['assignedTo.userId'] = userId;
      query.status = { $in: ['pending', 'in_progress'] };
    }

    const approvals = await ContentApproval.find(query)
      .populate('contentId', 'title type')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get pending count
    const pendingCount = await ContentApproval.countDocuments({
      ...query,
      status: { $in: ['pending', 'in_progress'] },
      'assignedTo.userId': userId
    });

    // Check MongoDB connection before querying
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      logger.warn('MongoDB not connected, cannot get overdue SLA count');
      return { ...result, summary: { ...result.summary, overdue: 0 } };
    }

    // Get overdue count
    const overdueSLAs = await ApprovalSLA.countDocuments({
      status: 'overdue',
      approvalId: { $in: approvals.map(a => a._id) }
    })
      .maxTimeMS(5000);

    return {
      approvals,
      summary: {
        pending: pendingCount,
        overdue: overdueSLAs,
        total: approvals.length
      }
    };
  } catch (error) {
    logger.error('Error getting approval dashboard', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getApprovalAnalytics,
  getApprovalDashboard
};


