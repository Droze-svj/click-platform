'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, handleApiError, setAuthToken } from '@/lib/api'
import { useTranslation } from '../../hooks/useTranslation'
import LanguageSwitcher from '../../components/LanguageSwitcher'

interface PasswordValidation {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
  feedback: string[]
}

export default function Register() {
  const router = useRouter()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation | null>(null)
  const [touched, setTouched] = useState({ 
    name: false, 
    email: false, 
    password: false, 
    confirmPassword: false,
    terms: false
  })
  const nameInputRef = useRef<HTMLInputElement>(null)
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-focus first input on mount
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Keyboard shortcut: Enter to submit
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        const form = document.querySelector('form[aria-label="Registration form"]') as HTMLFormElement
        if (form && !loading) {
          form.requestSubmit()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [loading])

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Memoized client-side password validation with debouncing
  const validatePassword = useCallback((pwd: string): PasswordValidation => {
    const errors: string[] = []
    const feedback: string[] = []
    
    if (!pwd || pwd.length < 6) {
      errors.push('Password must be at least 6 characters long')
    } else if (pwd.length < 8) {
      feedback.push('Consider using 8 or more characters for better security')
    }

    const hasUppercase = /[A-Z]/.test(pwd)
    const hasLowercase = /[a-z]/.test(pwd)
    const hasNumbers = /\d/.test(pwd)
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)

    const charTypeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length

    if (charTypeCount < 3) {
      errors.push('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters')
    }

    if (!hasUppercase && pwd.length > 0) feedback.push('Add uppercase letters')
    if (!hasLowercase && pwd.length > 0) feedback.push('Add lowercase letters')
    if (!hasNumbers && pwd.length > 0) feedback.push('Add numbers')
    if (!hasSpecialChars && pwd.length > 0) feedback.push('Add special characters')

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123', 'admin', 'letmein']
    if (commonPasswords.includes(pwd.toLowerCase())) {
      errors.push('This password is too common. Please choose a more unique password')
    }

    // Check for sequential patterns
    if (/(123|abc|qwe)/i.test(pwd)) {
      feedback.push('Avoid sequential patterns for better security')
    }

    // Calculate strength
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak'
    if (errors.length === 0) {
      if (pwd.length >= 12 && charTypeCount === 4) strength = 'strong'
      else if (pwd.length >= 8 && charTypeCount >= 3) strength = 'good'
      else if (pwd.length >= 6 && charTypeCount >= 3) strength = 'fair'
    }

    return { isValid: errors.length === 0, errors, strength, feedback }
  }, [])

  // Client-side email validation
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }, [])

  // Memoized validation states
  const nameError = useMemo(() => {
    if (!touched.name) return null
    if (!name.trim()) return 'Name is required'
    if (name.trim().length < 2) return 'Name must be at least 2 characters'
    return null
  }, [name, touched.name])

  const emailError = useMemo(() => {
    if (!touched.email) return null
    if (!email.trim()) return 'Email is required'
    if (!validateEmail(email)) return 'Please enter a valid email address'
    return null
  }, [email, touched.email, validateEmail])

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value)
    setTouched(prev => ({ ...prev, password: true }))
    
    // Debounce validation for better performance
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    
    if (value.length > 0) {
      validationTimeoutRef.current = setTimeout(() => {
        setPasswordValidation(validatePassword(value))
      }, 300)
    } else {
      setPasswordValidation(null)
    }
  }, [validatePassword])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [])

  // Memoized password match validation
  const passwordMatchError = useMemo(() => {
    if (!touched.confirmPassword) return null
    if (!confirmPassword) return 'Please confirm your password'
    if (password !== confirmPassword) return 'Passwords do not match'
    return null
  }, [password, confirmPassword, touched.confirmPassword])

  // Calculate form completion percentage
  const formProgress = useMemo(() => {
    let completed = 0
    const total = 5 // name, email, password, confirmPassword, terms
    
    if (name.trim().length >= 2) completed++
    if (email.trim().length > 0 && !emailError) completed++
    if (password.length > 0 && passwordValidation?.isValid) completed++
    if (confirmPassword.length > 0 && !passwordMatchError) completed++
    if (acceptedTerms) completed++
    
    return Math.round((completed / total) * 100)
  }, [name, email, emailError, password, passwordValidation, confirmPassword, passwordMatchError, acceptedTerms])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Mark all fields as touched
    setTouched({ name: true, email: true, password: true, confirmPassword: true, terms: true })

    // Client-side validation
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters')
      return
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (!passwordValidation || !passwordValidation.isValid) {
      setError(passwordValidation?.errors[0] || 'Please enter a valid password')
      return
    }

    if (!confirmPassword) {
      setError('Please confirm your password')
      setTouched(prev => ({ ...prev, confirmPassword: true }))
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setTouched(prev => ({ ...prev, confirmPassword: true }))
      return
    }

    if (!acceptedTerms) {
      setError('Please accept the terms and conditions to continue')
      setTouched(prev => ({ ...prev, terms: true }))
      return
    }

    if (loading) return // Prevent double submission
    setLoading(true)

    try {
      // Split name into firstName and lastName for server compatibility
      const nameParts = name.trim().split(/\s+/)
      const firstName = nameParts[0] || name
      const lastName = nameParts.slice(1).join(' ') || ''

      const response = await apiPost<{ 
        success?: boolean
        message?: string
        data?: { 
          token?: string
          user?: any
          requiresVerification?: boolean
        }
        token?: string
      }>('/auth/register', {
        firstName,
        lastName,
        email,
        password
      })

      // Handle different response formats
      const token = response.data?.token || response.token
      const requiresVerification = response.data?.requiresVerification || false
      
      // Reset loading state before redirecting
      setLoading(false)
      
      if (token) {
        // Token provided - store and redirect
        setAuthToken(token)
        router.push('/registration-success')
      } else if (requiresVerification || response.success) {
        // Email verification required - redirect to verification message page
        router.push(`/registration-success?verification=required&email=${encodeURIComponent(email)}`)
      } else {
        // Unexpected response - show message and redirect
        setError('Registration successful! Please check your email to verify your account.')
        setTimeout(() => {
          router.push('/login')
        }, 3000)
        return
      }
    } catch (err: any) {
      // Use centralized error handling, but provide fallback for specific cases
      let errorMessage = handleApiError(err)
      
      // Enhanced error messages for specific scenarios
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.name === 'DatabaseTimeoutError') {
        errorMessage = 'Request timed out. The server may be waking up (this can take 30-60 seconds on free tier). Please try again in a moment.'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Make sure the backend is running.'
      } else if (err.response?.data?.details) {
        // Handle express-validator errors array
        const validationErrors = Array.isArray(err.response.data.details)
          ? err.response.data.details.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ')
          : JSON.stringify(err.response.data.details)
        errorMessage = `Validation error: ${validationErrors}`
      } else if (err.response?.data?.errors) {
        // Handle validation errors array
        const validationErrors = Array.isArray(err.response.data.errors) 
          ? err.response.data.errors.map((e: any) => e.msg || e.message || e).join(', ')
          : JSON.stringify(err.response.data.errors)
        errorMessage = `Validation error: ${validationErrors}`
      }
      
      // Log error in development only
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', err)
        console.error('Full error response:', err.response?.data)
      }
      
      setError(errorMessage)
      setLoading(false)
    }
  }

  const getPasswordStrengthColor = (strength?: string) => {
    switch (strength) {
      case 'strong': return 'bg-green-500'
      case 'good': return 'bg-blue-500'
      case 'fair': return 'bg-yellow-500'
      default: return 'bg-red-500'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 px-4 py-8 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md animate-slide-in-up">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-center text-gray-900 dark:text-white">{t('auth.registerTitle')}</h1>
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            {t('auth.registerSubtitle')}
          </p>
          
          {/* Form Progress Indicator */}
          {formProgress > 0 && formProgress < 100 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Form completion</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{formProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${formProgress}%` }}
                  role="progressbar"
                  aria-valuenow={formProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div 
            className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 flex items-start justify-between"
            role="alert"
            aria-live="polite"
          >
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-4 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Full Name
            </label>
            <input
              ref={nameInputRef}
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!touched.name) setTouched(prev => ({ ...prev, name: true }))
              }}
              onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-colors ${
                nameError
                  ? 'border-red-500 dark:border-red-600 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              required
              autoComplete="name"
              placeholder="John Doe"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? 'name-error' : undefined}
            />
            {nameError && (
              <p id="name-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (!touched.email) setTouched(prev => ({ ...prev, email: true }))
              }}
              onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-colors ${
                emailError
                  ? 'border-red-500 dark:border-red-600 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              required
              autoComplete="email"
              placeholder="john@example.com"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <p id="email-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {emailError}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-colors ${
                  passwordValidation && !passwordValidation.isValid && touched.password
                    ? 'border-red-500 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Enter password"
                aria-invalid={passwordValidation ? !passwordValidation.isValid : false}
                aria-describedby={passwordValidation && password.length > 0 ? 'password-validation' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {showPassword ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </>
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            
            {passwordValidation && password.length > 0 && (
              <div id="password-validation" className="mt-2" role="status" aria-live="polite">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getPasswordStrengthColor(passwordValidation.strength)} transition-all duration-300`}
                      style={{ width: passwordValidation.strength === 'strong' ? '100%' : passwordValidation.strength === 'good' ? '75%' : passwordValidation.strength === 'fair' ? '50%' : '25%' }}
                      role="progressbar"
                      aria-valuenow={passwordValidation.strength === 'strong' ? 100 : passwordValidation.strength === 'good' ? 75 : passwordValidation.strength === 'fair' ? 50 : 25}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Password strength: ${passwordValidation.strength}`}
                    />
                  </div>
                  <span className="text-xs font-semibold capitalize text-gray-600 dark:text-gray-400">
                    {passwordValidation.strength}
                  </span>
                </div>
                
                {passwordValidation.errors.length > 0 && (
                  <ul className="text-xs text-red-600 dark:text-red-400 mt-1 space-y-0.5" role="list">
                    {passwordValidation.errors.map((err, idx) => (
                      <li key={idx} role="listitem">• {err}</li>
                    ))}
                  </ul>
                )}
                
                {passwordValidation.isValid && passwordValidation.feedback.length > 0 && (
                  <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5" role="list">
                    {passwordValidation.feedback.map((msg, idx) => (
                      <li key={idx} role="listitem">💡 {msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            
            {!passwordValidation && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Must be at least 6 characters with at least 3 of: uppercase, lowercase, numbers, special characters
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (!touched.confirmPassword) setTouched(prev => ({ ...prev, confirmPassword: true }))
                }}
                onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 transition-colors ${
                  passwordMatchError
                    ? 'border-red-500 dark:border-red-600 focus:ring-red-500'
                    : confirmPassword && password === confirmPassword
                    ? 'border-green-500 dark:border-green-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                required
                autoComplete="new-password"
                placeholder="Confirm your password"
                aria-invalid={!!passwordMatchError}
                aria-describedby={passwordMatchError ? 'confirm-password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded p-1"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {showConfirmPassword ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </>
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {passwordMatchError && (
              <p id="confirm-password-error" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {passwordMatchError}
              </p>
            )}
            {confirmPassword && password === confirmPassword && !passwordMatchError && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Passwords match
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="flex items-start cursor-pointer group">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked)
                  if (!touched.terms) setTouched(prev => ({ ...prev, terms: true }))
                }}
                className="mt-1 mr-3 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                aria-invalid={touched.terms && !acceptedTerms}
                aria-describedby={touched.terms && !acceptedTerms ? 'terms-error' : undefined}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I agree to the{' '}
                <Link 
                  href="/terms" 
                  target="_blank"
                  className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  Terms and Conditions
                </Link>
                {' '}and{' '}
                <Link 
                  href="/privacy" 
                  target="_blank"
                  className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
            {touched.terms && !acceptedTerms && (
              <p id="terms-error" className="mt-1 text-xs text-red-600 dark:text-red-400 ml-7" role="alert">
                Please accept the terms and conditions to continue
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !!(passwordValidation && !passwordValidation.isValid) || !acceptedTerms || !!passwordMatchError}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] font-semibold shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                Creating account...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                Create Account
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            {t('auth.hasAccount')}{' '}
            <Link 
              href="/login" 
              className="text-purple-600 dark:text-purple-400 hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 rounded transition-colors"
            >
              {t('auth.login')}
            </Link>
          </p>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> to submit
          </p>
        </div>
      </div>
    </div>
  )
}

