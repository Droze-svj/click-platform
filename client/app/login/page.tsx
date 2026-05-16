'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, setTokens, clearAuthToken, handleApiError } from '../../lib/api'
import FormField from '../../components/FormField'
import LoadingSpinner from '../../components/LoadingSpinner'
import LanguagePicker from '../../components/LanguagePicker'
import { useTranslation } from '../../hooks/useTranslation'
import { Fingerprint, Lock, ChevronRight, ShieldCheck, Cpu, Sparkles, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ClickLogo from '../../components/ClickLogo'

export default function Login() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If a token was sitting in localStorage when the user landed on /login,
  // assume it's stale — clear BOTH access and refresh tokens so the next
  // login starts from a clean slate. Previously we cleared only the access
  // token, which left an orphaned refreshToken in localStorage; the
  // 401-refresh interceptor would then happily exchange it for a new
  // access token even though the user thought they were signed out.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('token') || localStorage.getItem('refreshToken')) {
      clearAuthToken()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let emailToUse = email
    let passwordToUse = password
    
    try {
      const emailEl = document.getElementById('field-email') as HTMLInputElement | null
      const passEl = document.getElementById('field-password') as HTMLInputElement | null
      
      if ((!emailToUse || !passwordToUse) && (emailEl?.value || passEl?.value)) {
        emailToUse = emailToUse || (emailEl?.value || '')
        passwordToUse = passwordToUse || (passEl?.value || '')
        if (!email && emailToUse) setEmail(emailToUse)
        if (!password && passwordToUse) setPassword(passwordToUse)
      }
    } catch { }

    if (!emailToUse || !passwordToUse) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      const response = await apiPost<{
        data?: { token?: string; refreshToken?: string }
        token?: string
        refreshToken?: string
      }>('/auth/login', {
        email: emailToUse,
        password: passwordToUse,
      })

      const token = response.data?.token || response.token
      const refreshToken = response.data?.refreshToken || response.refreshToken
      if (!token) {
        setError('Login successful but no token received. Please try again.')
        return
      }

      setTokens(token, refreshToken)
      router.push('/dashboard')
    } catch (err: any) {
      const errorMessage = handleApiError(err)
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
    <div className="min-h-screen flex items-center justify-center bg-surface-page relative overflow-hidden px-4 selection:bg-primary-500/30 font-inter">
      {/* High-Fidelity Background Matrix */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[5%] w-[60%] h-[60%] bg-primary-600/10 blur-[140px] rounded-full mix-blend-screen animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[70%] bg-fuchsia-600/10 blur-[160px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[140px] rounded-full mix-blend-screen" />

        {/* Neural Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] opacity-30" />
        
        {/* Subtle Node Constellation */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_100%_100%_at_50%_50%,#000_0%,transparent_80%)] opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-page via-transparent to-surface-page" />
      </div>

      <div className="absolute top-8 right-8 z-50">
        <LanguagePicker />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-surface-card backdrop-blur-[60px] border-2 border-surface-100 dark:border-white/5 p-6 sm:p-10 md:p-16 rounded-[3rem] sm:rounded-[4.5rem] shadow-[0_80px_150px_rgba(0,0,0,0.6)] flex flex-col relative overflow-hidden group transition-all duration-700 hover:border-primary-500/30 hover:shadow-[0_100px_200px_rgba(0,0,0,0.8)]"
        >
          {/* Internal Glow Components */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

          {/* Header Section */}
          <div className="text-center mb-10 sm:mb-16 space-y-6 sm:space-y-8">
            <motion.div
              initial={{ scale: 0.8, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2, type: 'spring' }}
              className="mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] sm:rounded-[2.5rem] bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center shadow-2xl relative group/logo overflow-hidden"
            >
              <div className="absolute inset-0 bg-primary-500/10 opacity-0 group-hover/logo:opacity-100 transition-opacity" />
              <ClickLogo size={48} className="relative z-10 group-hover/logo:scale-110 transition-transform duration-500 sm:hidden" />
              <ClickLogo size={56} className="relative z-10 group-hover/logo:scale-110 transition-transform duration-500 hidden sm:block" />
            </motion.div>

            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-1.5 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic text-primary-500 shadow-xl max-w-full">
                <Sparkles size={14} className="animate-pulse shrink-0" />
                <span className="truncate">Click missed you</span>
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-tight sm:leading-none mb-2 break-words">
                Welcome back.
              </h1>
              <p className="text-surface-500 dark:text-slate-500 text-xs sm:text-sm font-medium tracking-tight leading-snug max-w-md mx-auto px-2">
                Click kept your style profile, your drafts, and every learned pick safe while you were gone. Pick up where you left off.
              </p>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              role="alert"
              aria-live="assertive"
              className="bg-rose-500/5 border-2 border-rose-500/20 text-rose-500 px-6 sm:px-8 py-5 rounded-[2rem] mb-10 sm:mb-12 flex items-start sm:items-center gap-4 sm:gap-5 text-sm font-black italic uppercase tracking-tight shadow-2xl overflow-hidden relative group/err"
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-rose-500 group-hover/err:w-2 transition-all" />
              <Fingerprint className="w-6 h-6 shrink-0 text-rose-500" />
              <span className="break-words min-w-0">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="space-y-3 group/field">
              <div className="flex items-center justify-between px-2">
                <label className="text-[11px] font-black uppercase tracking-[0.5em] text-surface-400 dark:text-slate-600 group-focus-within/field:text-primary-500 transition-colors italic leading-none">Email</label>
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500/20 group-focus-within/field:bg-primary-500 group-focus-within/field:shadow-[0_0_10px_rgba(99,102,241,1)] transition-all" />
              </div>
              <FormField
                label=""
                name="email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <div className="space-y-3 group/field">
              <div className="flex items-center justify-between px-2">
                <label className="text-[11px] font-black uppercase tracking-[0.5em] text-surface-400 dark:text-slate-600 group-focus-within/field:text-primary-500 transition-colors italic leading-none">Password</label>
                {/* Forgot-password affordance. Was previously absent —
                    users who couldn't remember their password had no
                    recovery path on this page, despite the server
                    having /auth/forgot-password and /auth/reset-password
                    routes. Adding it cuts the "stuck out of my account"
                    failure mode that costs the most goodwill. */}
                <a
                  href="/forgot-password"
                  className="text-[10px] font-bold uppercase tracking-widest text-primary-500 hover:text-primary-400 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <FormField
                label=""
                name="password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••••••"
                required
                showPasswordToggle
              />
            </div>

            <div className="pt-8">
              <motion.button
                whileHover={{ y: -8, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                aria-busy={loading ? true : false}
                aria-label={loading ? 'Signing in, please wait' : 'Sign in'}
                className="w-full py-5 sm:py-7 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] font-black text-[12px] sm:text-[14px] uppercase tracking-widest sm:tracking-[0.6em] md:tracking-[0.8em] italic shadow-[0_40px_100px_rgba(0,0,0,0.5)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white flex items-center justify-center gap-4 sm:gap-6 disabled:opacity-30 disabled:grayscale transition-all overflow-hidden relative group/btn border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-purple-600 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                {loading ? (
                  <span className="flex items-center justify-center gap-3 sm:gap-5 relative z-10">
                    <RefreshCw className="animate-spin w-5 h-5 sm:w-7 sm:h-7" />
                    <span className="truncate">Signing in…</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3 sm:gap-5 relative z-10">
                    <span className="truncate">{t('auth.login').toUpperCase()}</span>
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover/btn:translate-x-3 transition-transform duration-500 shrink-0" />
                  </span>
                )}
              </motion.button>
            </div>
          </form>

          {/* Trust strip — replaces the disabled "GitHub (soon) / Google (soon)"
              buttons that used to live here. Those grey-with-(soon) buttons
              telegraphed "unfinished product" to anyone considering paying for
              Click. Once SSO is actually wired we'll bring the buttons back as
              live providers, not aspirational placeholders. */}
          <div className="mt-12 pt-10 border-t-2 border-surface-100 dark:border-white/5 relative z-10">
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Lock className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-widest text-surface-400 dark:text-slate-600 italic leading-tight">256-bit encrypted</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <ShieldCheck className="w-4 h-4 text-primary-500" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-widest text-surface-400 dark:text-slate-600 italic leading-tight">Bcrypt + JWT refresh</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <Sparkles className="w-4 h-4 text-fuchsia-500" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-widest text-surface-400 dark:text-slate-600 italic leading-tight">No password ever stored</span>
              </div>
            </div>
          </div>

          <div className="mt-10 sm:mt-12 text-center relative z-10 border-t-2 border-surface-100 dark:border-white/5 pt-8 sm:pt-10">
            <p className="text-[11px] sm:text-[12px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-widest italic break-words">
              {t('auth.noAccount').toUpperCase()}{' '}
              <a
                href="/register"
                className="text-primary-500 hover:text-primary-400 transition-all ml-2 sm:ml-4 underline decoration-primary-500/30 underline-offset-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
              >
                {t('auth.register').toUpperCase()}
              </a>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Aesthetic Telemetry HUD Elements */}
      <div className="fixed bottom-12 left-12 hidden lg:flex flex-col gap-6 opacity-20 pointer-events-none group">
         <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-500 italic">Ready</span>
         </div>
         <div className="space-y-2">
            <div className="h-1 w-48 bg-surface-100 dark:bg-white/5 rounded-full overflow-hidden">
               <motion.div initial={{ width: 0 }} animate={{ width: '88%' }} transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse' }} className="h-full bg-primary-500" />
            </div>
            <p className="text-[8px] font-black text-slate-800 uppercase tracking-widest italic">Status: online</p>
         </div>
      </div>
      
      <div className="fixed top-12 left-12 hidden lg:flex items-center gap-8 opacity-20 pointer-events-none">
         <Cpu size={32} className="text-slate-800" />
         <div className="h-10 w-px bg-slate-800" />
         <span className="text-[10px] font-black uppercase tracking-[1em] text-slate-800 italic">Click</span>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
