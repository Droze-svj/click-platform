// Saved Search Model

const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  query: {
    type: String,
    default: ''
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  useCount: {
    type: Number,
    default: 0
  }
});

savedSearchSchema.index({ userId: 1, createdAt: -1 });
savedSearchSchema.index({ userId: 1, name: 1 });

savedSearchSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SavedSearch', savedSearchSchema);


