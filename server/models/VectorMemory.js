const mongoose = require('mongoose');

const vectorMemorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  vector: { type: [Number], required: true },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VectorMemory', vectorMemorySchema);
