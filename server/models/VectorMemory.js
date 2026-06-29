const mongoose = require('mongoose');

const vectorMemorySchema = new mongoose.Schema({
  // Identity. Kept as String (see Content.js note); writes/reads go through the
  // canonical id (server/utils/userKey.js → req.user._id) so it's always hex.
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  vector: { type: [Number], required: true },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VectorMemory', vectorMemorySchema);
