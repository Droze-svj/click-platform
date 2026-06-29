// userKey — ONE rule for "what is this user's identity key in MongoDB?".
//
// THE RULE
//   • MongoDB documents key a user by req.user._id  → a deterministic ObjectId.
//   • Supabase tables key a user by req.user.id / req.user.supabaseId → the UUID.
//
// WHY
//   auth.js attaches BOTH forms to every request:
//     req.user._id        = ensureObjectId(supabaseUUID)  → ObjectId (the canon)
//     req.user.id         = supabaseUUID                   → string  (Supabase only)
//     req.user.supabaseId = supabaseUUID                   → string  (Supabase only)
//   The UUID→ObjectId hash (ensureObjectId, MD5) is ONE-WAY, so the ObjectId is
//   the only key every Mongo collection can agree on. Historically some routes
//   wrote Mongo `userId` from req.user.id (the UUID string) and others from
//   req.user._id (the ObjectId) — so a single user's data split across TWO keys.
//   This helper makes the canonical choice unmissable: call mongoUserId(req) for
//   any Mongo read/write; never reach for req.user.id on a Mongo query again.

const { ensureObjectId } = require('./devUser');

/**
 * The canonical MongoDB identity for a request's user: a Mongoose ObjectId.
 * Prefers the already-mapped req.user._id; falls back to hashing whatever id is
 * present (so it is correct even if a caller passes a half-populated req).
 *
 * @param {object} req - Express request with req.user attached by auth.js
 * @returns {import('mongoose').Types.ObjectId|null}
 */
function mongoUserId(req) {
  const u = req && req.user;
  if (!u) return null;
  // req.user._id is already an ObjectId post-auth; ensureObjectId is idempotent
  // on a valid ObjectId and also covers the (rare) case where only id/supabaseId
  // is set, or _id is still a raw UUID string.
  return ensureObjectId(u._id || u.id || u.supabaseId);
}

/**
 * The Supabase identity (UUID string) for a request's user — for Supabase/SQL
 * queries ONLY (e.g. posts.author_id). Never use this as a Mongo userId.
 *
 * @param {object} req
 * @returns {string|null}
 */
function supabaseUserId(req) {
  const u = req && req.user;
  if (!u) return null;
  return u.supabaseId || u.id || (u._id != null ? String(u._id) : null);
}

module.exports = { mongoUserId, supabaseUserId };
