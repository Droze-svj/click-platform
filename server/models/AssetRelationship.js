// Asset Relationship Model
// Tracks relationships between assets

const mongoose = require('mongoose');

const assetRelationshipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceContentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  targetContentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  relationshipType: {
    type: String,
    enum: ['related', 'series', 'variation', 'duplicate', 'inspired_by', 'follows', 'references'],
    required: true
  },
  strength: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  metadata: {
    description: String,
    autoDetected: {
      type: Boolean,
      default: false
    },
    detectedBy: {
      type: String,
      enum: ['user', 'ai', 'system'],
      default: 'user'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

assetRelationshipSchema.index({ userId: 1, sourceContentId: 1, targetContentId: 1 }, { unique: true });
assetRelationshipSchema.index({ userId: 1, relationshipType: 1 });
assetRelationshipSchema.index({ sourceContentId: 1, relationshipType: 1 });

module.exports = mongoose.model('AssetRelationship', assetRelationshipSchema);


