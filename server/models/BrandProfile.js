// Brand Profile Model — a creator's saved "Style DNA".
//
// Backs /api/brand. Before this model existed, brandService kept every saved
// profile in a process-memory array shared by the whole server: getProfiles()
// ignored its userId argument entirely and returned that one array, so any
// user's saved profile was visible to every other user, and a restart erased
// them all. This model gives each profile an owner and makes it durable.
//
// The built-in "elite" presets (Apple, MrBeast, ...) are NOT stored here — they
// are read-only constants in brandService, returned alongside a user's own
// profiles. Only user-created profiles become documents.

const mongoose = require('mongoose');

// The tunable style vector the editor and AI Director read. Kept as an explicit
// sub-schema (rather than Mixed) so a malformed client payload can't write
// arbitrary keys onto the document.
const brandDnaSchema = new mongoose.Schema({
  // Cuts per minute — the pacing signal.
  cpm: { type: Number, default: 6 },
  visualDensity: { type: Number, default: 4 },
  // Affinity weights keyed by aesthetic tag, e.g. { minimalist: 0.9 }.
  assetAffinity: { type: Map, of: Number, default: () => new Map() },
  // dB of ducking applied under voice.
  audioDuckingPreference: { type: Number, default: -12 },
  foleyFrequency: { type: Number, default: 2 },
  preferredTransitions: { type: [String], default: [] },
  preferredFonts: { type: [String], default: [] },
  theme: { type: String, default: 'cinematic' },
  // 0-100: how readily evolveDNA() lets accepted edits move the profile.
  driftSensitivity: { type: Number, default: 20, min: 0, max: 100 },
  preferredAssetFolders: { type: [String], default: [] },
  preferredMusicGenres: { type: [String], default: [] },
  // 0-5 index derived from real accepted-style movement by evolveDNA().
  sentimentDrift: { type: Number, default: 0 },
}, { _id: false });

const brandProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  isAiOptimized: { type: Boolean, default: false },
  dna: { type: brandDnaSchema, default: () => ({}) },
  lastTrained: { type: Date, default: Date.now },
}, { timestamps: true });

// The list endpoint reads a user's profiles newest-first.
brandProfileSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('BrandProfile', brandProfileSchema);
