const mongoose = require('mongoose');

const teamInvitationSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.Mixed, // Support ObjectId and UUID
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'viewer'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

teamInvitationSchema.index({ email: 1 });
teamInvitationSchema.index({ token: 1 });
teamInvitationSchema.index({ teamId: 1 });

module.exports = mongoose.model('TeamInvitation', teamInvitationSchema);
