// Music Favorite Model
// User favorites for licensed tracks

const mongoose = require('mongoose');

const musicFavoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  licenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MusicLicense',
    required: true,
    index: true
  },
  notes: String, // User notes about why they favorited
  tags: [String], // User-defined tags
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure user can't favorite same track twice
musicFavoriteSchema.index({ userId: 1, licenseId: 1 }, { unique: true });

module.exports = mongoose.model('MusicFavorite', musicFavoriteSchema);







