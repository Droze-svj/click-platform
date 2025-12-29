// Advanced Kanban Service
// Filters, search, bulk operations, swimlanes

const ApprovalKanbanBoard = require('../models/ApprovalKanbanBoard');
const ContentApproval = require('../models/ContentApproval');
const ApprovalSLA = require('../models/ApprovalSLA');
const logger = require('../utils/logger');

/**
 * Get Kanban board with advanced filters
 */
async function getKanbanBoardWithFilters(clientWorkspaceId, agencyWorkspaceId, filters = {}) {
  try {
    const {
      search = null,
      priority = null,
      assignee = null,
      status = null,
      slaStatus = null,
      dateRange = null,
      tags = null,
      sortBy = 'priority', // priority, dueDate, createdAt
      sortOrder = 'desc'
    } = filters;

    // Get base board
    const { getKanbanBoardWithCards } = require('./approvalKanbanService');
    const board = await getKanbanBoardWithCards(clientWorkspaceId, agencyWorkspaceId);

    // Apply filters to cards
    let filteredColumns = board.board.columns.map(column => {
      let cards = column.cards;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        cards = cards.filter(card =>
          card.title.toLowerCase().includes(searchLower) ||
          card.stageName.toLowerCase().includes(searchLower)
        );
      }

      // Priority filter
      if (priority) {
        cards = cards.filter(card => card.priority === priority);
      }

      // Assignee filter
      if (assignee) {
        cards = cards.filter(card =>
          card.assignee && card.assignee.toString() === assignee
        );
      }

      // SLA status filter
      if (slaStatus) {
        cards = cards.filter(card =>
          card.sla && card.sla.status === slaStatus
        );
      }

      // Date range filter
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        cards = cards.filter(card => {
          const cardDate = new Date(card.createdAt);
          return cardDate >= start && cardDate <= end;
        });
      }

      return {
        ...column,
        cards,
        count: cards.length
      };
    });

    // Sort cards
    filteredColumns = filteredColumns.map(column => {
      const sortedCards = [...column.cards].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'priority':
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
            break;
          case 'dueDate':
            if (a.dueDate && b.dueDate) {
              comparison = new Date(a.dueDate) - new Date(b.dueDate);
            } else if (a.dueDate) return -1;
            else if (b.dueDate) return 1;
            break;
          case 'createdAt':
            comparison = new Date(b.createdAt) - new Date(a.createdAt);
            break;
        }

        return sortOrder === 'asc' ? -comparison : comparison;
      });

      return {
        ...column,
        cards: sortedCards
      };
    });

    return {
      ...board,
      board: {
        ...board.board,
        columns: filteredColumns
      },
      filters: {
        applied: filters,
        resultsCount: filteredColumns.reduce((sum, col) => sum + col.count, 0)
      }
    };
  } catch (error) {
    logger.error('Error getting filtered Kanban board', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Bulk move cards
 */
async function bulkMoveCards(clientWorkspaceId, agencyWorkspaceId, cardIds, toColumnId, userId) {
  try {
    const results = [];

    for (const cardId of cardIds) {
      try {
        const { moveCard } = require('./approvalKanbanService');
        const fromColumn = await getCardColumn(cardId, clientWorkspaceId);
        if (fromColumn) {
          await moveCard(cardId, fromColumn, toColumnId, clientWorkspaceId, agencyWorkspaceId, userId);
          results.push({ cardId, success: true });
        }
      } catch (error) {
        results.push({ cardId, success: false, error: error.message });
      }
    }

    return {
      total: cardIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    logger.error('Error bulk moving cards', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get card column
 */
async function getCardColumn(cardId, clientWorkspaceId) {
  const approval = await ContentApproval.findById(cardId).lean();
  if (!approval) return null;

  const { getApprovalStatus } = require('./approvalKanbanService');
  const status = getApprovalStatus(approval);

  // Map status to column ID
  const statusToColumn = {
    'needs_draft': 'needs_draft',
    'internal_review': 'internal_review',
    'with_client': 'with_client',
    'approved': 'approved',
    'scheduled': 'scheduled'
  };

  return statusToColumn[status] || null;
}

/**
 * Get Kanban board with swimlanes
 */
async function getKanbanBoardWithSwimlanes(clientWorkspaceId, agencyWorkspaceId, swimlaneType = 'priority') {
  try {
    const { getKanbanBoardWithCards } = require('./approvalKanbanService');
    const board = await getKanbanBoardWithCards(clientWorkspaceId, agencyWorkspaceId);

    // Organize cards into swimlanes
    const swimlanes = {};

    board.board.columns.forEach(column => {
      column.cards.forEach(card => {
        const swimlaneKey = getSwimlaneKey(card, swimlaneType);
        if (!swimlanes[swimlaneKey]) {
          swimlanes[swimlaneKey] = {
            key: swimlaneKey,
            name: getSwimlaneName(swimlaneKey, swimlaneType),
            cards: []
          };
        }
        swimlanes[swimlaneKey].cards.push({
          ...card,
          columnId: column.id,
          columnName: column.name
        });
      });
    });

    // Sort swimlanes
    const sortedSwimlanes = Object.values(swimlanes).sort((a, b) => {
      if (swimlaneType === 'priority') {
        const order = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (order[b.key] || 0) - (order[a.key] || 0);
      }
      return a.name.localeCompare(b.name);
    });

    return {
      board: {
        ...board.board,
        swimlanes: sortedSwimlanes,
        swimlaneType
      },
      summary: board.summary
    };
  } catch (error) {
    logger.error('Error getting Kanban board with swimlanes', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Get swimlane key
 */
function getSwimlaneKey(card, type) {
  switch (type) {
    case 'priority':
      return card.priority || 'medium';
    case 'assignee':
      return card.assignee?.toString() || 'unassigned';
    case 'sla':
      return card.sla?.status || 'no_sla';
    default:
      return 'default';
  }
}

/**
 * Get swimlane name
 */
function getSwimlaneName(key, type) {
  switch (type) {
    case 'priority':
      return key.charAt(0).toUpperCase() + key.slice(1) + ' Priority';
    case 'assignee':
      return key === 'unassigned' ? 'Unassigned' : `Assigned to ${key}`;
    case 'sla':
      return key === 'no_sla' ? 'No SLA' : key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ');
    default:
      return key;
  }
}

/**
 * Bulk update card properties
 */
async function bulkUpdateCards(clientWorkspaceId, agencyWorkspaceId, cardIds, updates, userId) {
  try {
    const results = [];

    for (const cardId of cardIds) {
      try {
        const approval = await ContentApproval.findById(cardId);
        if (!approval || approval.metadata?.clientId?.toString() !== clientWorkspaceId) {
          results.push({ cardId, success: false, error: 'Not found or unauthorized' });
          continue;
        }

        // Update metadata
        if (updates.priority) {
          approval.metadata.priority = updates.priority;
        }
        if (updates.tags) {
          approval.metadata.tags = updates.tags;
        }

        approval.updatedAt = new Date();
        await approval.save();

        results.push({ cardId, success: true });
      } catch (error) {
        results.push({ cardId, success: false, error: error.message });
      }
    }

    return {
      total: cardIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  } catch (error) {
    logger.error('Error bulk updating cards', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

module.exports = {
  getKanbanBoardWithFilters,
  bulkMoveCards,
  getKanbanBoardWithSwimlanes,
  bulkUpdateCards
};


