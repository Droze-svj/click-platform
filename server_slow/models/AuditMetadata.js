const mongoose = require('mongoose');

/**
 * AuditMetadata Schema
 * Dedicated high-volume store for AI-agent metadata, spatial continuity ledgers, 
 * and authenticity (C2PA) manifests.
 */
const auditMetadataSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  // Answer Engine Optimization (AEO) structured data
  aeo: {
    summary: String,
    keyFacts: [String],
    queryTargets: [String],
    schemaMarkup: mongoose.Schema.Types.Mixed,
    agentSignals: {
      type: Map,
      of: Number // e.g., { "chatgpt_relevance": 0.95 }
    }
  },
  // Spatial Continuity Ledger (Narrative consistency)
  spatialLedger: {
    entities: [{
      name: String,
      type: String, // e.g., 'prop', 'character', 'setting'
      traits: mongoose.Schema.Types.Mixed,
      lastSeenScene: Number,
      continuityRisk: Number
    }],
    sceneFlow: [{
      sceneIndex: Number,
      description: String,
      visualAnchors: [String]
    }],
    riskScore: {
      type: Number,
      default: 0
    }
  },
  // C2PA & Authenticity Manifests
  authenticity: {
    manifestHash: String,
    signature: String,
    provider: String,
    c2paBlock: mongoose.Schema.Types.Mixed,
    authScore: Number // Transparency/Authenticity rating
  },
  // UGC Raw Synthesis parameters
  ugcSim: {
    intensity: {
      type: String,
      enum: ['subtle', 'medium', 'heavy']
    },
    fillerInjection: [String],
    audioDegradation: mongoose.Schema.Types.Mixed,
    visualImperfections: mongoose.Schema.Types.Mixed
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

auditMetadataSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('AuditMetadata', auditMetadataSchema);
