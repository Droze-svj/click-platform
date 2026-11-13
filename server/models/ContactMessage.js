const mongoose = require('mongoose');

// Messages sent from the public contact form. Click has no working inbox (the
// clickapp.io addresses don't exist and no email provider is configured), so
// these are stored and listed on the admin dashboard.
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  topic: { type: String, enum: ['support', 'billing', 'privacy', 'sales', 'other'], default: 'other' },
  message: { type: String, required: true, maxlength: 5000 },
  // Set when the sender is signed in, so erasure removes their messages too.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  status: { type: String, enum: ['new', 'handled'], default: 'new', index: true },
}, { timestamps: true });

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
