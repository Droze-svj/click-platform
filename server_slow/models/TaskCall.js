// In-task video/audio call room for low-latency collaboration

const mongoose = require('mongoose');
const crypto = require('crypto');

const taskCallSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  roomId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
  },
  startedBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  }
});

taskCallSchema.index({ taskId: 1, endedAt: 1 });

module.exports = mongoose.model('TaskCall', taskCallSchema);
