// Approval workflow service

const ApprovalRequest = require('../models/ApprovalRequest');
const Team = require('../models/Team');
const { createActivity } = require('./engagementService');
const logger = require('../utils/logger');

/**
 * Create approval request
 */
async function createApprovalRequest(requestData) {
  try {
    const { entityType, entityId, requestedBy, teamId, requestedFrom, message, priority, expiresIn } = requestData;

    // Check if user has permission to request approval
    if (teamId) {
      const team = await Team.findById(teamId);
      const requester = team.members.find(m => m.userId.toString() === requestedBy.toString());
      if (!requester || !requester.permissions.canShare) {
        throw new Error('Insufficient permissions to request approval');
      }
    }

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;

    const approvalRequest = new ApprovalRequest({
      entityType,
      entityId,
      requestedBy,
      teamId: teamId || null,
      requestedFrom,
      message: message || '',
      priority: priority || 'medium',
      expiresAt
    });

    await approvalRequest.save();

    // Create activity
    await createActivity(requestedBy, 'approval_requested', {
      title: 'Approval Requested',
      description: `Approval requested for ${entityType}`,
      entityType: 'approval',
      entityId: approvalRequest._id
    });

    logger.info('Approval request created', { approvalId: approvalRequest._id });
    return approvalRequest;
  } catch (error) {
    logger.error('Error creating approval request', { error: error.message });
    throw error;
  }
}

/**
 * Get approval requests for user
 */
async function getUserApprovalRequests(userId, filters = {}) {
  try {
    const query = {
      $or: [
        { requestedBy: userId },
        { requestedFrom: userId }
      ]
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.teamId) {
      query.teamId = filters.teamId;
    }

    const requests = await ApprovalRequest.find(query)
      .populate('requestedBy', 'name email')
      .populate('requestedFrom', 'name email')
      .populate('teamId', 'name')
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50);

    return requests;
  } catch (error) {
    logger.error('Error getting approval requests', { error: error.message, userId });
    return [];
  }
}

/**
 * Approve request
 */
async function approveRequest(requestId, approverId, response = '') {
  try {
    const request = await ApprovalRequest.findById(requestId);

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.requestedFrom.toString() !== approverId.toString()) {
      throw new Error('Unauthorized to approve this request');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    request.status = 'approved';
    request.response = response;
    request.respondedAt = new Date();

    await request.save();

    // Create activity
    await createActivity(request.requestedBy, 'approval_approved', {
      title: 'Approval Approved',
      description: `Your approval request has been approved`,
      entityType: 'approval',
      entityId: request._id
    });

    logger.info('Approval request approved', { requestId });
    return request;
  } catch (error) {
    logger.error('Error approving request', { error: error.message, requestId });
    throw error;
  }
}

/**
 * Reject request
 */
async function rejectRequest(requestId, rejectorId, response = '') {
  try {
    const request = await ApprovalRequest.findById(requestId);

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.requestedFrom.toString() !== rejectorId.toString()) {
      throw new Error('Unauthorized to reject this request');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    request.status = 'rejected';
    request.response = response;
    request.respondedAt = new Date();

    await request.save();

    // Create activity
    await createActivity(request.requestedBy, 'approval_rejected', {
      title: 'Approval Rejected',
      description: `Your approval request has been rejected`,
      entityType: 'approval',
      entityId: request._id
    });

    logger.info('Approval request rejected', { requestId });
    return request;
  } catch (error) {
    logger.error('Error rejecting request', { error: error.message, requestId });
    throw error;
  }
}

/**
 * Cancel request
 */
async function cancelRequest(requestId, userId) {
  try {
    const request = await ApprovalRequest.findById(requestId);

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.requestedBy.toString() !== userId.toString()) {
      throw new Error('Unauthorized to cancel this request');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    request.status = 'cancelled';
    await request.save();

    logger.info('Approval request cancelled', { requestId });
    return request;
  } catch (error) {
    logger.error('Error cancelling request', { error: error.message, requestId });
    throw error;
  }
}

/**
 * Get pending approvals count
 */
async function getPendingApprovalsCount(userId) {
  try {
    if (!userId) {
      logger.warn('getPendingApprovalsCount called without userId');
      return 0;
    }

    // Ensure userId is a valid ObjectId or string
    const mongoose = require('mongoose');
    let userIdObj;
    try {
      userIdObj = mongoose.Types.ObjectId.isValid(userId) ? userId : new mongoose.Types.ObjectId(userId);
    } catch (idError) {
      logger.error('Invalid userId format for getPendingApprovalsCount', { userId, error: idError.message });
      return 0;
    }

    const count = await ApprovalRequest.countDocuments({
      requestedFrom: userIdObj,
      status: 'pending',
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    }).catch((dbError) => {
      logger.error('Database error in getPendingApprovalsCount', { error: dbError.message, userId });
      return 0;
    });

    return count || 0;
  } catch (error) {
    logger.error('Error getting pending approvals count', { error: error.message, userId, stack: error.stack });
    return 0;
  }
}

module.exports = {
  createApprovalRequest,
  getUserApprovalRequests,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getPendingApprovalsCount
};







