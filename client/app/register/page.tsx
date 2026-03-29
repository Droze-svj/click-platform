'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, handleApiError, setAuthToken } from '@/lib/api'
import { useTranslation } from '../../hooks/useTranslation'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import FormField from '../../components/FormField'
import { Zap, Fingerprint, UserPlus, ChevronRight, Github, Chrome } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
      case 'strong': return 'bg-emerald-500'
      case 'good': return 'bg-indigo-500'
      case 'fair': return 'bg-amber-500'
      default: return 'bg-rose-500'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden px-4 py-12 selection:bg-indigo-500/30">
      {/* Background Matrix & Nebulas */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-[20%] -left-[10%] w-[40%] h-[60%] bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-screen" />

        {/* Animated Cybernetic Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] opacity-50" />

        {/* Deep Field Stars/Nodes */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_50%,#000_0%,transparent_80%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
      </div>

      <div className="absolute top-8 right-8 z-50">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-lg perspective-[2000px]">
        <motion.div
          initial={{ opacity: 0, rotateX: 10, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -5, transition: { duration: 0.4, ease: "easeOut" } }}
          className="backdrop-blur-3xl bg-white/[0.015] border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-[0_30px_100px_rgba(217,70,239,0.15)] flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-700 hover:shadow-[0_40px_120px_rgba(217,70,239,0.25)]"
        >

          {/* Edge Highlights */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-10 space-y-6">
            <motion.div
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="mx-auto w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/10 border border-white/10 flex items-center justify-center shadow-2xl relative"
            >
              <div className="absolute inset-0 bg-fuchsia-500/20 blur-xl rounded-full" />
              <UserPlus className="w-8 h-8 text-fuchsia-400 relative z-10" />
            </motion.div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-[9px] font-black uppercase tracking-[0.3em] italic text-fuchsia-400">
                <Zap className="w-3 h-3 animate-pulse" />
                Initialize Profile
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                {t('auth.registerTitle')}
              </h1>
            </div>
          </div>

          {/* Form Progress Indicator */}
          {formProgress > 0 && formProgress < 100 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Synchronization Matrix</span>
                <span className="text-[10px] font-mono text-indigo-400">{formProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${formProgress}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                />
              </div>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-4 rounded-2xl mb-8 flex items-start justify-between gap-4 text-sm font-medium shadow-inner"
            >
              <div className="flex gap-4">
                <Fingerprint className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">×</button>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate aria-label="Registration form" className="space-y-5">
            <FormField
              label="Operator Name"
              name="name"
              type="text"
              value={name}
              onChange={(v) => {
                setName(v)
                if (!touched.name) setTouched(prev => ({ ...prev, name: true }))
              }}
              onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
              error={nameError || undefined}
              required
              placeholder="John Doe"
            />

            <FormField
              label="Secure Comms Array (Email)"
              name="email"
              type="email"
              value={email}
              onChange={(v) => {
                setEmail(v)
                if (!touched.email) setTouched(prev => ({ ...prev, email: true }))
              }}
              onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
              error={emailError || undefined}
              required
              placeholder="operator@neural-forge.io"
            />

            <div className="relative">
              <FormField
                label="Encryption Key (Password)"
                name="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                error={passwordValidation && !passwordValidation.isValid && touched.password ? passwordValidation.errors[0] : undefined}
                required
                placeholder="••••••••••••"
                showPasswordToggle
              />

              <AnimatePresence>
                {passwordValidation && password.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden" role="status">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 h-1.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getPasswordStrengthColor(passwordValidation.strength)} transition-all duration-300 shadow-[0_0_10px_currentColor]`}
                          style={{ width: passwordValidation.strength === 'strong' ? '100%' : passwordValidation.strength === 'good' ? '75%' : passwordValidation.strength === 'fair' ? '50%' : '25%' }}
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {passwordValidation.strength}
                      </span>
                    </div>

                    {passwordValidation.errors.length > 0 && (
                      <ul className="text-[10px] text-rose-400 mt-2 space-y-1">
                        {passwordValidation.errors.map((err, idx) => (
                          <li key={idx} className="flex gap-2"><span className="text-rose-500">×</span> {err}</li>
                        ))}
                      </ul>
                    )}
                    {passwordValidation.isValid && passwordValidation.feedback.length > 0 && (
                      <ul className="text-[10px] text-emerald-400 mt-2 space-y-1">
                        {passwordValidation.feedback.map((msg, idx) => (
                          <li key={idx} className="flex gap-2"><span className="text-emerald-500">❖</span> {msg}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <FormField
              label="Verify Encryption Key"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v)
                if (!touched.confirmPassword) setTouched(prev => ({ ...prev, confirmPassword: true }))
              }}
              onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
              error={passwordMatchError || undefined}
              required
              placeholder="••••••••••••"
              showPasswordToggle
            />

            <div className="py-2">
              <label className="flex items-start cursor-pointer group">
                <div className="relative flex items-center justify-center w-5 h-5 mr-4 mt-0.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked)
                      if (!touched.terms) setTouched(prev => ({ ...prev, terms: true }))
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer peer"
                  />
                  <div className="w-5 h-5 border-2 border-white/20 rounded bg-white/5 flex items-center justify-center peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all shadow-inner">
                    <svg className={`w-3 h-3 text-white transition-transform duration-300 ${acceptedTerms ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  I accept the Neural Forge{' '}
                  <Link href="/terms" target="_blank" className="text-white hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-2 transition-colors">
                    Terms Code
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" target="_blank" className="text-white hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-2 transition-colors">
                    Privacy Node
                  </Link>
                </span>
              </label>
              {touched.terms && !acceptedTerms && (
                <p className="mt-2 text-[10px] text-rose-400 ml-9">
                  Acceptance of protocols is strictly required
                </p>
              )}
            </div>

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !!(passwordValidation && !passwordValidation.isValid) || !acceptedTerms || !!passwordMatchError}
                className="w-full py-5 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] italic shadow-[0_0_30px_rgba(217,70,239,0.3)] hover:shadow-[0_0_50px_rgba(217,70,239,0.5)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all overflow-hidden relative group/btn"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                {loading ? (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    SYNCING MATRIX...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    Initialize Operator
                    <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </span>
                )}
              </motion.button>
            </div>
          </form>

          {/* Secondary Access Nodes */}
          <div className="mt-10 pt-8 border-t border-white/5 relative z-10">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Secondary Nodes</span>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button disabled className="py-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 flex items-center justify-center gap-3 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] grayscale opacity-50 cursor-not-allowed">
                <Github className="w-4 h-4" /> Github
              </button>
              <button disabled className="py-4 rounded-[1.5rem] bg-white/[0.03] border border-white/5 flex items-center justify-center gap-3 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] grayscale opacity-50 cursor-not-allowed">
                <Chrome className="w-4 h-4" /> Google
              </button>
            </div>
          </div>

          <div className="mt-10 text-center relative z-10 border-t border-white/5 pt-8">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              {t('auth.hasAccount')}{' '}
              <Link
                href="/login"
                className="text-white hover:text-fuchsia-400 transition-colors ml-2 underline decoration-fuchsia-500/30 underline-offset-4"
              >
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

