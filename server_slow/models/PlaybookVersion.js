// Playbook Version Model
// Version history for playbooks

const mongoose = require('mongoose');

const playbookVersionSchema = new mongoose.Schema({
  playbookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playbook',
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  // Snapshot of playbook at this version
  snapshot: {
    structure: mongoose.Schema.Types.Mixed,
    contentTemplates: [mongoose.Schema.Types.Mixed],
    scheduling: mongoose.Schema.Types.Mixed,
    approval: mongoose.Schema.Types.Mixed,
    successCriteria: mongoose.Schema.Types.Mixed
  },
  // Changes made in this version
  changes: [{
    type: {
      type: String,
      enum: ['added', 'removed', 'modified']
    },
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    description: String
  }],
  changeDescription: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

playbookVersionSchema.index({ playbookId: 1, versionNumber: 1 }, { unique: true });
playbookVersionSchema.index({ playbookId: 1, createdAt: -1 });

module.exports = mongoose.model('PlaybookVersion', playbookVersionSchema);


