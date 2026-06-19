// Standardized API response utility
//
// NOTE:
// This project historically used TWO different calling conventions for sendSuccess:
// 1) sendSuccess(res, data, message?, statusCode?)
// 2) sendSuccess(res, message, statusCode, data?)
//
// A large portion of routes use (2). If we only support (1), Express ends up doing:
//   res.status(<object>)
// and throws: RangeError [ERR_HTTP_INVALID_STATUS_CODE]
//
// To keep the API stable and stop widespread 500s, we accept both shapes here.
const sendSuccess = (res, arg1, arg2 = 'Success', arg3 = 200) => {
  let data;
  let message;
  let statusCode;

  // Convention (2): (message, statusCode, data?)
  if (typeof arg1 === 'string') {
    message = arg1;
    statusCode = typeof arg2 === 'number' ? arg2 : 200;
    data = typeof arg2 === 'number' ? arg3 : arg2;
  } else {
    // Convention (1): (data, message?, statusCode?)
    data = arg1;
    message = typeof arg2 === 'string' ? arg2 : 'Success';
    statusCode = typeof arg3 === 'number' ? arg3 : 200;

    // Edge: sendSuccess(res, data, 201)
    if (typeof arg2 === 'number') {
      statusCode = arg2;
      message = typeof arg3 === 'string' ? arg3 : 'Success';
    }
  }

  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendError = (res, error, statusCode = 400) => {
  const raw = (error && error.message) || error;
  // Correct a hand-rolled 5xx that's really a client/precondition error. Many
  // handlers do `sendError(res, err.message, 500)` for a missing record, an
  // expired token, an unbuilt feature, or a dependency that's off — all of which
  // should be 4xx/501/503, not a 500 that trips alerting. Mirrors the central
  // errorHandler mapping. Only downgrades from 5xx; never escalates. Also honors
  // an explicit statusCode carried on a passed Error object.
  let code = (error && error.statusCode) || statusCode;
  if (code >= 500 && typeof raw === 'string') {
    const m = raw.toLowerCase();
    if (/invalid or expired token|invalid token|expired token/.test(m)) code = 401;
    else if (/\b(not found|does not exist|no longer exists)\b/.test(m)) code = 404;
    else if (/access denied|not authorized|unauthorized|forbidden|permission denied/.test(m)) code = 403;
    else if (/not implemented|not available yet|coming soon/.test(m)) code = 501;
    else if (/not configured|not enabled|unavailable/.test(m)) code = 503;
    else if (/already exists|duplicate key|e11000/.test(m)) code = 409;
  }
  // Don't leak internal error detail (Mongoose/driver text, stack hints) to
  // clients on server errors in production. Client errors (4xx) keep their
  // message since they're intentional/validation feedback.
  const isServerError = code >= 500;
  const message = (process.env.NODE_ENV === 'production' && isServerError)
    ? 'An unexpected error occurred. Please try again.'
    : raw;
  res.status(code).json({
    success: false,
    error: message
  });
};

const sendPaginated = (res, data, pagination, message = 'Success') => {
  res.json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit)
    }
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated
};







