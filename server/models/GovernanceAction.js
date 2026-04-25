const mongoose = require('mongoose');

const GovernanceActionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'AUTO_KILLER_DELETION',
      'YIELD_OPTIMIZATION_PIVOT',
      'RESURRECTION_REMIX',
      'REGIONAL_COMPLIANCE_BLOCK',
      'SWARM_DEPLOYMENT',
      'STRATEGIC_ALPHA_ADJUSTMENT'
    ]
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  resourceType: {
    type: String, // 'Content', 'MonetizationPlan', etc.
    required: true
  },
  justification: {
    type: String,
    required: true // The AI "Why"
  },
  metadata: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

// Prevention of deletion/update for audit integrity
GovernanceActionSchema.pre('save', function(next) {
  if (this.isNew) return next();
  next(new Error('Governance Ledger entries are immutable.'));
});

module.exports = mongoose.model('GovernanceAction', GovernanceActionSchema);
