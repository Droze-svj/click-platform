// Support Ticket Model
// Fast billing support system

const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ticketNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  // Ticket details
  category: {
    type: String,
    enum: ['billing', 'technical', 'feature_request', 'account', 'other'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // Status
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  // Billing-specific
  billingRelated: {
    type: Boolean,
    default: false,
    index: true
  },
  subscriptionId: String,
  invoiceId: String,
  // Responses
  messages: [{
    from: {
      type: String,
      enum: ['user', 'support', 'system'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    attachments: [{
      url: String,
      name: String,
      type: String
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // SLA tracking
  sla: {
    targetResponseTime: Number, // Minutes
    firstResponseAt: Date,
    resolvedAt: Date,
    onTime: { type: Boolean, default: null }
  },
  // Tags
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: Date
});

supportTicketSchema.index({ category: 1, status: 1, billingRelated: 1 });
supportTicketSchema.index({ priority: 1, createdAt: -1 });
supportTicketSchema.index({ ticketNumber: 1 });

supportTicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate ticket number if new
  if (this.isNew && !this.ticketNumber) {
    this.ticketNumber = generateTicketNumber();
  }
  
  // Set SLA for billing tickets
  if (this.billingRelated && !this.sla.targetResponseTime) {
    this.sla.targetResponseTime = 60; // 1 hour for billing
    this.priority = 'high';
  }
  
  next();
});

function generateTicketNumber() {
  return `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
