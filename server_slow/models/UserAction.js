// User action tracking model for learning patterns

const mongoose = require('mongoose');

const userActionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['upload_video', 'generate_content', 'generate_script', 'create_quote', 'schedule_post', 'apply_effects', 'add_music', 'export', 'view', 'edit', 'delete']
  },
  entityType: {
    type: String,
    enum: ['video', 'content', 'script', 'quote', 'post', 'music']
  },
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  context: {
    previousAction: String,
    sessionId: String,
    page: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Indexes for pattern analysis
userActionSchema.index({ userId: 1, timestamp: -1 });
userActionSchema.index({ userId: 1, action: 1, timestamp: -1 });
userActionSchema.index({ userId: 1, 'context.previousAction': 1 });

module.exports = mongoose.model('UserAction', userActionSchema);







