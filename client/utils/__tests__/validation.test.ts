import {
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateEmail,
  validateURL,
  validateRange,
  validateFileSize,
  validateFileType,
  validateMultiple,
} from '../validation'

// These utilities return a { isValid, error? } ValidationResult (not null|string).
// Validators take their value directly (not curried).

const fileOfSize = (size: number, name = 'test.txt', type = 'text/plain') => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size, writable: false })
  return file
}

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('is valid for a non-empty string', () => {
      expect(validateRequired('test')).toEqual({ isValid: true })
    })
    it('is invalid for empty / whitespace, with a field-named message', () => {
      expect(validateRequired('', 'Name')).toEqual({ isValid: false, error: 'Name is required' })
      expect(validateRequired('   ')).toEqual({ isValid: false, error: 'Field is required' })
    })
  })

  describe('validateMinLength', () => {
    it('is valid at or above the minimum (after trim)', () => {
      expect(validateMinLength('hello', 5).isValid).toBe(true)
      expect(validateMinLength('  hello  ', 5).isValid).toBe(true)
    })
    it('is invalid below the minimum', () => {
      expect(validateMinLength('hi', 5)).toEqual({ isValid: false, error: 'Field must be at least 5 characters' })
    })
  })

  describe('validateMaxLength', () => {
    it('is valid within the maximum', () => {
      expect(validateMaxLength('hello', 10).isValid).toBe(true)
    })
    it('is invalid beyond the maximum', () => {
      expect(validateMaxLength('hello world', 5)).toEqual({ isValid: false, error: 'Field must be no more than 5 characters' })
    })
  })

  describe('validateEmail', () => {
    it('is valid for a well-formed email', () => {
      expect(validateEmail('test@example.com').isValid).toBe(true)
      expect(validateEmail('user.name@example.co.uk').isValid).toBe(true)
    })
    it('is invalid for a malformed email', () => {
      for (const bad of ['invalid', 'invalid@', '@example.com', 'test@']) {
        expect(validateEmail(bad)).toEqual({ isValid: false, error: 'Please enter a valid email address' })
      }
    })
  })

  describe('validateURL', () => {
    it('is valid for a well-formed URL', () => {
      expect(validateURL('https://example.com').isValid).toBe(true)
      expect(validateURL('http://example.com/path').isValid).toBe(true)
    })
    it('is invalid for a malformed URL', () => {
      expect(validateURL('not-a-url')).toEqual({ isValid: false, error: 'Please enter a valid URL' })
    })
  })

  describe('validateRange', () => {
    it('is valid within [min, max] inclusive', () => {
      expect(validateRange(5, 1, 10).isValid).toBe(true)
      expect(validateRange(1, 1, 10).isValid).toBe(true)
      expect(validateRange(10, 1, 10).isValid).toBe(true)
    })
    it('is invalid outside the range', () => {
      expect(validateRange(0, 1, 10)).toEqual({ isValid: false, error: 'Field must be between 1 and 10' })
      expect(validateRange(11, 1, 10).isValid).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('is valid within the byte limit', () => {
      expect(validateFileSize(fileOfSize(512 * 1024), 1024 * 1024).isValid).toBe(true)
    })
    it('is invalid beyond the limit, reporting MB', () => {
      expect(validateFileSize(fileOfSize(2 * 1024 * 1024), 1024 * 1024))
        .toEqual({ isValid: false, error: 'File must be smaller than 1MB' })
    })
  })

  describe('validateFileType', () => {
    it('is valid for an allowed mime type', () => {
      expect(validateFileType(fileOfSize(10, 'a.jpg', 'image/jpeg'), ['image/jpeg', 'image/png']).isValid).toBe(true)
    })
    it('is invalid for a disallowed type', () => {
      expect(validateFileType(fileOfSize(10, 'a.txt', 'text/plain'), ['image/jpeg', 'image/png']))
        .toEqual({ isValid: false, error: 'File must be one of: image/jpeg, image/png' })
    })
  })

  describe('validateMultiple', () => {
    it('is valid when all validators pass', () => {
      expect(validateMultiple('test@example.com', [
        (v) => validateRequired(v),
        (v) => validateMinLength(v, 5),
        (v) => validateEmail(v),
      ])).toEqual({ isValid: true })
    })
    it('returns the first failing validator result', () => {
      const chain = [
        (v: string) => validateRequired(v),
        (v: string) => validateMinLength(v, 5),
        (v: string) => validateEmail(v),
      ]
      expect(validateMultiple('', chain)).toEqual({ isValid: false, error: 'Field is required' })
      expect(validateMultiple('a', chain)).toEqual({ isValid: false, error: 'Field must be at least 5 characters' })
      expect(validateMultiple('short', chain)).toEqual({ isValid: false, error: 'Please enter a valid email address' })
    })
  })
})
