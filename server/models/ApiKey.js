// API Key Model
// API keys for Content Ops API access

const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  keyHash: {
    type: String,
    required: true,
    index: true
  },
  scopes: [{
    type: String,
    enum: [
      'content.read',
      'content.write',
      'content.delete',
      'assets.read',
      'assets.write',
      'posts.read',
      'posts.write',
      'analytics.read',
      'approvals.read',
      'approvals.write',
      'webhooks.read',
      'webhooks.write'
    ],
    required: true
  }],
  rateLimit: {
    requests: { type: Number, default: 1000 },
    period: { type: String, enum: ['hour', 'day'], default: 'hour' }
  },
  lastUsedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ keyHash: 1 });

apiKeySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Generate API key
 */
apiKeySchema.statics.generateKey = function() {
  const prefix = 'ck_';
  const randomBytes = crypto.randomBytes(32);
  const key = prefix + randomBytes.toString('hex');
  return key;
};

/**
 * Hash API key
 */
apiKeySchema.statics.hashKey = function(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

/**
 * Verify API key
 */
apiKeySchema.statics.verifyKey = async function(key) {
  const keyHash = this.hashKey(key);
  const apiKey = await this.findOne({ keyHash, isActive: true });
  return apiKey;
};

module.exports = mongoose.model('ApiKey', apiKeySchema);


