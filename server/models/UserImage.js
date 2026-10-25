// A still image a user uploaded to their editor asset library.
//
// The bytes live in storage (local /uploads/user-images/<random>.<ext> or the
// configured cloud bucket); this row is the owner's index of them so the
// library can list them again on another device. URLs are signed at the
// response boundary (signMediaUrls), never stored signed.

const mongoose = require('mongoose');

const userImageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  title: { type: String, required: true, maxlength: 200 },
  file: {
    url: { type: String, required: true },
    filename: String,
    size: Number,
    mimeType: String,
  },
}, { timestamps: true });

userImageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.UserImage || mongoose.model('UserImage', userImageSchema);
