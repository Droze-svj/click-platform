// Saved video exports: stored in organized folders with optional expiration (default 10 days)
// User can extend expiration

const mongoose = require('mongoose')

const savedExportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  title: {
    type: String,
    default: 'Exported video',
  },
  /** Relative path under uploads/saved-exports (e.g. userId/contentId/export-timestamp.mp4) */
  filePath: {
    type: String,
    required: true,
  },
  /** Public URL to serve the file (e.g. /uploads/saved-exports/...) */
  url: {
    type: String,
    required: true,
  },
  /** Quality label: best, 4k, 1080p, shorts, etc. */
  quality: {
    type: String,
    default: '1080p',
  },
  /** Expiration date; after this the file can be cleaned up */
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  /** Default 10 days from creation; user can extend */
  expiresInDays: {
    type: Number,
    default: 10,
  },
}, {
  timestamps: true,
})

savedExportSchema.index({ userId: 1, contentId: 1, createdAt: -1 })
savedExportSchema.index({ expiresAt: 1 })

module.exports = mongoose.model('SavedExport', savedExportSchema)
