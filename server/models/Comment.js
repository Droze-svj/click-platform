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
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  mentions: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ teamId: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
