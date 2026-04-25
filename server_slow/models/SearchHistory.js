// Search History Model

const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  query: {
    type: String,
    required: true
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  resultCount: {
    type: Number,
    default: 0
  },
  searchType: {
    type: String,
    enum: ['semantic', 'text', 'faceted'],
    default: 'text'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ userId: 1, query: 1 });
// Note: createdAt has both descending index above and TTL index below - Mongoose handles this

// Auto-delete old history (older than 90 days)
// TTL index uses ascending order { createdAt: 1 } for expiration feature
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);


