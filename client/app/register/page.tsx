'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiPost, handleApiError, setTokens } from '@/lib/api'
import { getPlan, buildCheckoutTarget, type BillingPeriod, type PlanId } from '@/lib/plans'
import { useTranslation } from '../../hooks/useTranslation'
import LanguagePicker from '../../components/LanguagePicker'
import FormField from '../../components/FormField'
import { Fingerprint, ChevronRight, Sparkles, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ClickLogo from '../../components/ClickLogo'

interface PasswordValidation {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
  feedback: string[]
}

export default function Register() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // (confirmPassword state removed — field gone, show/hide toggle replaces it.)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const planFromUrl = (searchParams?.get('plan') || '') as PlanId | ''
  const periodFromUrl = (searchParams?.get('period') === 'yearly' ? 'yearly' : 'monthly') as BillingPeriod
  const selectedPlan = planFromUrl ? getPlan(planFromUrl) : null

  useEffect(() => {
    if (planFromUrl) {
      try {
        sessionStorage.setItem(
          'click.pending_plan',
          JSON.stringify({ id: planFromUrl, period: periodFromUrl, ts: Date.now() }),
        )
      } catch { }
    }
  }, [planFromUrl, periodFromUrl])

  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation | null>(null)
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const validatePassword = useCallback((pwd: string): PasswordValidation => {
    const errors: string[] = []
    const feedback: string[] = []

    if (!pwd || pwd.length < 6) {
      errors.push('Password must be at least 6 characters long')
    }

    const hasUppercase = /[A-Z]/.test(pwd)
    const hasLowercase = /[a-z]/.test(pwd)
    const hasNumbers = /\d/.test(pwd)
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    const charTypeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length

    if (charTypeCount < 3) {
      errors.push('Add more complexity: uppercase, numbers, or symbols')
    }

    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak'
    if (errors.length === 0) {
      if (pwd.length >= 12 && charTypeCount === 4) strength = 'strong'
      else if (pwd.length >= 8 && charTypeCount >= 3) strength = 'good'
      else if (pwd.length >= 6 && charTypeCount >= 3) strength = 'fair'
    }

    return { isValid: errors.length === 0, errors, strength, feedback }
  }, [])

  const validateEmail = useCallback((email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }, [])

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value)
    if (validationTimeoutRef.current) clearTimeout(validationTimeoutRef.current)
    if (value.length > 0) {
      validationTimeoutRef.current = setTimeout(() => {
        setPasswordValidation(validatePassword(value))
      }, 300)
    } else {
      setPasswordValidation(null)
    }
  }, [validatePassword])

  const formProgress = useMemo(() => {
    // Now 4 fields (name, email, password, terms) since confirm-password
    // was removed. The progress pill drives forward at the natural cadence
    // of the form — was 5 fields → 4, so each completed field is +25%.
    let completed = 0
    const total = 4
    if (name.trim().length >= 2) completed++
    if (email.trim().length > 0 && validateEmail(email)) completed++
    if (password.length > 0 && passwordValidation?.isValid) completed++
    if (acceptedTerms) completed++
    return Math.round((completed / total) * 100)
  }, [name, email, password, passwordValidation, acceptedTerms, validateEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || name.trim().length < 2) { setError('Name is required'); return }
    if (!validateEmail(email)) { setError('Invalid email address'); return }
    if (!passwordValidation?.isValid) { setError(passwordValidation?.errors[0] || 'Invalid password'); return }
    // Confirm-password validation removed alongside the field above.
    if (!acceptedTerms) { setError('Accept the terms to proceed'); return }

    setLoading(true)
    try {
      // Single-name users (e.g. "Madonna", "Jane") used to fail server
      // validation because the client sent `lastName: ''` and the
      // server required min length 1. Default the lastName to a safe
      // placeholder so the registration always succeeds — the user
      // can edit it later in Settings.
      const nameParts = name.trim().split(/\s+/)
      const firstName = nameParts[0] || name
      const lastName = nameParts.slice(1).join(' ') || '—'

      const response = await apiPost<{
        data?: { token?: string; refreshToken?: string; user?: any; requiresVerification?: boolean }
        token?: string
        refreshToken?: string
        success?: boolean
      }>('/auth/register', {
        firstName,
        lastName,
        email,
        password,
      })

      const token = response.data?.token || response.token
      const refreshToken = response.data?.refreshToken || response.refreshToken
      if (token) {
        setTokens(token, refreshToken)
        const planForCheckout = selectedPlan
        // Paid plan picked at the marketing site: route to the
        // checkout target (Whop) carrying the user's identity. The
        // post-purchase webhook will mark the plan active.
        if (planForCheckout && planForCheckout.id !== 'free') {
          const target = buildCheckoutTarget(planForCheckout, periodFromUrl, response.data?.user || { email })
          if (target.kind === 'whop') {
            window.location.href = target.href
            return
          }
        }
        // Free plan (the most common path): the user is already
        // signed in. Send them straight to the dashboard — the
        // previous `/registration-success` middleman added an extra
        // click for no value and was already redirecting to the
        // dashboard anyway. One less page = less drop-off.
        router.push('/dashboard?welcome=1')
      } else if (response.data?.requiresVerification || response.success) {
        // Older Supabase deploys (no token in response) — kept as a
        // safety net so users still land somewhere coherent.
        router.push(`/registration-success?verification=required&email=${encodeURIComponent(email)}`)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page relative overflow-hidden px-4 py-20 selection:bg-primary-500/30 font-inter">
      {/* High-Fidelity Background Matrix */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] bg-fuchsia-600/10 blur-[160px] rounded-full mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[20%] -left-[10%] w-[50%] h-[70%] bg-primary-600/10 blur-[180px] rounded-full mix-blend-screen" />
        
        {/* Neural Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] opacity-30" />
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
          className="bg-surface-card backdrop-blur-[60px] border-2 border-surface-100 dark:border-white/5 p-12 md:p-16 rounded-[4.5rem] shadow-[0_80px_150px_rgba(0,0,0,0.6)] flex flex-col relative overflow-hidden group transition-all duration-700 hover:border-fuchsia-500/30 hover:shadow-[0_100px_200px_rgba(0,0,0,0.8)]"
        >
          {/* Header Section */}
          <div className="text-center mb-12 space-y-8">
            <motion.div
              initial={{ scale: 0.8, rotate: 15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2, type: 'spring' }}
              className="mx-auto w-24 h-24 rounded-[2.5rem] bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center shadow-2xl relative group/logo overflow-hidden"
            >
              <div className="absolute inset-0 bg-fuchsia-500/10 opacity-0 group-hover/logo:opacity-100 transition-opacity" />
              <ClickLogo size={56} className="relative z-10 group-hover/logo:scale-110 transition-transform duration-500" />
            </motion.div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-5 py-1.5 rounded-full bg-fuchsia-500/10 border-2 border-fuchsia-500/20 text-[10px] font-black uppercase tracking-[0.4em] italic text-fuchsia-500 shadow-xl">
                <Sparkles size={14} className="animate-pulse" />
                Click is ready to learn your style
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-surface-900 dark:text-white tracking-tighter uppercase italic leading-none mb-2">
                Meet Click.
              </h1>
              <p className="text-surface-500 dark:text-slate-500 text-sm font-medium tracking-tight leading-snug max-w-md mx-auto">
                90 seconds from here to your first AI-edited clip. Click learns your niche on signup and gets sharper with every post you ship.
              </p>
            </div>

            {/* Plan teaser — confirms what the user picked from the landing
                page, or invites them to upgrade if they landed here with no
                plan. Conversion lever: a visible plan summary reassures
                paying users they're buying the right thing, and the
                "compare plans" link gives free-tier landings a no-pressure
                path to upgrade. */}
            {selectedPlan && selectedPlan.id !== 'free' ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mx-auto inline-flex items-center gap-4 px-5 py-3 rounded-2xl bg-fuchsia-500/10 border-2 border-fuchsia-500/30 shadow-xl"
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300/70 italic leading-none">You picked</span>
                  <span className="text-base font-black text-surface-900 dark:text-white tracking-tight leading-tight">
                    {selectedPlan.name}
                    <span className="text-fuchsia-400 ml-2 font-bold">
                      ${periodFromUrl === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly}
                      <span className="text-[10px] font-bold uppercase tracking-widest ml-0.5">
                        /{periodFromUrl === 'yearly' ? 'yr' : 'mo'}
                      </span>
                    </span>
                  </span>
                </div>
                <Link
                  href="/#pricing"
                  className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 hover:text-fuchsia-100 underline decoration-fuchsia-500/30 underline-offset-4 transition-colors whitespace-nowrap"
                >
                  Change
                </Link>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mx-auto inline-flex items-center gap-3 px-4 py-2 rounded-full bg-surface-page dark:bg-black/40 border border-surface-100 dark:border-white/10"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500 dark:text-slate-500">
                  Starting on Free —
                </span>
                <Link
                  href="/#pricing"
                  className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 hover:text-fuchsia-300 underline decoration-fuchsia-500/40 underline-offset-4 transition-colors"
                >
                  See Pro & Agency
                </Link>
              </motion.div>
            )}
          </div>

          {/* Form Progress Matrix */}
          <div className="mb-12 relative px-2">
             <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.6em] text-surface-400 dark:text-slate-600 italic">Progress</span>
                <span className="text-[10px] font-black text-primary-500 italic tabular-nums">{formProgress}%</span>
             </div>
             <div className="h-2 bg-surface-page dark:bg-black/40 rounded-full border-2 border-surface-100 dark:border-white/5 overflow-hidden shadow-inner">
                <motion.div initial={{ width: 0 }} animate={{ width: `${formProgress}%` }} className="h-full bg-gradient-to-r from-primary-500 to-fuchsia-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
             </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-rose-500/5 border-2 border-rose-500/20 text-rose-500 px-8 py-5 rounded-[2rem] mb-10 flex items-center gap-5 text-sm font-black italic uppercase tracking-tight shadow-2xl relative group/err"
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-rose-500 group-hover/err:w-2 transition-all" />
              <Fingerprint className="w-6 h-6 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <FormField label="Name" name="name" type="text" value={name} onChange={setName} placeholder="Jane Doe" required autoFocus />
            <FormField label="Email" name="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
            
            <div className="space-y-4">
              <FormField label="Password" name="password" type="password" value={password} onChange={handlePasswordChange} placeholder="••••••••••••" required showPasswordToggle />
              <AnimatePresence>
                {passwordValidation && password.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4 overflow-hidden">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex-1 h-1 bg-surface-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${passwordValidation.strength === 'strong' ? 'bg-emerald-500' : passwordValidation.strength === 'good' ? 'bg-primary-500' : 'bg-rose-500'}`} 
                          initial={{ width: 0 }} 
                          animate={{ width: passwordValidation.strength === 'strong' ? '100%' : passwordValidation.strength === 'good' ? '75%' : '30%' }} 
                        />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-surface-400 italic">{passwordValidation.strength} strength</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Confirm-password field removed. The password input has
                a show/hide toggle (showPasswordToggle prop), which lets
                users visually verify what they typed without doubling
                the keystrokes. Modern auth UX has dropped the second
                field as one of the highest-friction items on signup. */}

            <div className="py-4">
              <label className="flex items-start cursor-pointer group/terms">
                <div className="relative flex items-center justify-center w-6 h-6 mr-6 mt-1">
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer peer" />
                  <div className="w-6 h-6 border-2 border-surface-100 dark:border-white/10 rounded-xl bg-surface-page dark:bg-black/40 flex items-center justify-center peer-checked:bg-primary-500 peer-checked:border-primary-500 transition-all shadow-inner">
                    <motion.svg className={`w-4 h-4 text-white ${acceptedTerms ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  </div>
                </div>
                <span className="text-[12px] text-surface-500 dark:text-slate-500 font-black uppercase tracking-widest italic leading-relaxed pt-1">
                  I accept the{' '}
                  <Link href="/terms" target="_blank" className="text-surface-900 dark:text-white underline decoration-primary-500/30 underline-offset-4">Terms</Link>
                  {' '}and{' '}
                  <Link href="/privacy" target="_blank" className="text-surface-900 dark:text-white underline decoration-primary-500/30 underline-offset-4">Privacy Policy</Link>
                </span>
              </label>
            </div>

            <div className="pt-8">
              <motion.button
                whileHover={{ y: -8, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-7 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] font-black text-[14px] uppercase tracking-[0.8em] italic shadow-[0_40px_100px_rgba(0,0,0,0.5)] hover:bg-fuchsia-600 dark:hover:bg-fuchsia-500 hover:text-white flex items-center justify-center gap-6 disabled:opacity-30 disabled:grayscale transition-all overflow-hidden relative group/btn border-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-indigo-600 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                {loading ? (
                  <span className="flex items-center justify-center gap-5 relative z-10">
                    <RefreshCw className="animate-spin" size={28} />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-5 relative z-10">
                    Create account
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-3 transition-transform duration-500" />
                  </span>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-12 text-center relative z-10 border-t-2 border-surface-100 dark:border-white/5 pt-10">
            <p className="text-[12px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-widest italic">
              {t('auth.hasAccount').toUpperCase()}{' '}
              <Link href="/login" className="text-primary-500 hover:text-primary-400 transition-all ml-4 underline decoration-primary-500/30 underline-offset-8">LOGIN</Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  )
}
