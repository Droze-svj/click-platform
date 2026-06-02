/**
 * Draft — server-side autosave snapshot for any editor surface.
 *
 * Stores the user's in-progress edit state so closing the browser, losing
 * connectivity, or a dyno restart never sends them back to a blank canvas.
 * One draft per (userId, scope, scopeId) — a userId+'video'+contentId pair
 * has at most one draft at a time, overwritten on each autosave.
 *
 * Scopes:
 *   - 'video'   — video editor RenderTree (matches client/lib/render/overlaySchema)
 *   - 'script'  — script-writer editor
 *   - 'post'    — posts/create composer
 *
 * Fields:
 *   - state    — opaque JSON snapshot of the editor state. Schema is
 *                owned by the client; the server treats it as a blob.
 *   - revision — monotonically increasing counter (last-writer-wins so
 *                a slow tab can't clobber a faster one with stale data).
 *   - lastSavedAt — for the "Saved 2s ago" UI badge.
 *
 * TTL: drafts auto-expire 30 days after last save. If a user vanishes
 * mid-edit and never comes back, we don't keep their half-finished work
 * forever.
 */

const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scope: {
      type: String,
      required: true,
      enum: ['video', 'script', 'post'],
      index: true,
    },
    /** Stable id of the thing being edited (e.g. contentId, scriptId). */
    scopeId: {
      type: String,
      required: true,
    },
    /** Opaque snapshot — schema owned by the client. */
    state: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    /** Monotonic counter; server rejects stale revisions. */
    revision: {
      type: Number,
      default: 0,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

draftSchema.index({ userId: 1, scope: 1, scopeId: 1 }, { unique: true });

// 30-day TTL on lastSavedAt — stale drafts get garbage-collected so the
// collection doesn't grow without bound.
draftSchema.index({ lastSavedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Draft', draftSchema);
