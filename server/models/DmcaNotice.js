const mongoose = require('mongoose');

/**
 * DMCA notices and counter-notices submitted via /api/dmca/{notice|counter}.
 * Indexed by status for the moderation dashboard. Repeat infringers are
 * detected by aggregating notices that share `accusedUserId`.
 */
const dmcaSchema = new mongoose.Schema(
  {
    /** 'notice' = takedown under §512(c); 'counter' = counter-notice under §512(g). */
    kind: {
      type: String,
      enum: ['notice', 'counter'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['received', 'under-review', 'action-taken', 'rejected', 'withdrawn'],
      default: 'received',
      index: true,
    },
    /** Free-text reference for cross-linking a counter-notice to the original takedown. */
    relatedNoticeId: String,
    fullName: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: String,
    address: { type: String, required: true },
    rightsHolder: String,
    workDescription: String,
    infringingUrl: String,
    removedContent: String,
    counterReason: String,
    signature: { type: String, required: true },
    /** Sworn-statement checkboxes. */
    sworn: { type: Boolean, required: true },
    goodFaith: { type: Boolean, default: false },
    /** Counter-notice §512(g) jurisdictional consent. */
    consent: { type: Boolean, default: false },
    /** Optional link to user being accused — populated when the URL maps to one. */
    accusedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    submittedAt: { type: Date, default: Date.now, index: true },
    actedAt: Date,
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

dmcaSchema.index({ status: 1, kind: 1, submittedAt: -1 });

module.exports = mongoose.models.DmcaNotice || mongoose.model('DmcaNotice', dmcaSchema);
