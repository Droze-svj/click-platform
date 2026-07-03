// SocialReply — one inbound comment/DM and its AI-drafted, human-approved reply.
// Lifecycle: pending_approval → approved → (optionally) sent, or → rejected.
// Nothing is sent to a real platform automatically; sending is a separate,
// flag-gated step (SOCIAL_REPLY_SEND) so a draft can never auto-post.

const mongoose = require('mongoose');

const PLATFORMS = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'threads'];

const socialReplySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  platform: { type: String, enum: PLATFORMS, required: true },

  // The inbound item (from a platform webhook or manual ingest).
  externalCommentId: { type: String, default: null }, // id of the comment/DM on the platform
  author: { type: String, default: null },             // commenter handle/name
  inboundText: { type: String, required: true },       // sanitised inbound text

  draftReply: { type: String, default: '' },  // AI draft
  editedReply: { type: String, default: null }, // human edit (wins over draft when set)

  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'sent', 'rejected', 'failed'],
    default: 'pending_approval',
    index: true,
  },

  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  sendError: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
});

socialReplySchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.SocialReply
  || mongoose.model('SocialReply', socialReplySchema);
module.exports.PLATFORMS = PLATFORMS;
