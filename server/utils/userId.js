/**
 * userId.js — canonical resolver for the authenticated user's identifier.
 *
 * Different parts of the codebase historically read `req.user._id`,
 * `req.user.id`, or coerced one of those to a string at the call site. The
 * inconsistency caused a real bug class: ownership checks like
 * `Content.findOne({ _id, userId })` could silently miss records when the
 * comparison hit `_id` (ObjectId) on one side and `id` (string) on the other,
 * returning 404 instead of either matching or failing loudly.
 *
 * Use `getUserId(req.user)` (or `getUserIdFromReq(req)`) anywhere a user
 * identifier is needed. Both return a string suitable for Mongo `userId`
 * queries and for cache keys; `null` only if the request is unauthenticated.
 */

function getUserId(user) {
  if (!user || typeof user !== 'object') return null;
  // Prefer Mongo's _id when present — every authenticated request hydrates
  // the user from Mongo so this is the source of truth. Fall back to id
  // for the few code paths that work with a Supabase-only user shape.
  const raw = user._id ?? user.id ?? null;
  if (raw == null) return null;
  // Mongoose ObjectId → 24-char hex string. Strings pass through.
  return typeof raw === 'string' ? raw : raw.toString();
}

function getUserIdFromReq(req) {
  return getUserId(req?.user);
}

module.exports = { getUserId, getUserIdFromReq };
