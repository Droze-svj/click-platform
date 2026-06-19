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

module.exports = { validateObjectId, getPagination };
