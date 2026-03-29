// Task model — unlimited subtask nesting (parentId), multi-view (Kanban/Gantt/list), AI urgency sort

const mongoose = require('mongoose');

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: TASK_STATUSES,
    default: 'todo'
  },
  priority: {
    type: String,
    enum: PRIORITIES,
    default: 'medium'
  },
  // AI-computed urgency score (0–100); higher = more urgent. Updated on save or via API.
  urgencyScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  dueDate: {
    type: Date,
    default: null
  },
  startDate: {
    type: Date,
    default: null
  },
  // Unlimited nesting: parent task (null = root)
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
  listId: {
    type: String,
    default: null
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  tags: [String],
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.index({ userId: 1, status: 1, order: 1 });
taskSchema.index({ userId: 1, parentId: 1, order: 1 });
taskSchema.index({ userId: 1, dueDate: 1 });

taskSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.status === 'done') this.completedAt = this.completedAt || new Date();
  next();
});

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.PRIORITIES = PRIORITIES;
