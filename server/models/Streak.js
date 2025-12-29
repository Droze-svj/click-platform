// User streak tracking model

const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActivityDate: {
    type: Date
  },
  streakHistory: [{
    startDate: Date,
    endDate: Date,
    days: Number
  }]
});

streakSchema.index({ userId: 1 });

module.exports = mongoose.model('Streak', streakSchema);







