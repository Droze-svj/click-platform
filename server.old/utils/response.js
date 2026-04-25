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
  res.status(statusCode).json({
    success: false,
    error: error.message || error
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







