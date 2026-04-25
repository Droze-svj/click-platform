const mongoose = require('mongoose');
const teamInvitationSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  email: { type: String, required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, default: 'viewer' },
  token: { type: String, required: true },
  status: { type: String, default: 'pending' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
module.exports = mongoose.model('TeamInvitation', teamInvitationSchema);
