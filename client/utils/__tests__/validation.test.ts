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

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('should return null for non-empty string', () => {
      expect(validateRequired('test')).toBeNull()
    })

    it('should return error for empty string', () => {
      expect(validateRequired('')).toBe('This field is required.')
    })

    it('should return error for whitespace-only string', () => {
      expect(validateRequired('   ')).toBe('This field is required.')
    })

    it('should return error for null', () => {
      expect(validateRequired(null)).toBe('This field is required.')
    })

    it('should return error for undefined', () => {
      expect(validateRequired(undefined)).toBe('This field is required.')
    })
  })

  describe('validateMinLength', () => {
    it('should return null for string meeting minimum length', () => {
      const validator = validateMinLength(5)
      expect(validator('hello')).toBeNull()
      expect(validator('hello world')).toBeNull()
    })

    it('should return error for string below minimum length', () => {
      const validator = validateMinLength(5)
      expect(validator('hi')).toBe('Must be at least 5 characters long.')
    })

    it('should trim whitespace before validating', () => {
      const validator = validateMinLength(5)
      expect(validator('  hello  ')).toBeNull()
    })
  })

  describe('validateMaxLength', () => {
    it('should return null for string within maximum length', () => {
      const validator = validateMaxLength(10)
      expect(validator('hello')).toBeNull()
      expect(validator('1234567890')).toBeNull()
    })

    it('should return error for string exceeding maximum length', () => {
      const validator = validateMaxLength(5)
      expect(validator('hello world')).toBe('Must be at most 5 characters long.')
    })

    it('should trim whitespace before validating', () => {
      const validator = validateMaxLength(5)
      expect(validator('  hi  ')).toBeNull()
    })
  })

  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      expect(validateEmail('test@example.com')).toBeNull()
      expect(validateEmail('user.name@example.co.uk')).toBeNull()
    })

    it('should return error for invalid email', () => {
      expect(validateEmail('invalid')).toBe('Invalid email address.')
      expect(validateEmail('invalid@')).toBe('Invalid email address.')
      expect(validateEmail('@example.com')).toBe('Invalid email address.')
      expect(validateEmail('test@')).toBe('Invalid email address.')
    })

    it('should return null for empty string (allowing optional fields)', () => {
      expect(validateEmail('')).toBeNull()
    })
  })

  describe('validateURL', () => {
    it('should return null for valid URL', () => {
      expect(validateURL('https://example.com')).toBeNull()
      expect(validateURL('http://example.com')).toBeNull()
      expect(validateURL('https://example.com/path')).toBeNull()
    })

    it('should return error for invalid URL', () => {
      expect(validateURL('not-a-url')).toBe('Invalid URL format.')
      expect(validateURL('example.com')).toBe('Invalid URL format.')
    })

    it('should return null for empty string (allowing optional fields)', () => {
      expect(validateURL('')).toBeNull()
    })
  })

  describe('validateRange', () => {
    it('should return null for number within range', () => {
      const validator = validateRange(1, 10)
      expect(validator(5)).toBeNull()
      expect(validator(1)).toBeNull()
      expect(validator(10)).toBeNull()
    })

    it('should return error for number outside range', () => {
      const validator = validateRange(1, 10)
      expect(validator(0)).toBe('Must be between 1 and 10.')
      expect(validator(11)).toBe('Must be between 1 and 10.')
    })

    it('should handle string numbers', () => {
      const validator = validateRange(1, 10)
      expect(validator('5')).toBeNull()
      expect(validator('15')).toBe('Must be between 1 and 10.')
    })
  })

  describe('validateFileSize', () => {
    it('should return null for file within size limit', () => {
      const validator = validateFileSize(1024 * 1024) // 1MB
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 512 * 1024, writable: false })
      expect(validator(file)).toBeNull()
    })

    it('should return error for file exceeding size limit', () => {
      const validator = validateFileSize(1024 * 1024) // 1MB
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024, writable: false })
      expect(validator(file)).toBe('File size must be less than 1 MB.')
    })

    it('should return null for non-file values', () => {
      const validator = validateFileSize(1024)
      expect(validator('not-a-file')).toBeNull()
    })
  })

  describe('validateFileType', () => {
    it('should return null for allowed file type', () => {
      const validator = validateFileType(['image/jpeg', 'image/png'])
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validator(file)).toBeNull()
    })

    it('should return error for disallowed file type', () => {
      const validator = validateFileType(['image/jpeg', 'image/png'])
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      expect(validator(file)).toBe('Invalid file type. Allowed types: image/jpeg, image/png.')
    })

    it('should return null for non-file values', () => {
      const validator = validateFileType(['image/jpeg'])
      expect(validator('not-a-file')).toBeNull()
    })
  })

  describe('validateMultiple', () => {
    it('should return null when all validators pass', () => {
      const validator = validateMultiple([
        validateRequired,
        validateMinLength(5),
        validateEmail,
      ])
      expect(validator('test@example.com')).toBeNull()
    })

    it('should return first error when validators fail', () => {
      const validator = validateMultiple([
        validateRequired,
        validateMinLength(5),
        validateEmail,
      ])
      expect(validator('')).toBe('This field is required.')
      expect(validator('a')).toBe('Must be at least 5 characters long.')
      expect(validator('short')).toBe('Invalid email address.')
    })
  })
})



