/**
 * Environment variable validation utility
 * 
 * This module provides utilities for validating and accessing environment variables
 * in a type-safe manner with appropriate defaults and production warnings.
 */

interface EnvConfig {
  API_URL: string
  NODE_ENV: 'development' | 'production' | 'test'
  SENTRY_DSN?: string
  SENTRY_ORG?: string
  SENTRY_PROJECT?: string
}

/**
 * Gets and validates the environment configuration.
 * 
 * @returns EnvConfig object with validated environment variables
 * 
 * @remarks
 * - Validates API_URL format in production (warns if localhost)
 * - Warns about missing Sentry configuration in production
 * - Provides sensible defaults for development
 * 
 * @example
 * ```typescript
 * const config = getEnvConfig();
 * console.log('API URL:', config.API_URL);
 * ```
 */
export function getEnvConfig(): EnvConfig {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Required in all environments
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
  
  // Validate API_URL format in production
  if (isProduction && API_URL === 'http://localhost:5001/api') {
    console.warn('Warning: API_URL is set to localhost in production. This may not be intended.')
  }

  // Optional but recommended in production
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
  const SENTRY_ORG = process.env.SENTRY_ORG
  const SENTRY_PROJECT = process.env.SENTRY_PROJECT

  if (isProduction) {
    // Warn about missing Sentry configuration in production
    if (!SENTRY_DSN) {
      console.warn('Warning: NEXT_PUBLIC_SENTRY_DSN is not set. Error tracking may not work properly.')
    }
  }

  return {
    API_URL,
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    SENTRY_DSN,
    SENTRY_ORG,
    SENTRY_PROJECT,
  }
}

/**
 * Validates that all required environment variables are present.
 * 
 * @returns Object with validation result and any error messages
 * 
 * @remarks
 * Validates:
 * - NEXT_PUBLIC_API_URL is present and is a valid URL
 * - NODE_ENV is one of: development, production, test
 * 
 * Should be called at application startup to catch configuration errors early.
 * 
 * @example
 * ```typescript
 * const { valid, errors } = validateEnv();
 * if (!valid) {
 *   console.error('Environment validation failed:', errors);
 *   process.exit(1);
 * }
 * ```
 */
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const config = getEnvConfig()

  // Validate API_URL
  if (!config.API_URL) {
    errors.push('NEXT_PUBLIC_API_URL is required')
  } else {
    try {
      new URL(config.API_URL)
    } catch {
      errors.push('NEXT_PUBLIC_API_URL must be a valid URL')
    }
  }

  // Validate NODE_ENV
  if (!['development', 'production', 'test'].includes(config.NODE_ENV)) {
    errors.push('NODE_ENV must be one of: development, production, test')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Gets the validated API URL from environment configuration.
 * 
 * @returns The API URL string
 * 
 * @remarks
 * - Uses validated configuration from getEnvConfig()
 * - Provides default value if not set
 * 
 * @example
 * ```typescript
 * const apiUrl = getApiUrl();
 * fetch(`${apiUrl}/users`);
 * ```
 */
export function getApiUrl(): string {
  const config = getEnvConfig()
  return config.API_URL
}

/**
 * Validated API URL constant exported for convenience.
 * 
 * @remarks
 * This is initialized at module load time using getApiUrl().
 * Use this for consistent API URL access across the application.
 */
export const API_URL = getApiUrl()

