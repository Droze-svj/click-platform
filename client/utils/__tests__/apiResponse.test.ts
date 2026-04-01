import { extractApiData, extractApiError, isApiSuccess } from '../apiResponse'

describe('API Response Utilities', () => {
  describe('extractApiData', () => {
    it('should extract data from standard API response format', () => {
      const response = {
        data: {
          success: true,
          data: { id: '123', name: 'Test' }
        }
      }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should return null when data is missing', () => {
      const response = {
        data: {
          success: true,
          data: null
        }
      }
      expect(extractApiData(response)).toBeNull()
    })

    it('should handle direct data format (backward compatibility)', () => {
      const response = {
        success: true,
        data: { id: '123', name: 'Test' }
      }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should handle already extracted data', () => {
      const response = {
        success: true,
        data: { id: '123' }
      }
      expect(extractApiData(response.data)).toEqual({ id: '123' })
    })

    it('should handle direct data object', () => {
      const response = { id: '123', name: 'Test' }
      expect(extractApiData(response)).toEqual({ id: '123', name: 'Test' })
    })

    it('should handle array data', () => {
      const response = {
        data: {
          success: true,
          data: [{ id: '1' }, { id: '2' }]
        }
      }
      expect(extractApiData(response)).toEqual([{ id: '1' }, { id: '2' }])
    })
  })

  describe('extractApiError', () => {
    it('should extract error from Axios error response', () => {
      const error = {
        response: {
          data: {
            error: 'Custom error message'
          }
        }
      }
      expect(extractApiError(error).message).toBe('Custom error message')
    })

    it('should extract message when error is missing', () => {
      const error = {
        response: {
          data: {
            message: 'Error message'
          }
        }
      }
      expect(extractApiError(error).message).toBe('Error message')
    })

    it('should fall back to error.message', () => {
      const error = {
        message: 'Fallback message'
      }
      expect(extractApiError(error).message).toBe('Fallback message')
    })

    it('should handle Error instance', () => {
      const error = new Error('Test error')
      expect(extractApiError(error).message).toBe('Test error')
    })

    it('should handle string error', () => {
      expect(extractApiError('String error').message).toBe('String error')
    })

    it('should handle error with data property directly', () => {
      const error = {
        data: {
          error: 'Direct error'
        }
      }
      expect(extractApiError(error).message).toBe('Direct error')
    })

    it('should return default message for unknown error format', () => {
      expect(extractApiError({}).message).toBe('An error occurred')
      expect(extractApiError(null).message).toBe('An error occurred')
    })
  })

  describe('isApiSuccess', () => {
    it('should return true for successful response with success flag', () => {
      const response = {
        data: {
          success: true
        }
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should return false for failed response', () => {
      const response = {
        data: {
          success: false
        }
      }
      expect(isApiSuccess(response)).toBe(false)
    })

    it('should handle response with success property directly', () => {
      const response = {
        success: true
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should assume success for valid status code', () => {
      const response = {
        status: 200
      }
      expect(isApiSuccess(response)).toBe(true)
    })

    it('should assume failure for error status code', () => {
      const response = {
        status: 400
      }
      expect(isApiSuccess(response)).toBe(false)
    })

    it('should handle response without status or success', () => {
      const response = {}
      expect(isApiSuccess(response)).toBe(true)
    })
  })
})



