'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, setAuthToken, handleApiError } from '../../lib/api'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { useTranslation } from '../../hooks/useTranslation'

export default function Login() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if user is already authenticated and redirect if so
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token')
      if (token && token.startsWith('dev-jwt-token-')) {
        // User has a dev token, redirect to dashboard
        console.log('🔧 [Login] Dev token found, redirecting to dashboard')
        router.push('/dashboard')
        return
      }

      // In development mode, set dev credentials for easy login
      if (process.env.NODE_ENV === 'development') {
        setEmail('admin@example.com')
        setPassword('admin123')
      }
    }

    checkAuth()
  }, [router])
  const __loginDebugPanelRenderedRef = useRef(false)
  const __stateRef = useRef<{ emailLen: number; passwordLen: number; loading: boolean }>({
    emailLen: 0,
    passwordLen: 0,
    loading: false,
  })

  const apiBase = useMemo(() => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL || '/api'
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return '/api'
    return process.env.NEXT_PUBLIC_API_URL || '/api'
  }, [])




  // Keep a ref with the latest state so DOM/event probes can read it without re-subscribing.
  useEffect(() => {
    __stateRef.current = {
      emailLen: email ? String(email).length : 0,
      passwordLen: password ? String(password).length : 0,
      loading: !!loading,
    }
  }, [email, password, loading])



  const validateEmail = (value: string) => {
    if (!value) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) return 'Please enter a valid email address'
    return null
  }

  const validatePassword = (value: string) => {
    if (!value) return 'Password is required'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // H43: Safari autofill can populate DOM inputs without updating React state,
    // which can leave state empty. If that happens, fall back to reading DOM values
    // (without logging secrets) so the user can still sign in.
    let emailToUse = email
    let passwordToUse = password
    let usedDomFallback = false
    let domEmailLen = 0
    let domPasswordLen = 0
    try {
      const emailEl = document.getElementById('field-email') as HTMLInputElement | null
      const passEl = document.getElementById('field-password') as HTMLInputElement | null
      domEmailLen = emailEl?.value ? String(emailEl.value).length : 0
      domPasswordLen = passEl?.value ? String(passEl.value).length : 0

      if ((!emailToUse || !passwordToUse) && (domEmailLen > 0 || domPasswordLen > 0)) {
        emailToUse = emailToUse || (emailEl?.value || '')
        passwordToUse = passwordToUse || (passEl?.value || '')
        usedDomFallback = true
        // keep state in sync for UI
        try {
          if (!email && emailToUse) setEmail(emailToUse)
          if (!password && passwordToUse) setPassword(passwordToUse)
        } catch {}
      }
    } catch {}

    
    // Validate before submitting
    const emailError = validateEmail(emailToUse)
    const passwordError = validatePassword(passwordToUse)
    
    if (emailError || passwordError) {
      setError(emailError || passwordError || 'Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      const response = await apiPost<{ data?: { token?: string }, token?: string }>('/auth/login', {
        email: emailToUse,
        password: passwordToUse,
      })

      const token = response.data?.token || response.token
      if (!token) {
        setError('Login successful but no token received. Please try again.')
        return
      }

      setAuthToken(token)
      router.push('/dashboard')
    } catch (err: any) {
      const errorMessage = handleApiError(err)
      
      // Add specific timeout handling
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.name === 'DatabaseTimeoutError') {
        setError('Request timed out. The server may be waking up (this can take 30-60 seconds on free tier). Please try again in a moment.')
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('Cannot connect to server. Make sure the backend is running.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 px-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:shadow-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {t('auth.loginTitle')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('auth.loginSubtitle')}</p>
        </div>

        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 animate-shake">
            <span className="text-red-500">⚠️</span>
            <span>{error}</span>
          </div>
        )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
          <FormField
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            error={error && error.includes('email') ? error : undefined}
            placeholder="you@example.com"
            required
            validate={validateEmail}
            autoFocus
          />

          <FormField
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            error={error && error.includes('password') ? error : undefined}
            placeholder={t('auth.passwordPlaceholder')}
            required
            validate={validatePassword}
            showPasswordToggle
          />

          <button
            type="submit"
            // H43: Don't disable based on React state only (Safari autofill may not update it).
            // Validation will still run inside handleSubmit; keep disabled only while loading.
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                {t('auth.loggingIn')}
              </span>
            ) : (
              t('auth.login')
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <a 
              href="/register" 
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium hover:underline transition-colors"
            >
              {t('auth.register')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

