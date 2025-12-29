/**
 * @jest-environment node
 */

import { getEnvConfig, validateEnv, getApiUrl } from '../envValidation'

// Save original env
const originalEnv = process.env

describe('Environment Validation Utilities', () => {
  beforeEach(() => {
    // Reset env before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // Restore original env
    process.env = originalEnv
  })

  describe('getEnvConfig', () => {
    it('should return default API_URL for development', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.NEXT_PUBLIC_API_URL
      
      const config = getEnvConfig()
      expect(config.API_URL).toBe('http://localhost:5001/api')
      expect(config.NODE_ENV).toBe('development')
    })

    it('should use provided NEXT_PUBLIC_API_URL', () => {
      process.env.NODE_ENV = 'development'
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      
      const config = getEnvConfig()
      expect(config.API_URL).toBe('https://api.example.com')
    })

    it('should warn about localhost in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:5001/api'
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      getEnvConfig()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: API_URL is set to localhost in production. This may not be intended.'
      )
      consoleSpy.mockRestore()
    })

    it('should include Sentry configuration when available', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123'
      process.env.SENTRY_ORG = 'test-org'
      process.env.SENTRY_PROJECT = 'test-project'
      
      const config = getEnvConfig()
      expect(config.SENTRY_DSN).toBe('https://test@sentry.io/123')
      expect(config.SENTRY_ORG).toBe('test-org')
      expect(config.SENTRY_PROJECT).toBe('test-project')
    })

    it('should warn about missing Sentry DSN in production', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_SENTRY_DSN
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      getEnvConfig()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Warning: NEXT_PUBLIC_SENTRY_DSN is not set. Error tracking may not work properly.'
      )
      consoleSpy.mockRestore()
    })
  })

  describe('validateEnv', () => {
    it('should return valid for correct configuration', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      process.env.NODE_ENV = 'production'
      
      const result = validateEnv()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return error for missing API_URL', () => {
      delete process.env.NEXT_PUBLIC_API_URL
      process.env.NODE_ENV = 'development'
      
      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('NEXT_PUBLIC_API_URL is required')
    })

    it('should return error for invalid API_URL format', () => {
      process.env.NEXT_PUBLIC_API_URL = 'not-a-url'
      process.env.NODE_ENV = 'development'
      
      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('NEXT_PUBLIC_API_URL must be a valid URL')
    })

    it('should return error for invalid NODE_ENV', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      process.env.NODE_ENV = 'invalid'
      
      const result = validateEnv()
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('NODE_ENV must be one of: development, production, test')
    })

    it('should accept valid NODE_ENV values', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      
      for (const env of ['development', 'production', 'test']) {
        process.env.NODE_ENV = env
        const result = validateEnv()
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('getApiUrl', () => {
    it('should return API_URL from config', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      process.env.NODE_ENV = 'development'
      
      expect(getApiUrl()).toBe('https://api.example.com')
    })

    it('should return default API_URL when not set', () => {
      delete process.env.NEXT_PUBLIC_API_URL
      process.env.NODE_ENV = 'development'
      
      expect(getApiUrl()).toBe('http://localhost:5001/api')
    })
  })
})



