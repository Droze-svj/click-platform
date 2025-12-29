// Approval Kanban Board Service
// Manage per-client Kanban boards for approvals

const ApprovalKanbanBoard = require('../models/ApprovalKanbanBoard');
const ContentApproval = require('../models/ContentApproval');
const ApprovalSLA = require('../models/ApprovalSLA');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get or create Kanban board for client
 */
async function getOrCreateKanbanBoard(clientWorkspaceId, agencyWorkspaceId) {
  try {
    let board = await ApprovalKanbanBoard.findOne({
      clientWorkspaceId,
      agencyWorkspaceId
    }).lean();

    if (!board) {
      const newBoard = new ApprovalKanbanBoard({
        clientWorkspaceId,
        agencyWorkspaceId,
        defaultColumns: true
      });
      await newBoard.save();
      board = newBoard.toObject();
    }

    return board;
  } catch (error) {
    logger.error('Error getting Kanban board', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get Kanban board with cards (approvals)
 */
async function getKanbanBoardWithCards(clientWorkspaceId, agencyWorkspaceId, filters = {}) {
  try {
    const board = await getOrCreateKanbanBoard(clientWorkspaceId, agencyWorkspaceId);

    // Get all approvals for this client
    const query = {
      'metadata.clientId': clientWorkspaceId,
      status: { $in: ['pending', 'in_progress', 'approved'] }
    };

    if (filters.priority) {
      query['metadata.priority'] = filters.priority;
    }

    const approvals = await ContentApproval.find(query)
      .populate('contentId', 'title type status')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Get SLAs for these approvals
    const approvalIds = approvals.map(a => a._id);
    const slas = await ApprovalSLA.find({
      approvalId: { $in: approvalIds },
      status: { $in: ['on_time', 'at_risk', 'overdue'] }
    })
      .sort({ targetCompletionAt: 1 })
      .lean();

    // Map SLAs to approvals
    const slaMap = {};
    slas.forEach(sla => {
      if (!slaMap[sla.approvalId]) {
        slaMap[sla.approvalId] = [];
      }
      slaMap[sla.approvalId].push(sla);
    });

    // Organize cards by column
    const columns = board.columns.map(column => {
      const cards = approvals
        .filter(approval => {
          // Map approval status to column status
          const status = getApprovalStatus(approval);
          return status === column.status;
        })
        .map(approval => ({
          id: approval._id.toString(),
          contentId: approval.contentId?._id,
          title: approval.contentId?.title || 'Untitled',
          type: approval.contentId?.type || 'content',
          status: getApprovalStatus(approval),
          priority: approval.metadata?.priority || 'medium',
          assignee: getCurrentAssignee(approval),
          dueDate: getDueDate(approval, slaMap[approval._id]),
          sla: getSLAStatus(approval, slaMap[approval._id]),
          createdAt: approval.createdAt,
          updatedAt: approval.updatedAt,
          currentStage: approval.currentStage,
          stageName: getCurrentStageName(approval)
        }))
        .sort((a, b) => {
          // Sort by priority, then due date
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
          }
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

      return {
        ...column,
        cards,
        count: cards.length
      };
    });

    return {
      board: {
        ...board,
        columns
      },
      summary: {
        total: approvals.length,
        byStatus: {
          needs_draft: columns.find(c => c.status === 'needs_draft')?.count || 0,
          internal_review: columns.find(c => c.status === 'internal_review')?.count || 0,
          with_client: columns.find(c => c.status === 'with_client')?.count || 0,
          approved: columns.find(c => c.status === 'approved')?.count || 0,
          scheduled: columns.find(c => c.status === 'scheduled')?.count || 0
        },
        overdue: approvals.filter(a => {
          const slas = slaMap[a._id] || [];
          return slas.some(sla => sla.status === 'overdue');
        }).length,
        atRisk: approvals.filter(a => {
          const slas = slaMap[a._id] || [];
          return slas.some(sla => sla.status === 'at_risk');
        }).length
      }
    };
  } catch (error) {
    logger.error('Error getting Kanban board with cards', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Move card between columns
 */
async function moveCard(cardId, fromColumnId, toColumnId, clientWorkspaceId, agencyWorkspaceId, userId) {
  try {
    const approval = await ContentApproval.findById(cardId);
    if (!approval) {
      throw new Error('Approval not found');
    }

    // Verify it's for the correct client
    if (approval.metadata?.clientId?.toString() !== clientWorkspaceId.toString()) {
      throw new Error('Unauthorized');
    }

    const board = await getOrCreateKanbanBoard(clientWorkspaceId, agencyWorkspaceId);
    const fromColumn = board.columns.find(c => c.id === fromColumnId);
    const toColumn = board.columns.find(c => c.id === toColumnId);

    if (!fromColumn || !toColumn) {
      throw new Error('Invalid column');
    }

    // Update approval status based on target column
    const newStatus = toColumn.status;
    await updateApprovalStatus(approval, newStatus, userId);

    logger.info('Card moved', { cardId, fromColumnId, toColumnId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Error moving card', { error: error.message, cardId });
    throw error;
  }
}

/**
 * Get approval status for Kanban
 */
function getApprovalStatus(approval) {
  if (approval.status === 'approved') {
    // Check if scheduled
    return 'approved'; // Would check if scheduled
  }

  if (approval.status === 'rejected' || approval.status === 'changes_requested') {
    return 'needs_draft';
  }

  // Check current stage
  const currentStage = approval.stages?.find(s => s.stageOrder === approval.currentStage);
  if (!currentStage) {
    return 'needs_draft';
  }

  // Map stage to column
  const stageName = currentStage.stageName?.toLowerCase() || '';
  if (stageName.includes('client') || stageName.includes('approval')) {
    return 'with_client';
  }
  if (stageName.includes('review') || stageName.includes('internal')) {
    return 'internal_review';
  }

  return 'needs_draft';
}

/**
 * Get current assignee
 */
function getCurrentAssignee(approval) {
  const currentStage = approval.stages?.find(s => s.stageOrder === approval.currentStage);
  if (!currentStage || !currentStage.approvals || currentStage.approvals.length === 0) {
    return null;
  }

  const pendingApproval = currentStage.approvals.find(a => a.status === 'pending');
  return pendingApproval?.approverId || null;
}

/**
 * Get due date
 */
function getDueDate(approval, slas) {
  if (!slas || slas.length === 0) {
    return null;
  }

  const currentSLA = slas.find(sla => sla.stageOrder === approval.currentStage);
  return currentSLA?.targetCompletionAt || null;
}

/**
 * Get SLA status
 */
function getSLAStatus(approval, slas) {
  if (!slas || slas.length === 0) {
    return null;
  }

  const currentSLA = slas.find(sla => sla.stageOrder === approval.currentStage);
  if (!currentSLA) {
    return null;
  }

  return {
    status: currentSLA.status,
    targetHours: currentSLA.targetHours,
    targetCompletionAt: currentSLA.targetCompletionAt,
    hoursRemaining: currentSLA.status === 'completed' ? 0 : 
      Math.max(0, (new Date(currentSLA.targetCompletionAt) - new Date()) / (1000 * 60 * 60))
  };
}

/**
 * Get current stage name
 */
function getCurrentStageName(approval) {
  const currentStage = approval.stages?.find(s => s.stageOrder === approval.currentStage);
  return currentStage?.stageName || 'Unknown';
}

/**
 * Update approval status
 */
async function updateApprovalStatus(approval, newStatus, userId) {
  // Map Kanban status to approval workflow status
  // This integrates with the approval workflow service
  if (newStatus === 'scheduled') {
    approval.status = 'approved';
  } else if (newStatus === 'approved') {
    approval.status = 'approved';
  } else if (newStatus === 'with_client') {
    approval.status = 'in_progress';
    // Advance to client approval stage if not already there
    const clientStage = approval.stages?.find(s => 
      s.stageName?.toLowerCase().includes('client') || 
      s.stageName?.toLowerCase().includes('approval')
    );
    if (clientStage) {
      approval.currentStage = clientStage.stageOrder;
    }
  } else if (newStatus === 'internal_review') {
    approval.status = 'in_progress';
    const reviewStage = approval.stages?.find(s => 
      s.stageName?.toLowerCase().includes('review') || 
      s.stageName?.toLowerCase().includes('internal')
    );
    if (reviewStage) {
      approval.currentStage = reviewStage.stageOrder;
    }
  } else {
    approval.status = 'pending';
  }

  approval.updatedAt = new Date();
  await approval.save();
}

module.exports = {
  getOrCreateKanbanBoard,
  getKanbanBoardWithCards,
  moveCard
};

