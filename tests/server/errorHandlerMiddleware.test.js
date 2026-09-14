const { errorHandler, notFound } = require('../../server/middleware/errorHandler');

describe('errorHandler middleware', () => {
  let req;
  let res;
  let next;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    req = {
      originalUrl: '/api/test',
      method: 'POST',
      ip: '127.0.0.1',
      body: {},
      query: {},
      user: { _id: 'user123' },
      get: jest.fn().mockReturnValue('jest-agent'),
    };
    res = {
      statusCode: null,
      headersSent: false,
      status: jest.fn().mockImplementation(function (code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn().mockImplementation(function (data) {
        this.jsonData = data;
        return this;
      }),
    };
    next = jest.fn();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('handles body-parser SyntaxError for malformed JSON as 400 Bad Request', () => {
    const err = new SyntaxError('Unexpected token x in JSON at position 1');
    err.status = 400;
    err.body = '{ x }';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Malformed JSON in request body',
        code: 'BAD_REQUEST',
      })
    );
  });

  it('handles body-parser entity.parse.failed as 400 Bad Request', () => {
    const err = new Error('invalid json');
    err.type = 'entity.parse.failed';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Malformed JSON in request body',
        code: 'BAD_REQUEST',
      })
    );
  });

  it('handles URIError malformed URI sequence as 400 Bad Request', () => {
    const err = new URIError('URI malformed');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to decode URL parameter: Malformed URI sequence',
        code: 'INVALID_URI',
      })
    );
  });

  it('handles body-parser entity.too.large as 413 Payload Too Large', () => {
    const err = new Error('request entity too large');
    err.type = 'entity.too.large';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Payload too large',
        code: 'PAYLOAD_TOO_LARGE',
      })
    );
  });

  it('handles CORS rejection as 403 Forbidden', () => {
    const err = new Error('Not allowed by CORS');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'CORS request rejected: Origin not allowed',
        code: 'CORS_ERROR',
      })
    );
  });

  it('handles CSRF token mismatch as 403 Forbidden', () => {
    const err = new Error('invalid csrf token');
    err.code = 'EBADCSRFTOKEN';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid or missing CSRF token',
        code: 'CSRF_ERROR',
      })
    );
  });

  it('handles Mongoose ValidationError with field details', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      title: { path: 'title', message: 'Title is required' },
    };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation Error',
      details: [{ field: 'title', message: 'Title is required' }],
    });
  });

  it('handles Mongoose duplicate key error (11000) as 409 Conflict', () => {
    const err = new Error('E11000 duplicate key error');
    err.code = 11000;
    err.keyPattern = { email: 1 };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'email already exists',
      field: 'email',
    });
  });

  it('handles Mongoose CastError as 400 Bad Request', () => {
    const err = new Error('Cast to ObjectId failed');
    err.name = 'CastError';
    err.path = '_id';
    err.value = 'invalid-id';

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid _id: invalid-id',
    });
  });

  it('preserves client error messages in production mode', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Project name cannot be empty');
    err.statusCode = 400;
    err.isOperational = true;

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Project name cannot be empty',
        code: 'BAD_REQUEST',
      })
    );
  });

  it('masks unhandled 500 errors in production mode to prevent information leakage', () => {
    process.env.NODE_ENV = 'production';
    const err = new TypeError('Cannot read property undefined of null');

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_ERROR',
      })
    );
    expect(res.jsonData.stack).toBeUndefined();
  });

  it('handles notFound handler cleanly returning 404', () => {
    req.originalUrl = '/api/non-existent-endpoint';
    notFound(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Route /api/non-existent-endpoint not found',
    });
  });
});
