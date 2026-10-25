// An asynchronous provider dubbing job (ElevenLabs /v1/dubbing).
//
// The provider's audio endpoint needs our API key, so the browser can never play
// it directly. The job row binds the provider id to its owner + language so the
// status poll can (1) refuse other users' jobs and (2) copy the finished audio
// into our own /uploads exactly once, returning a same-origin signed URL.

const mongoose = require('mongoose');

const dubbingJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
  targetLanguage: { type: String, required: true },
  provider: { type: String, enum: ['elevenlabs'], default: 'elevenlabs' },
  status: { type: String, enum: ['processing', 'completed', 'error'], default: 'processing' },
  // Unsigned "/uploads/dubs/<random>.mp3" (signed at the response boundary).
  audioUrl: { type: String, default: null },
  error: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.models.DubbingJob || mongoose.model('DubbingJob', dubbingJobSchema);
