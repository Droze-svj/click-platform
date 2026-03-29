'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, setAuthToken, handleApiError } from '../../lib/api'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { useTranslation } from '../../hooks/useTranslation'
import { Zap, Fingerprint, Lock, ChevronRight, Github, Chrome } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
        } catch { }
      }
    } catch { }


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
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden px-4 selection:bg-indigo-500/30">
      {/* Background Matrix & Nebulas */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-screen" />

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
          className="backdrop-blur-3xl bg-white/[0.015] border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-[0_30px_100px_rgba(79,70,229,0.15)] flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-700 hover:shadow-[0_40px_120px_rgba(79,70,229,0.25)]"
        >

          {/* Edge Highlights */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-12 space-y-6">
            <motion.div
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="mx-auto w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/10 border border-white/10 flex items-center justify-center shadow-2xl relative"
            >
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
              <Lock className="w-8 h-8 text-indigo-400 relative z-10" />
            </motion.div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-[0.3em] italic text-indigo-400">
                <Zap className="w-3 h-3 animate-pulse" />
                Authentication Required
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                {t('auth.loginTitle')}
              </h1>
              <p className="text-slate-500 text-sm font-medium tracking-wide">
                {t('auth.loginSubtitle')}
              </p>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-4 rounded-2xl mb-8 flex items-start gap-4 text-sm font-medium shadow-inner"
            >
              <Fingerprint className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 group/field">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within/field:text-indigo-400 transition-colors block ml-2">Secure Link / Email</label>
              <div className="relative">
                <FormField
                  label=""
                  name="email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  error={error && error.includes('email') ? error : undefined}
                  placeholder="operator@neural-forge.io"
                  required
                  validate={validateEmail}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2 group/field">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-focus-within/field:text-indigo-400 transition-colors block ml-2">Access Key / Password</label>
              <div className="relative">
                <FormField
                  label=""
                  name="password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  error={error && error.includes('password') ? error : undefined}
                  placeholder="••••••••••••"
                  required
                  validate={validatePassword}
                  showPasswordToggle
                />
              </div>
            </div>

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.2em] italic shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all overflow-hidden relative group/btn"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                {loading ? (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <LoadingSpinner size="sm" />
                    DECRYPTING...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    {t('auth.login')}
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
              {t('auth.noAccount')}{' '}
              <a
                href="/register"
                className="text-white hover:text-indigo-400 transition-colors ml-2 underline decoration-indigo-500/30 underline-offset-4"
              >
                {t('auth.register')}
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

