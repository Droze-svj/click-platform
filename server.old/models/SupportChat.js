// Support Chat Model
// Live chat for priority support

const mongoose = require('mongoose');

const supportChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chatId: {
    type: String,
    unique: true,
    required: true
  },
  // Chat details
  category: {
    type: String,
    enum: ['billing', 'technical', 'feature', 'account', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['user', 'support', 'admin'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Messages
  messages: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'support', 'system'],
      required: true
    },
    text: String,
    attachments: [{
      url: String,
      name: String,
      type: String
    }],
    read: { type: Boolean, default: false },
    readAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Status
  status: {
    type: String,
    enum: ['active', 'waiting', 'resolved', 'closed'],
    default: 'active',
    index: true
  },
  // SLA tracking
  sla: {
    firstResponse: {
      target: Number, // minutes
      actual: Number,
      onTime: Boolean
    },
    resolution: {
      target: Number, // hours
      actual: Number,
      onTime: Boolean
    }
  },
  // Satisfaction
  satisfaction: {
    rating: Number, // 1-5
    feedback: String,
    submittedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  closedAt: Date
});

supportChatSchema.index({ userId: 1, status: 1 });
supportChatSchema.index({ status: 1, priority: 1, createdAt: -1 });
// Note: chatId already has an index from unique: true, no need for duplicate

supportChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate chat ID if new
  if (this.isNew && !this.chatId) {
    this.chatId = generateChatId();
  }
  
  next();
});

function generateChatId() {
  return `CHAT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

module.exports = mongoose.model('SupportChat', supportChatSchema);


