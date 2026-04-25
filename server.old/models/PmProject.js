// PM Project — unified projects with milestones, dependencies, critical path, back-office automation

const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: { type: String, default: '' },
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  // IDs of other milestones in this project that must complete before this one
  dependencyMilestoneIds: [{ type: mongoose.Schema.Types.ObjectId, default: [] }],
  estimatedDays: { type: Number, default: 1, min: 0 },
  order: { type: Number, default: 0 },
  // Link to other app entities for unified dashboard
  linkedTaskId: { type: mongoose.Schema.Types.Mixed, default: null },
  linkedContentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null },
  linkedWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', default: null },
  // Back-office automation when milestone is completed
  automation: {
    onComplete: {
      type: String,
      enum: ['none', 'generate_report', 'run_workflow', 'notify'],
      default: 'none'
    },
    config: {
      reportTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReportTemplate', default: null },
      workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', default: null },
      notifyEmails: [String]
    }
  }
}, { _id: true });

const pmProjectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'archived'],
    default: 'planning',
    index: true
  },
  startDate: { type: Date, default: null },
  targetEndDate: { type: Date, default: null },
  milestones: {
    type: [milestoneSchema],
    default: []
  },
  // Optional link to workspace for agency/client context
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  // Aggregated progress (0–100); updated when milestones complete
  progress: { type: Number, default: 0, min: 0, max: 100 },
  // AI prediction
  aiPredictedCompletionDate: { type: Date, default: null },
  aiPredictionConfidence: { type: Number, default: null, min: 0, max: 1 },
  lastPredictionAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

pmProjectSchema.index({ userId: 1, status: 1 });
pmProjectSchema.index({ userId: 1, targetEndDate: 1 });

pmProjectSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('PmProject', pmProjectSchema);
