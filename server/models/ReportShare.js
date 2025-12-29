// Report Share Model
// Report sharing and collaboration

const mongoose = require('mongoose');
const crypto = require('crypto');

const reportShareSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GeneratedReport',
    required: true,
    index: true
  },
  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Share type
  shareType: {
    type: String,
    enum: ['public', 'private', 'password'],
    default: 'private'
  },
  // Share token (for public/private links)
  token: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  // Password (for password-protected shares)
  password: String,
  // Access control
  access: {
    canView: { type: Boolean, default: true },
    canDownload: { type: Boolean, default: true },
    canComment: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false }
  },
  // Recipients (for private shares)
  recipients: [{
    email: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    accessed: { type: Boolean, default: false },
    accessedAt: Date
  }],
  // Expiration
  expiresAt: Date,
  // View tracking
  views: [{
    viewedAt: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Comments
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

reportShareSchema.index({ token: 1 });
reportShareSchema.index({ reportId: 1, sharedBy: 1 });

reportShareSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ReportShare', reportShareSchema);


