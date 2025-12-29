// Webhook Log Model
// Detailed logging for webhook deliveries

const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  webhookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Webhook',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed', 'retrying'],
    default: 'pending',
    index: true
  },
  attempt: {
    type: Number,
    default: 1
  },
  httpStatus: {
    type: Number
  },
  responseTime: {
    type: Number // milliseconds
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  response: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: String,
    code: String,
    stack: String
  },
  deliveredAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

webhookLogSchema.index({ webhookId: 1, createdAt: -1 });
webhookLogSchema.index({ userId: 1, event: 1, createdAt: -1 });
webhookLogSchema.index({ status: 1, createdAt: -1 });

// Auto-delete logs older than 90 days
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('WebhookLog', webhookLogSchema);


