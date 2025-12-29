// Frontend Error Handler Utility

export interface ErrorInfo {
  message: string;
  code?: string;
  statusCode?: number;
  fields?: Array<{ field: string; message: string }>;
  retryAfter?: number;
}

export class AppError extends Error {
  statusCode: number;
  code?: string;
  fields?: Array<{ field: string; message: string }>;
  retryAfter?: number;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  fields: Array<{ field: string; message: string }>;

  constructor(message: string, fields: Array<{ field: string; message: string }>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHZ_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = 'Service') {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // Handle axios errors
  if (error.response) {
    const { status, data } = error.response;
    const message = data?.error || data?.message || error.message;

    switch (status) {
      case 400:
        return new ValidationError(
          message,
          data?.fields || []
        );
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 404:
        return new NotFoundError(message);
      case 429:
        return new RateLimitError(
          message,
          data?.retryAfter || error.response.headers['retry-after']
        );
      case 503:
        return new ServiceUnavailableError(message);
      default:
        return new AppError(message, status);
    }
  }

  // Handle network errors
  if (error.request) {
    return new ServiceUnavailableError('Network error. Please check your connection.');
  }

  // Handle other errors
  return new AppError(error.message || 'An unexpected error occurred');
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  const messages: Record<string, string> = {
    VALIDATION_ERROR: 'Please check your input and try again.',
    AUTH_ERROR: 'Please log in to continue.',
    AUTHZ_ERROR: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    RATE_LIMIT: 'Too many requests. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
  };

  return messages[error.code || ''] || error.message;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof AppError && error.statusCode < 500) {
        throw error;
      }

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Error logger for frontend
 */
export function logError(error: Error, context?: Record<string, any>) {
  const errorInfo = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', errorInfo);
  }

  // In production, send to error tracking service (e.g., Sentry)
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { extra: context });
  // }
}






