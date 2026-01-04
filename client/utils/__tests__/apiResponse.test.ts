import { extractApiData, extractApiError, isApiSuccess } from '../apiResponse'

describe('API Response Utilities', () => {
  describe('extractApiData', () => {
    it('should extract data from standard API response format', () => {
      const response = {
          success: true,
        },
      }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should return null when data is missing', () => {
      const response = {
          success: true,
        },
      }
      expect(extractApiData(response)).toBeNull()
    })

    it('should handle direct data format (backward compatibility)', () => {
      const response = {
      }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should handle already extracted data', () => {
      const response = {
        success: true,
      }
      expect(extractApiData(response)).toEqual({ id: '123' })
    })

    it('should handle direct data object', () => {
      const response = { id: '123', name: 'Test' }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should handle array data', () => {
      const response = {
          success: true,
        },
      }
      expect(extractApiData(response)).toEqual([{ id: '1' }, { id: '2' }])
    })
  })

  describe('extractApiError', () => {
    it('should extract error from Axios error response', () => {
      const error = {
        response: {
            error: 'Custom error message',
          },
        },
      }
      expect(extractApiError(error)).toBe('Custom error message')
    })

    it('should extract message when error is missing', () => {
      const error = {
        response: {
          },
        },
      }
      expect(extractApiError(error)).toBe('Error message')
    })

    it('should fall back to error.message', () => {
      const error = {
        response: {
        },
      }
      expect(extractApiError(error)).toBe('Fallback message')
    })

    it('should handle Error instance', () => {
      const error = new Error('Test error')
      expect(extractApiError(error)).toBe('Test error')
    })

    it('should handle string error', () => {
      expect(extractApiError('String error')).toBe('String error')
    })

    it('should handle error with data property directly', () => {
      const error = {
          error: 'Direct error',
        },
      }
      expect(extractApiError(error)).toBe('Direct error')
    })

    it('should return default message for unknown error format', () => {
      expect(extractApiError({})).toBe('An error occurred')
      expect(extractApiError(null)).toBe('An error occurred')
    })
  })

  describe('isApiSuccess', () => {
    it('should return true for successful response with success flag', () => {
      const response = {
          success: true,
        },
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should return false for failed response', () => {
      const response = {
          success: false,
        },
      }
      expect(isApiSuccess(response)).toBe(false)
    })

    it('should handle response with success property directly', () => {
      const response = {
        success: true,
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should assume success for valid status code', () => {
      const response = {
        status: 200,
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should assume failure for error status code', () => {
      const response = {
        status: 400,
      }
      expect(isApiSuccess(response)).toBe(false)
    })

    it('should handle response without status or success', () => {
      const response = {}
      expect(isApiSuccess(response)).toBe(true)
    })
  })
})



