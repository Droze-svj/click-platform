// Multi-Step Workflow Service
// Creator → Internal Reviewer → Client Approver → Scheduled

const ContentApproval = require('../models/ContentApproval');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const PostVersion = require('../models/PostVersion');
const EmailApprovalToken = require('../models/EmailApprovalToken');
// Email service will be required when needed
const logger = require('../utils/logger');

/**
 * Create multi-step approval workflow
 */
async function createMultiStepApproval(contentId, workflowConfig) {
  try {
    const {
      workspaceId,
      createdBy,
      internalReviewerId,
      clientApproverId,
      clientApproverEmail,
      scheduledPostId = null
    } = workflowConfig;

    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Create approval with multi-step stages
    const approval = new ContentApproval({
      contentId,
      workspaceId,
      createdBy,
      status: 'pending',
      currentStage: 0,
      stages: [
        {
          stageOrder: 0,
          stageName: 'Created',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          autoApproved: true
        },
        {
          stageOrder: 1,
          stageName: 'Internal Review',
          status: 'pending',
          approvals: internalReviewerId ? [{
            approverId: internalReviewerId,
            status: 'pending'
          }] : []
        },
        {
          stageOrder: 2,
          stageName: 'Client Approval',
          status: 'pending',
          approvals: clientApproverId || clientApproverEmail ? [{
            approverId: clientApproverId || null,
            status: 'pending'
          }] : []
        },
        {
          stageOrder: 3,
          stageName: 'Scheduled',
          status: 'pending',
          autoApproved: false
        }
      ],
      assignedTo: [
        ...(internalReviewerId ? [{
          userId: internalReviewerId,
          stageOrder: 1
        }] : []),
        ...(clientApproverId ? [{
          userId: clientApproverId,
          stageOrder: 2
        }] : [])
      ],
      history: [{
        action: 'created',
        userId: createdBy,
        comment: 'Content created and submitted for approval',
        timestamp: new Date()
      }]
    });

    await approval.save();

    // Create initial version
    if (scheduledPostId) {
      const post = await ScheduledPost.findById(scheduledPostId);
      if (post) {
        await createPostVersion(scheduledPostId, contentId, createdBy, {
          content: post.content,
          metadata: {
            platform: post.platform,
            scheduledTime: post.scheduledTime
          }
        });
      }
    }

    // Notify internal reviewer
    if (internalReviewerId) {
      await notifyInternalReviewer(approval._id, internalReviewerId, content);
    }

    logger.info('Multi-step approval created', { approvalId: approval._id, contentId });
    return approval;
  } catch (error) {
    logger.error('Error creating multi-step approval', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Advance to next stage
 */
async function advanceToNextStage(approvalId, userId, action, comment = '') {
  try {
    const approval = await ContentApproval.findById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    const currentStage = approval.stages.find(s => s.stageOrder === approval.currentStage);
    if (!currentStage) {
      throw new Error('Current stage not found');
    }

    // Update current stage
    if (action === 'approve') {
      currentStage.status = 'approved';
      currentStage.completedAt = new Date();

      // Update approver status
      const approver = currentStage.approvals.find(a => a.approverId.toString() === userId.toString());
      if (approver) {
        approver.status = 'approved';
        approver.approvedAt = new Date();
        approver.comment = comment;
      }

      // Move to next stage
      approval.currentStage++;

      // Check if all stages complete
      if (approval.currentStage >= approval.stages.length) {
        approval.status = 'approved';
        approval.approvedAt = new Date();

        // Auto-schedule if there's a scheduled post
        const scheduledPost = await ScheduledPost.findOne({ contentId: approval.contentId });
        if (scheduledPost && scheduledPost.status === 'pending') {
          scheduledPost.status = 'scheduled';
          await scheduledPost.save();
        }
      } else {
        // Move to next stage
        const nextStage = approval.stages.find(s => s.stageOrder === approval.currentStage);
        if (nextStage) {
          nextStage.status = 'in_progress';
          nextStage.startedAt = new Date();

          // Notify next approver
          if (nextStage.stageOrder === 2) {
            // Client approval stage
            await notifyClientApprover(approval._id, nextStage, approval.contentId);
          } else if (nextStage.stageOrder === 1) {
            // Internal review stage
            const reviewer = approval.assignedTo.find(a => a.stageOrder === 1);
            if (reviewer) {
              const content = await Content.findById(approval.contentId);
              await notifyInternalReviewer(approval._id, reviewer.userId, content);
            }
          }
        }
      }
    } else if (action === 'reject') {
      currentStage.status = 'rejected';
      approval.status = 'rejected';
      approval.rejectedAt = new Date();

      const approver = currentStage.approvals.find(a => a.approverId.toString() === userId.toString());
      if (approver) {
        approver.status = 'rejected';
        approver.rejectionReason = comment;
      }
    } else if (action === 'request_changes') {
      currentStage.status = 'changes_requested';
      approval.status = 'changes_requested';

      const approver = currentStage.approvals.find(a => a.approverId.toString() === userId.toString());
      if (approver) {
        approver.status = 'changes_requested';
        approver.requestedChanges = comment;
      }

      // Move back to creator
      approval.currentStage = 0;
    }

    // Add to history
    approval.history.push({
      action: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes_requested',
      userId,
      stageOrder: approval.currentStage - (action === 'request_changes' ? 1 : 0),
      comment,
      timestamp: new Date()
    });

    await approval.save();

    logger.info('Approval stage advanced', { approvalId, action, newStage: approval.currentStage });
    return approval;
  } catch (error) {
    logger.error('Error advancing approval stage', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Get approval status with audit trail
 */
async function getApprovalStatus(approvalId) {
  try {
    const approval = await ContentApproval.findById(approvalId)
      .populate('contentId', 'title type content')
      .populate('createdBy', 'name email')
      .populate('stages.approvals.approverId', 'name email')
      .populate('assignedTo.userId', 'name email')
      .populate('history.userId', 'name email')
      .lean();

    if (!approval) {
      throw new Error('Approval not found');
    }

    // Get current status
    const currentStage = approval.stages.find(s => s.stageOrder === approval.currentStage);
    const nextStage = approval.stages.find(s => s.stageOrder === approval.currentStage + 1);

    return {
      approval,
      currentStage: {
        ...currentStage,
        name: currentStage?.stageName,
        order: approval.currentStage
      },
      nextStage: nextStage ? {
        ...nextStage,
        name: nextStage.stageName,
        order: nextStage.stageOrder
      } : null,
      status: approval.status,
      progress: {
        current: approval.currentStage + 1,
        total: approval.stages.length,
        percentage: Math.round(((approval.currentStage + 1) / approval.stages.length) * 100)
      },
      auditTrail: approval.history,
      canApprove: currentStage?.status === 'in_progress' || currentStage?.status === 'pending',
      canRequestChanges: currentStage?.status === 'in_progress' || currentStage?.status === 'pending'
    };
  } catch (error) {
    logger.error('Error getting approval status', { error: error.message, approvalId });
    throw error;
  }
}

/**
 * Create post version
 */
async function createPostVersion(postId, contentId, userId, versionData) {
  try {
    // Get latest version number
    const latestVersion = await PostVersion.findOne({ postId })
      .sort({ versionNumber: -1 })
      .lean();

    const versionNumber = (latestVersion?.versionNumber || 0) + 1;

    const version = new PostVersion({
      postId,
      contentId,
      versionNumber,
      createdBy: userId,
      ...versionData
    });

    await version.save();
    return version;
  } catch (error) {
    logger.error('Error creating post version', { error: error.message, postId });
    throw error;
  }
}

/**
 * Compare two versions
 */
async function compareVersions(postId, version1Number, version2Number) {
  try {
    const [version1, version2] = await Promise.all([
      PostVersion.findOne({ postId, versionNumber: version1Number }),
      PostVersion.findOne({ postId, versionNumber: version2Number })
    ]);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const differences = [];

    // Compare text
    if (version1.content.text !== version2.content.text) {
      differences.push({
        field: 'text',
        type: 'text',
        oldValue: version1.content.text,
        newValue: version2.content.text,
        diff: calculateTextDiff(version1.content.text, version2.content.text)
      });
    }

    // Compare hashtags
    const hashtags1 = (version1.content.hashtags || []).sort().join(',');
    const hashtags2 = (version2.content.hashtags || []).sort().join(',');
    if (hashtags1 !== hashtags2) {
      differences.push({
        field: 'hashtags',
        type: 'array',
        oldValue: version1.content.hashtags,
        newValue: version2.content.hashtags,
        added: version2.content.hashtags.filter(h => !version1.content.hashtags.includes(h)),
        removed: version1.content.hashtags.filter(h => !version2.content.hashtags.includes(h))
      });
    }

    // Compare media
    if (version1.content.mediaUrl !== version2.content.mediaUrl) {
      differences.push({
        field: 'mediaUrl',
        type: 'url',
        oldValue: version1.content.mediaUrl,
        newValue: version2.content.mediaUrl
      });
    }

    return {
      version1: {
        number: version1.versionNumber,
        createdAt: version1.createdAt,
        createdBy: version1.createdBy
      },
      version2: {
        number: version2.versionNumber,
        createdAt: version2.createdAt,
        createdBy: version2.createdBy
      },
      differences,
      summary: {
        totalChanges: differences.length,
        textChanged: differences.some(d => d.field === 'text'),
        hashtagsChanged: differences.some(d => d.field === 'hashtags'),
        mediaChanged: differences.some(d => d.field === 'mediaUrl')
      }
    };
  } catch (error) {
    logger.error('Error comparing versions', { error: error.message, postId });
    throw error;
  }
}

/**
 * Calculate text diff (simplified)
 */
function calculateTextDiff(oldText, newText) {
  // Simplified diff - in production use a proper diff library
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      diff.push({
        line: i + 1,
        old: oldLine,
        new: newLine,
        type: oldLine === '' ? 'added' : newLine === '' ? 'removed' : 'modified'
      });
    }
  }

  return diff;
}

/**
 * Notify internal reviewer
 */
async function notifyInternalReviewer(approvalId, reviewerId, content) {
  try {
    const User = require('../models/User');
    const reviewer = await User.findById(reviewerId);

    if (!reviewer) return;

    // Send notification (email or in-app)
    const notificationService = require('./notificationService');
    await notificationService.sendNotification(reviewerId, {
      type: 'approval_requested',
      title: 'Content Review Required',
      message: `New content requires your review: ${content.title || 'Untitled'}`,
      link: `/approvals/${approvalId}`,
      metadata: {
        approvalId: approvalId.toString(),
        contentId: content._id.toString()
      }
    });

    logger.info('Internal reviewer notified', { approvalId, reviewerId });
  } catch (error) {
    logger.warn('Error notifying internal reviewer', { error: error.message });
  }
}

/**
 * Notify client approver
 */
async function notifyClientApprover(approvalId, stage, contentId) {
  try {
    const content = await Content.findById(contentId);
    const approval = await ContentApproval.findById(approvalId);

    // Get client approver
    const approver = stage.approvals[0];
    if (!approver) return;

    // Create email approval token
    const token = new EmailApprovalToken({
      approvalId,
      stageOrder: stage.stageOrder,
      approverEmail: approver.approverId?.email || approval.metadata?.clientApproverEmail,
      approverName: approver.approverId?.name,
      action: 'approve',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await token.save();

    // Generate approval URLs
    const approveUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/approve/${token.token}`;
    const rejectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reject/${token.token}`;
    const requestChangesUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/request-changes/${token.token}`;

    // Send email
    try {
      const emailService = require('./emailService');
      if (emailService && emailService.sendEmail) {
        await emailService.sendEmail({
      to: token.approverEmail,
      subject: 'Content Approval Required',
      template: 'approval-request',
      data: {
        approverName: token.approverName,
        contentTitle: content?.title || 'Content',
        contentPreview: content?.content?.text?.substring(0, 200) || '',
        approveUrl,
        rejectUrl,
        requestChangesUrl,
        expiresAt: token.expiresAt
      }
        });
      }
    } catch (error) {
      logger.warn('Error sending approval email', { error: error.message });
      // Continue even if email fails
    }

    logger.info('Client approver notified', { approvalId, email: token.approverEmail });
  } catch (error) {
    logger.error('Error notifying client approver', { error: error.message, approvalId });
  }
}

module.exports = {
  createMultiStepApproval,
  advanceToNextStage,
  getApprovalStatus,
  createPostVersion,
  compareVersions
};

