// Task-scoped chat messages with @mentions for team collaboration

const mongoose = require('mongoose');

const taskMessageSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 8000
  },
  mentionUserIds: [{
    type: mongoose.Schema.Types.Mixed,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

taskMessageSchema.index({ taskId: 1, createdAt: 1 });

module.exports = mongoose.model('TaskMessage', taskMessageSchema);
