// Social media OAuth connections model

const mongoose = require('mongoose');

const socialConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest']
  },
  platformUserId: {
    type: String,
    required: true
  },
  platformUsername: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  tokenExpiresAt: {
    type: Date
  },
  scope: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
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

// Multi-account: a user can connect multiple accounts on the same platform
// (two TikToks, three Twitters, etc.). Uniqueness is on (userId, platform,
// platformUserId) so the same account isn't connected twice, while different
// accounts on the same platform coexist. The compound index also keeps
// per-platform lookups fast.
socialConnectionSchema.index(
  { userId: 1, platform: 1, platformUserId: 1 },
  { unique: true, partialFilterExpression: { platformUserId: { $type: 'string' } } }
);
socialConnectionSchema.index({ userId: 1, platform: 1, isActive: 1 });
socialConnectionSchema.index({ userId: 1, isActive: 1 });

socialConnectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SocialConnection', socialConnectionSchema);







