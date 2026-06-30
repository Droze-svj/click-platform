// AgenticJob — persistent record of an autonomous content-agent pipeline run.
// Previously these lived only in an in-memory Map and were lost on restart;
// persisting them lets status survive restarts and gives the marketing/agent
// dashboards a real source of truth for agent activity.

const mongoose = require('mongoose');

const agenticJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  videoId: { type: String, index: true },
  goals: { type: mongoose.Schema.Types.Mixed, default: [] },
  status: { type: String, enum: ['running', 'done', 'error'], default: 'running', index: true },
  currentStep: { type: String, default: 'transcribe' },
  progress: { type: Number, default: 0 },
  steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
  logs: { type: [String], default: [] },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: null },
  autoPublish: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

agenticJobSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.AgenticJob || mongoose.model('AgenticJob', agenticJobSchema);
