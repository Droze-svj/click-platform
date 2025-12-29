// Music Playlist Model
// User playlists for licensed tracks

const mongoose = require('mongoose');

const musicPlaylistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  tracks: [{
    licenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MusicLicense',
      required: true
    },
    order: {
      type: Number,
      default: 0
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

musicPlaylistSchema.index({ userId: 1, createdAt: -1 });
musicPlaylistSchema.index({ isPublic: 1 });

musicPlaylistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicPlaylist', musicPlaylistSchema);







