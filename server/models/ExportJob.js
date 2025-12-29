// Export Job Model
// Track export jobs with retry logic and error handling

const mongoose = require('mongoose');

const exportJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Export details
  export: {
    type: {
      type: String,
      enum: ['content', 'analytics', 'reports', 'assets', 'bulk'],
      required: true
    },
    format: {
      type: String,
      enum: ['csv', 'excel', 'pdf', 'json', 'xml', 'zip'],
      required: true
    },
    filters: mongoose.Schema.Types.Mixed, // Export filters
    options: mongoose.Schema.Types.Mixed // Format-specific options
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  // Retry logic
  retry: {
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastAttempt: Date,
    nextRetry: Date,
    backoffMultiplier: { type: Number, default: 2 }
  },
  // Error handling
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
    stack: String,
    timestamp: Date
  },
  // Result
  result: {
    fileUrl: String,
    fileSize: Number,
    fileName: String,
    expiresAt: Date,
    downloadCount: { type: Number, default: 0 }
  },
  // Progress
  progress: {
    total: Number,
    completed: Number,
    percentage: Number,
    stage: String // 'preparing', 'processing', 'formatting', 'uploading'
  },
  // Metadata
  metadata: {
    recordCount: Number,
    startTime: Date,
    endTime: Date,
    duration: Number // milliseconds
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

exportJobSchema.index({ userId: 1, status: 1, createdAt: -1 });
exportJobSchema.index({ status: 1, 'retry.nextRetry': 1 });

exportJobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate progress percentage
  if (this.progress.total > 0) {
    this.progress.percentage = Math.round((this.progress.completed / this.progress.total) * 100);
  }
  
  next();
});

module.exports = mongoose.model('ExportJob', exportJobSchema);


