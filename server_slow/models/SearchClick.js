// Search Click Tracking Model

const mongoose = require('mongoose');

const searchClickSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  searchId: {
    type: String,
    default: null
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  query: {
    type: String,
    default: ''
  },
  clickedAt: {
    type: Date,
    default: Date.now
  }
});

searchClickSchema.index({ userId: 1, clickedAt: -1 });
searchClickSchema.index({ contentId: 1 });
searchClickSchema.index({ searchId: 1 });
searchClickSchema.index({ clickedAt: -1 });

// Auto-delete old clicks (older than 90 days)
searchClickSchema.index({ clickedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('SearchClick', searchClickSchema);


