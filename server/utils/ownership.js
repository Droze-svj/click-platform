/**
 * ownership.js — single helper for "does this user own this content?"
 *
 * Audits found that several mutating routes accept a `contentId`/`videoId`
 * from the body or query but never verify the requester owns it (classic
 * IDOR). The existing pattern in `routes/video/scenes-workflow.js` works but
 * is copy-pasted at every call site; this helper centralises it so future
 * routes can do `await assertOwnership(req, contentId)` without rebuilding
 * the same Mongo + dev-store lookup every time.
 *
 * Behaviour:
 *   - In dev mode (isDevUser), ownership is implicit (single shared store) —
 *     returns the resolved content without checking. Production behaviour is
 *     unaffected.
 *   - For real users, fetches via `resolveContent` (which already handles
 *     dev/Mongo split) and compares `content.userId.toString()` to
 *     `req.user._id.toString()`. Mismatches throw a structured 403.
 *   - When `contentId` is missing or the content isn't found, the caller
 *     receives a 400 / 404 with a clear shape.
 *
 * Returns the resolved content on success so callers don't need to re-fetch.
 */

const { resolveContent } = require('./devStore');
const { isDevUser } = require('./devUser');

class OwnershipError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'OwnershipError';
  }
}

/**
 * Verify the requester owns the given content. Throws an OwnershipError
 * with a `status` (400/403/404) on failure; returns the content on success.
 *
 *   try {
 *     const content = await assertOwnership(req, contentId);
 *     // ... use content
 *   } catch (e) {
 *     if (e instanceof OwnershipError) return res.status(e.status).json({ success: false, error: e.message });
 *     throw e;
 *   }
 */
async function assertOwnership(req, contentId) {
  if (!contentId) throw new OwnershipError(400, 'contentId is required');
  const content = await resolveContent(contentId);
  if (!content) throw new OwnershipError(404, 'Content not found');

  // Dev users bypass — the dev store is single-tenant and tests assume free
  // access. Real users must match.
  if (isDevUser(req.user)) return content;

  const userId = req.user?._id || req.user?.id;
  if (!userId) throw new OwnershipError(401, 'Unauthenticated');

  const ownerId = content.userId?.toString?.() ?? String(content.userId);
  const requesterId = userId.toString?.() ?? String(userId);
  if (ownerId !== requesterId) {
    throw new OwnershipError(403, 'You do not have access to this content');
  }
  return content;
}

/**
 * Express helper that wraps assertOwnership + send-error in one call. Returns
 * the content on success, or sends the error response and returns null. The
 * caller checks for null and aborts.
 *
 *   const content = await guardOwnership(req, res, videoId);
 *   if (!content) return;
 *   // ... use content
 */
async function guardOwnership(req, res, contentId) {
  try {
    return await assertOwnership(req, contentId);
  } catch (e) {
    if (e instanceof OwnershipError) {
      res.status(e.status).json({ success: false, error: e.message });
      return null;
    }
    throw e;
  }
}

module.exports = { assertOwnership, guardOwnership, OwnershipError };
