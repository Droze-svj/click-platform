// Caption model — captions/transcripts live OFF the Content document.
//
// Embedding `captions.words` (Whisper word-level timing) + per-language
// `captions.translations` on Content meant a single long/multi-language video
// could grow the Content doc toward MongoDB's hard 16MB BSON limit (a 3h podcast
// is ~2MB of words PER language). This collection holds one document per
// (contentId, language) instead, so each transcript/translation scales
// independently and Content stays small.
//
// Reads/writes go through services/captionStore.js, which falls back to the
// legacy embedded Content.captions for content that hasn't been migrated yet —
// so this is backward compatible with zero downtime.

const mongoose = require('mongoose');

const captionSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true,
  },
  // Lowercased BCP-47 language code (e.g. 'en', 'es', 'zh-hans').
  language: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  // True for the original transcription (the one that carries word-level timing);
  // false for translations (segment-level only).
  isSource: {
    type: Boolean,
    default: true,
  },
  text: { type: String, default: '' },
  format: { type: String, default: 'srt' },
  // Sentence-level cues: [{ start, end, text }, ...]
  segments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // Whisper word-level timing: [{ word, start, end, confidence }, ...] (source only).
  words: { type: [mongoose.Schema.Types.Mixed], default: [] },
  // Pre-formatted SRT/VTT/SSA string.
  formatted: { type: String, default: '' },
  generatedAt: { type: Date },
  translatedAt: { type: Date },
}, { timestamps: true });

// One caption document per content + language. Upserts key on this.
captionSchema.index({ contentId: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Caption', captionSchema);
