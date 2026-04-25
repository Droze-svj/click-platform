// Content folder model for organization

const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#6366f1' // Default purple
  },
  parentFolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentFolder',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

folderSchema.index({ userId: 1, name: 1 });
folderSchema.index({ userId: 1, parentFolderId: 1 });

folderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ContentFolder', folderSchema);







