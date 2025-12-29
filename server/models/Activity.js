// User activity feed model

const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'video_uploaded',
      'content_generated',
      'script_created',
      'workflow_executed',
      'achievement_unlocked',
      'milestone_reached',
      'streak_continued',
      'post_scheduled',
      'quote_created'
    ]
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  entityType: {
    type: String,
    enum: ['video', 'content', 'script', 'workflow', 'achievement', 'post', 'quote']
  },
  entityId: mongoose.Schema.Types.ObjectId,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);







