// safeUpdate — guard against mass-assignment on `Object.assign(doc, req.body)` /
// spread-into-model update patterns.
//
// The attack: a route fetches a document the caller may edit, then copies the
// ENTIRE request body onto it — so an authenticated user can also overwrite
// identity/ownership fields (userId, workspaceId, agencyWorkspaceId, createdBy…)
// and reassign the record to another tenant, or set system/privilege fields.
//
// applySafeUpdates copies body fields onto the doc but NEVER the identity/
// ownership/system fields below (deny-by-default), drops Mongo operator keys
// ($set etc.), and supports an optional explicit allow-list for stricter routes.

// Fields that must never be settable from a request body on an update.
const SENSITIVE_FIELDS = [
  '_id', 'id', '__v',
  'userId', 'ownerId', 'createdBy', 'authorId',
  'workspaceId', 'agencyWorkspaceId', 'clientWorkspaceId', 'teamId', 'organizationId',
  'createdAt', 'updatedAt',
];

/**
 * Assign `body` fields onto `doc`, skipping identity/ownership/system fields
 * (and any in `block`). In allow-list mode (when `allow` is given), only fields
 * in `allow` AND not blocked are copied. Mongo operator keys ($…) are ignored.
 * Mutates and returns `doc`.
 *
 * @param {object} doc   - a Mongoose document (or plain object) to update
 * @param {object} body  - the untrusted request body
 * @param {{allow?: string[], block?: string[]}} [opts]
 * @returns {object} doc
 */
function applySafeUpdates(doc, body, opts = {}) {
  if (!doc || !body || typeof body !== 'object') return doc;
  const blocked = new Set([...SENSITIVE_FIELDS, ...(opts.block || [])]);
  const allowSet = Array.isArray(opts.allow) ? new Set(opts.allow) : null;
  for (const key of Object.keys(body)) {
    if (key.startsWith('$')) continue;           // never Mongo operators
    if (blocked.has(key)) continue;              // never identity/ownership/system
    if (allowSet && !allowSet.has(key)) continue; // allow-list mode
    doc[key] = body[key];
  }
  return doc;
}

module.exports = { applySafeUpdates, SENSITIVE_FIELDS };
