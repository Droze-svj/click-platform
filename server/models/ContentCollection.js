// Content Collection model

const mongoose = require('mongoose');

const contentCollectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    default: '#8B5CF6',
  },
  contentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

contentCollectionSchema.index({ userId: 1, name: 1 });

contentCollectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ContentCollection', contentCollectionSchema);






