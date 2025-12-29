// Approval Kanban Board Model
// Per-client Kanban board for approval status

const mongoose = require('mongoose');

const approvalKanbanBoardSchema = new mongoose.Schema({
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Kanban Columns
  columns: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    status: {
      type: String,
      enum: ['needs_draft', 'internal_review', 'with_client', 'approved', 'scheduled'],
      required: true
    },
    color: { type: String, default: '#3B82F6' },
    limit: { type: Number, default: null } // Max items in column
  }],
  // Default columns
  defaultColumns: {
    type: Boolean,
    default: true
  },
  // Customization
  settings: {
    showSLA: { type: Boolean, default: true },
    showDueDates: { type: Boolean, default: true },
    showPriority: { type: Boolean, default: true },
    showAssignee: { type: Boolean, default: true },
    autoRefresh: { type: Boolean, default: true },
    refreshInterval: { type: Number, default: 30 } // seconds
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

approvalKanbanBoardSchema.index({ clientWorkspaceId: 1, agencyWorkspaceId: 1 });

approvalKanbanBoardSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Set default columns if not set
  if (this.defaultColumns && (!this.columns || this.columns.length === 0)) {
    this.columns = [
      { id: 'needs_draft', name: 'Needs Draft', order: 0, status: 'needs_draft', color: '#EF4444' },
      { id: 'internal_review', name: 'Internal Review', order: 1, status: 'internal_review', color: '#F59E0B' },
      { id: 'with_client', name: 'With Client', order: 2, status: 'with_client', color: '#3B82F6' },
      { id: 'approved', name: 'Approved', order: 3, status: 'approved', color: '#10B981' },
      { id: 'scheduled', name: 'Scheduled', order: 4, status: 'scheduled', color: '#8B5CF6' }
    ];
  }

  next();
});

module.exports = mongoose.model('ApprovalKanbanBoard', approvalKanbanBoardSchema);


