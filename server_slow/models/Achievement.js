// Achievement/Badge system model

const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achievementType: {
    type: String,
    required: true,
    enum: [
      'first_video',
      'first_content',
      'first_script',
      'content_milestone_10',
      'content_milestone_50',
      'content_milestone_100',
      'video_milestone_10',
      'video_milestone_50',
      'streak_7',
      'streak_30',
      'streak_100',
      'workflow_master',
      'social_media_pro',
      'content_creator',
      'early_adopter',
      'power_user'
    ]
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 100 // 100% when unlocked
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
});

achievementSchema.index({ userId: 1, achievementType: 1 }, { unique: true });
achievementSchema.index({ userId: 1, unlockedAt: -1 });

module.exports = mongoose.model('Achievement', achievementSchema);







