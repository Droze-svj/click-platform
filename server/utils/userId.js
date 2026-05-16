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
 * identifier is needed. Both return a 24-char-hex string suitable for Mongo
 * `userId` queries (the userId field on Mongoose schemas is `ObjectId`).
 * `null` only if the request is unauthenticated.
 *
 * Why always a 24-char hex: Supabase users have UUID ids (`d29c7011-...`)
 * which Mongoose can't cast to ObjectId. Different code paths historically
 * passed either the raw UUID or the md5-hashed ObjectId form, which caused
 * publish writes to land at userId=hash while /api/style-profile reads
 * hit userId=UUID and got "Cast to ObjectId failed". Now every caller
 * gets the SAME hash via `ensureObjectId`, so writes and reads agree.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

function toCanonicalHex(value) {
  if (value == null) return null;
  const str = typeof value === 'string' ? value : value.toString();
  if (!str) return null;
  // Already a valid 24-char-hex ObjectId? Pass through.
  if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) return str.toLowerCase();
  // UUID or other non-conforming string — hash to a stable 24-char hex.
  // This matches the `ensureObjectId` helper in server/utils/devUser.js so
  // a Supabase UUID resolves to the same Mongo userId everywhere.
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 24);
}

function getUserId(user) {
  if (!user || typeof user !== 'object') return null;
  const raw = user._id ?? user.id ?? null;
  return toCanonicalHex(raw);
}

function getUserIdFromReq(req) {
  return getUserId(req?.user);
}

module.exports = { getUserId, getUserIdFromReq, toCanonicalHex };
