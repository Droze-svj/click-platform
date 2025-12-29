// Music Catalog Playlist Model
// Playlists created from catalog tracks

const mongoose = require('mongoose');

const musicCatalogPlaylistSchema = new mongoose.Schema({
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
    trackId: {
      type: String,
      required: true
    },
    source: {
      type: String,
      enum: ['licensed', 'ai_generated', 'user_upload'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    position: {
      type: Number,
      default: 0
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  thumbnailUrl: String,
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

musicCatalogPlaylistSchema.index({ userId: 1, createdAt: -1 });
musicCatalogPlaylistSchema.index({ isPublic: 1 });
musicCatalogPlaylistSchema.index({ tags: 1 });

musicCatalogPlaylistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicCatalogPlaylist', musicCatalogPlaylistSchema);







