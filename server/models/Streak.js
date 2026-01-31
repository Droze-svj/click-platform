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

// userId already has unique: true which creates an index

module.exports = mongoose.model('Streak', streakSchema);







