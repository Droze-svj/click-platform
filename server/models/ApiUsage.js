// API Usage Model
// Track API usage for analytics and billing

const mongoose = require('mongoose');

const apiUsageSchema = new mongoose.Schema({
  apiKeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiKey',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  responseTime: {
    type: Number // milliseconds
  },
  requestSize: {
    type: Number // bytes
  },
  responseSize: {
    type: Number // bytes
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
    // Index defined below with schema.index()
  }
});

apiUsageSchema.index({ apiKeyId: 1, timestamp: -1 });
apiUsageSchema.index({ userId: 1, timestamp: -1 });
apiUsageSchema.index({ endpoint: 1, timestamp: -1 });
apiUsageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

module.exports = mongoose.model('ApiUsage', apiUsageSchema);


