// Command Palette Model
// Pro mode command palette configuration

const mongoose = require('mongoose');

const commandPaletteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Commands
  commands: [{
    id: String,
    label: String,
    description: String,
    category: {
      type: String,
      enum: ['navigation', 'action', 'search', 'settings', 'custom']
    },
    shortcut: String,
    action: String, // e.g., 'navigate:/dashboard', 'action:create-content'
    icon: String,
    keywords: [String], // For search
    enabled: { type: Boolean, default: true },
    order: Number
  }],
  // Settings
  settings: {
    triggerKey: { type: String, default: 'ctrl+k' },
    showOnStartup: { type: Boolean, default: false },
    maxResults: { type: Number, default: 10 },
    fuzzySearch: { type: Boolean, default: true }
  },
  // Recent commands
  recent: [{
    commandId: String,
    usedAt: { type: Date, default: Date.now }
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// userId already has unique: true which creates an index

commandPaletteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// No explicit index({ userId: 1 }) here: `unique: true` on the userId path above
// already builds exactly that index, as the note further up says. Declaring it a
// second time made Mongoose warn "Duplicate schema index on {userId: 1}" on every
// boot and asked MongoDB to maintain a second B-tree over the same key — write
// cost and storage for a lookup the unique index already serves.

module.exports = mongoose.model('CommandPalette', commandPaletteSchema);


