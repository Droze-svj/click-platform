const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed, // Support ObjectId and UUID
    required: true
  },
  userName: String,
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  entityType: {
    type: String,
    enum: ['content', 'operation', 'directive'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.Mixed, // Could be content ObjectId or directive ID
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number, // Seconds into video
    default: null
  },
  screenshotUrl: String, // High-res capture of the frame
  annotation: {
    x: Number,
    y: Number,
    type: { type: String, enum: ['dot', 'box', 'draw'], default: 'dot' }
  },
  languageCode: String, // Link to specific translation
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  mentions: [String],
  // One entry per (user, type); toggled by POST /api/comments/:id/reaction.
  reactions: {
    type: [{
      _id: false,
      userId: { type: String, required: true },
      type: { type: String, enum: ['like', 'helpful'], required: true },
    }],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ teamId: 1, entityId: 1, createdAt: -1 });

commentSchema.index({ userId: 1 }); // author-scoped reads — avoid a collection scan

module.exports = mongoose.model('Comment', commentSchema);
