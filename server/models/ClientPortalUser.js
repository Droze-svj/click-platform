// Client Portal User Model
// Users who can access client portals

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clientPortalUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  portalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhiteLabelPortal',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
    // Indexed below as standalone index
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    default: 'viewer'
  },
  permissions: {
    canViewCalendar: { type: Boolean, default: true },
    canViewDrafts: { type: Boolean, default: true },
    canViewAnalytics: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true },
    canApproveContent: { type: Boolean, default: false },
    canRequestChanges: { type: Boolean, default: true },
    canExportData: { type: Boolean, default: false }
  },
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
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

clientPortalUserSchema.index({ email: 1, portalId: 1 }, { unique: true });
clientPortalUserSchema.index({ clientWorkspaceId: 1 });

clientPortalUserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  this.updatedAt = new Date();
  next();
});

clientPortalUserSchema.methods.comparePassword = async function(candidatePassword) {
  const { comparePasswordCompat } = require('../utils/passwordCompat');
  const { match, legacy } = await comparePasswordCompat(candidatePassword, this.password);
  if (match && legacy && this._id) {
    // Stored from the old HTML-escaped input — re-hash the password as typed.
    const hash = await bcrypt.hash(candidatePassword, 10);
    // Written straight to the DB (not this.password) so a later save() of this
    // document can't re-hash the hash.
    await this.constructor.updateOne({ _id: this._id }, { $set: { password: hash } }).catch(() => {});
  }
  return match;
};

module.exports = mongoose.model('ClientPortalUser', clientPortalUserSchema);


