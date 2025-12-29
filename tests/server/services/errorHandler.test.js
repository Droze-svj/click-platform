// Error Handler Tests

const {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError
} = require('../../../server/utils/errorHandler');

describe('Error Handler - Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should include fields in error', () => {
      const fields = [{ field: 'email', reason: 'Invalid format' }];
      const error = new ValidationError('Validation failed', fields);
      expect(error.fields).toEqual(fields);
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(401);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error', () => {
      const error = new AuthorizationError('Access denied');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(403);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error', () => {
      const error = new NotFoundError('Resource not found');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(409);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError('Too many requests');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(429);
      expect(error.isOperational).toBe(true);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error', () => {
      const error = new ServiceUnavailableError('Service temporarily unavailable');
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(503);
      expect(error.isOperational).toBe(true);
    });
  });
});




