// Frontend error handling utilities

export interface ApiError {
  success: false
  error: string
  code?: string
  details?: any
}

export class AppError extends Error {
  code?: string
  statusCode?: number
  details?: any

  constructor(message: string, code?: string, statusCode?: number, details?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export function handleApiError(error: any): AppError {
  // Network errors
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new AppError(
        'Request timeout. Please check your connection and try again.',
        'TIMEOUT',
        504
      )
    }
    if (error.code === 'ERR_NETWORK') {
      return new AppError(
        'Network error. Please check your internet connection.',
        'NETWORK_ERROR',
        0
      )
    }
    return new AppError(
      'Unable to connect to server. Please try again later.',
      'CONNECTION_ERROR',
      0
    )
  }

  // API errors
  const response = error.response
  const data = response.data as ApiError

  // Handle specific error codes
  switch (data.code) {
    case 'TOKEN_EXPIRED':
    case 'INVALID_TOKEN':
      // Clear token and redirect to login
      localStorage.removeItem('token')
      window.location.href = '/login'
      return new AppError('Session expired. Please login again.', data.code, 401)

    case 'FILE_TOO_LARGE':
      return new AppError(
        data.error || 'File is too large',
        data.code,
        response.status
      )

    case 'RATE_LIMIT_EXCEEDED':
      return new AppError(
        'Too many requests. Please wait a moment and try again.',
        data.code,
        429
      )

    case 'DATABASE_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return new AppError(
        'Service temporarily unavailable. Please try again later.',
        data.code,
        503
      )

    case 'VIDEO_PROCESSING_ERROR':
      return new AppError(
        'Video processing failed. Please ensure the video file is valid.',
        data.code,
        500
      )

    default:
      return new AppError(
        data.error || 'An error occurred',
        data.code || 'UNKNOWN_ERROR',
        response.status,
        data.details
      )
  }
}

export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message
  }
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  if (error.message) {
    return error.message
  }
  return 'An unexpected error occurred'
}

export function getErrorCode(error: any): string | undefined {
  if (error instanceof AppError) {
    return error.code
  }
  if (error.response?.data?.code) {
    return error.response.data.code
  }
  return undefined
}







