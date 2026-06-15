/**
 * Dev user utilities – centralized handling for development/mock users.
 * Ensures consistent detection across auth, routes, and services.
 *
 * Dev users get stable MongoDB ObjectIds so Workflow, Team, and other
 * Mongoose models accept userId without CastError.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Ensure a string ID is a valid Mongoose ObjectId.
 * If it's a UUID, hashes it to a deterministic 24-character hex string.
 * This prevents CastErrors when using Supabase UUIDs with Mongoose models.
 */
function ensureObjectId(idStr) {
  if (!idStr) return null;
  const str = String(idStr);
  if (mongoose.Types.ObjectId.isValid(str)) return new mongoose.Types.ObjectId(str);
  // Hash UUID to deterministic 24-char hex
  const hash = crypto.createHash('md5').update(str).digest('hex').substring(0, 24);
  return new mongoose.Types.ObjectId(hash);
}

/** Stable ObjectIds for dev users – single source of truth */
const DEV_USER_IDS = {
  'dev-user-123': '000000000000000000000001',
  'test-user-456': '000000000000000000000002',
};

/** ObjectId instances for auth middleware */
const DEV_USER_OBJECTIDS = Object.fromEntries(
  Object.entries(DEV_USER_IDS).map(([k, v]) => [k, new mongoose.Types.ObjectId(v)])
);

/** String forms for isDevUser checks */
const DEV_USER_OBJECTID_STRINGS = Object.values(DEV_USER_IDS);

/**
 * Check if a user or userId is a dev/mock user.
 * Handles both string IDs (dev-user-123) and ObjectId (000...001).
 */
function isDevUser(userOrUserId) {
  if (!userOrUserId) return false;
  const id = typeof userOrUserId === 'object' && userOrUserId?._id != null
    ? userOrUserId._id
    : userOrUserId;
  const str = id && typeof id === 'object' && id.toString ? id.toString() : String(id);
  return (
    str.startsWith('dev-') ||
    str.startsWith('test-') ||
    str === 'dev-user-123' ||
    DEV_USER_OBJECTID_STRINGS.includes(str)
  );
}

/**
 * Get MongoDB ObjectId for a dev user string, or null if not a dev user.
 */
function getDevUserObjectId(devUserId) {
  return DEV_USER_OBJECTIDS[devUserId] ?? null;
}

/**
 * Compute allowDevMode from request (reusable in routes).
 *
 * Hard rule: ONLY a local `development` env may use the dev bypass. The
 * localhost signals below come from the Host / Referer / X-Forwarded-For
 * headers, which are ALL attacker-controllable — so on ANY deployed env
 * (production, staging, preview, or NODE_ENV unset on a host) they'd be a
 * trivial Host/XFF-spoof path to an unauthenticated mock-admin session.
 * `production`, `test`, `staging`, and unset therefore ALL return false; the
 * header heuristic only runs (as a second layer) when NODE_ENV==='development'.
 */
function allowDevMode(req) {
  if (process.env.NODE_ENV !== 'development') return false;

  const host = req?.headers?.host || req?.headers?.['x-forwarded-host'] || '';
  const referer = req?.headers?.referer || req?.headers?.origin || '';
  const forwardedFor = req?.headers?.['x-forwarded-for'] || '';
  const isLocalhost =
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    referer.includes('localhost') ||
    referer.includes('127.0.0.1') ||
    (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));
  return isLocalhost;
}

module.exports = {
  DEV_USER_IDS,
  DEV_USER_OBJECTIDS,
  DEV_USER_OBJECTID_STRINGS,
  isDevUser,
  getDevUserObjectId,
  allowDevMode,
  ensureObjectId,
};
