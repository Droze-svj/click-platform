const mongoose = require('mongoose');

const agentResponseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PostComment',
    required: true
  },
  suggestedText: {
    type: String,
    required: true
  },
  sentimentAtTime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'rejected', 'posted'],
    default: 'draft',
    index: true
  },
  approvedBy: {
    type: String,
  },
  approvedAt: Date,
  postedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AgentResponse', agentResponseSchema);
