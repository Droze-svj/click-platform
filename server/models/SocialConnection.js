// Social media OAuth connections model

const mongoose = require('mongoose');
const { encryptToken, decryptToken } = require('../utils/dataEncryption');

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
  // accessToken / refreshToken are encrypted AT REST (AES-256-GCM) via the
  // setter, which stores the `enc:v1:<payload>` form. The getter transparently
  // decrypts on read and PASSES THROUGH legacy plaintext (or any value that
  // fails to decrypt) unchanged, so a DB full of pre-existing plaintext tokens
  // keeps working. These getters run on hydrated documents; .lean()/updateOne
  // queries BYPASS them, so token-read sites on lean docs must call
  // decryptToken() and token-write sites using updateOne/findOneAndUpdate must
  // call encryptToken() explicitly (see dataEncryption.js).
  accessToken: {
    type: String,
    required: true,
    set: encryptToken,
    get: decryptToken
  },
  refreshToken: {
    type: String,
    set: encryptToken,
    get: decryptToken
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
  // ── Account-level insight cache (populated by accountInsightsService) ──
  // A lightweight, fast-read snapshot of the most recent account insights so
  // the marketing brain/recommendations can read follower/audience signals
  // without re-querying every platform. The authoritative time-series lives in
  // the AudienceGrowth collection; these fields are just the latest values.
  followerCount: {
    type: Number,
    default: null // null = never synced / unavailable (NOT zero)
  },
  // Most recent audience signals (e.g. demographics) where the platform API
  // returns them. Mixed so each platform can store what it actually exposes;
  // absent/unavailable platforms simply leave this null rather than fabricate.
  audience: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastInsightsSync: {
    type: Date,
    default: null
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







