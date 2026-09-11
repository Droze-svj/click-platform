// Reusable guards for route params + pagination.
//
// Without these, a malformed Mongo id in a path param flows into a Mongoose query
// and throws a CastError → a confusing 500. And unclamped ?limit/?page lets a caller
// request an enormous page that times out the query. Both should be a clean 4xx.

const mongoose = require('mongoose');

/**
 * Middleware factory: 400 if the named path param isn't a valid Mongo ObjectId.
 *   router.get('/:contentId', validateObjectId('contentId'), handler)
 * Dev ids (e.g. 'dev-content-123') are allowed through so the dev flow still works.
 */
function validateObjectId(param = 'id') {
  return (req, res, next) => {
    const value = req.params[param];
    if (value && String(value).startsWith('dev-')) return next(); // dev-mode ids
    if (!mongoose.Types.ObjectId.isValid(String(value))) {
      return res.status(400).json({ success: false, error: `Invalid ${param}` });
    }
    next();
  };
}

/**
 * Middleware factory: if the named path param isn't a Mongo ObjectId, DECLINE the
 * route (`next('route')`) instead of answering it, so matching continues down the
 * chain — including into the next router mounted on the same prefix.
 *
 *   router.get('/:approvalId', objectIdOrSkip('approvalId'), auth, handler)
 *
 * Use this, rather than validateObjectId, when several routers share one mount
 * point and an early `/:id` route would otherwise swallow the STATIC paths a
 * later router defines. Five routers share /api/approvals, and this file's
 * `/:approvalId` routes were consuming POST /bulk/approve, GET /dashboard,
 * GET /delegations and GET /sla-alerts — each resolved with approvalId="bulk",
 * "dashboard", … and never reached its real handler in the later router.
 *
 * Declining is the right verb here: a non-ObjectId segment is not an id this
 * route can serve, so it is not this route's request. If nothing further matches
 * the caller still gets a 404, which is the honest answer.
 *
 * Dev ids ('dev-…') are accepted, matching validateObjectId.
 */
function objectIdOrSkip(param = 'id') {
  return (req, res, next) => {
    const value = String(req.params[param] ?? '');
    if (value.startsWith('dev-')) return next();
    return mongoose.Types.ObjectId.isValid(value) ? next() : next('route');
  };
}

/**
 * Parse + CLAMP pagination from req.query. Returns { page, limit, skip }.
 * Guards against ?page=0/-1 and ?limit=999999 (query timeout / memory blowup).
 */
function getPagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 100000) page = 100000;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { validateObjectId, objectIdOrSkip, getPagination };
