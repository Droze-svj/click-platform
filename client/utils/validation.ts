/**
 * Validation utilities for form inputs
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validates that a string is not empty (after trimming)
 */
export function validateRequired(value: string, fieldName: string = 'Field'): ValidationResult {
  if (!value || value.trim().length === 0) {
    return {
      isValid: false,
      error: `${fieldName} is required`
    }
  }
  return { isValid: true }
}

/**
 * Validates minimum length
 */
export function validateMinLength(
  value: string,
  minLength: number,
  fieldName: string = 'Field'
): ValidationResult {
  if (value.trim().length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} characters`
    }
  }
  return { isValid: true }
}

/**
 * Validates maximum length
 */
export function validateMaxLength(
  value: string,
  maxLength: number,
  fieldName: string = 'Field'
): ValidationResult {
  if (value.trim().length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} must be no more than ${maxLength} characters`
    }
  }
  return { isValid: true }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address'
    }
  }
  return { isValid: true }
}

/**
 * Validates URL format
 */
export function validateURL(url: string): ValidationResult {
  try {
    new URL(url)
    return { isValid: true }
  } catch {
    return {
      isValid: false,
      error: 'Please enter a valid URL'
    }
  }
}

/**
 * Validates that a number is within a range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'Field'
): ValidationResult {
  if (value < min || value > max) {
    return {
      isValid: false,
      error: `${fieldName} must be between ${min} and ${max}`
    }
  }
  return { isValid: true }
}

/**
 * Validates file size (in bytes)
 */
export function validateFileSize(
  file: File,
  maxSize: number,
  fieldName: string = 'File'
): ValidationResult {
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / 1024 / 1024)
    return {
      isValid: false,
      error: `${fieldName} must be smaller than ${maxSizeMB}MB`
    }
  }
  return { isValid: true }
}

/**
 * Validates file type
 */
export function validateFileType(
  file: File,
  allowedTypes: string[],
  fieldName: string = 'File'
): ValidationResult {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.type

  const isAllowed = allowedTypes.some(type => {
    if (type.startsWith('.')) {
      return fileExtension === type.slice(1)
    }
    return mimeType.includes(type.replace('*', ''))
  })

  if (!isAllowed) {
    return {
      isValid: false,
      error: `${fieldName} must be one of: ${allowedTypes.join(', ')}`
    }
  }
  return { isValid: true }
}

/**
 * Runs multiple validators and returns the first error
 */
export function validateMultiple(
  value: any,
  validators: Array<(value: any) => ValidationResult>
): ValidationResult {
  for (const validator of validators) {
    const result = validator(value)
    if (!result.isValid) {
      return result
    }
  }
  return { isValid: true }
}



