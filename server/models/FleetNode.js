const mongoose = require('mongoose');

const fleetNodeSchema = new mongoose.Schema({
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
  nodeUri: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'synchronizing', 'error'],
    default: 'online'
  },
  nodeType: {
    type: String,
    enum: ['local_subaccount', 'remote_instance', 'edge_relay'],
    default: 'local_subaccount'
  },
  metrics: {
    activeGenerations: { type: Number, default: 0 },
    revenueDay: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100 },
    lastPulse: { type: Date, default: Date.now }
  },
  metadata: {
    platform: { type: String, default: 'Sovereign v3' },
    location: String,
    tags: [String]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

fleetNodeSchema.index({ userId: 1, nodeUri: 1 }, { unique: true });

module.exports = mongoose.model('FleetNode', fleetNodeSchema);
