'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost, apiPut, handleApiError, setTokens } from '@/lib/api'
import { getPlan, buildCheckoutTarget, type BillingPeriod, type PlanId } from '@/lib/plans'
import { NICHE_OPTIONS, PLATFORM_OPTIONS, GOAL_OPTIONS, nicheLabel } from '@/lib/nicheCatalog'
import { ACCENT_PALETTES, resolveAccentKey } from '@/lib/swarmTheme'
import { useTranslation } from '../../hooks/useTranslation'
import LanguagePicker from '../../components/LanguagePicker'
import FormField from '../../components/FormField'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, RefreshCw, Target, Lock, ShieldCheck,
} from 'lucide-react'
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

  // ── Step machine ─────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 — credentials (all existing logic preserved)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [gated, setGated] = useState(false)

  // Step 2 — personalization
  const [niche, setNiche] = useState<string>('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [goal, setGoal] = useState<string>('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const prefersReducedMotion = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiGet<{ data?: { gated?: boolean } }>('/auth/registration-config')
      .then((res) => { if (!cancelled) setGated(!!res?.data?.gated) })
      .catch(() => { /* default: not gated in the UI; server still enforces */ })
    return () => { cancelled = true }
  }, [])

  // Pre-fill personalization from a landing deep-link
  // (?niche=&platforms=&goal=) so the visitor's PlanBuilder choices carry in.
  useEffect(() => {
    const nq = searchParams?.get('niche')
    const pq = searchParams?.get('platforms')
    const gq = searchParams?.get('goal')
    if (nq && NICHE_OPTIONS.some((o) => o.value === nq)) setNiche(nq)
    if (pq) {
      const valid = pq.split(',').filter((v) => PLATFORM_OPTIONS.some((o) => o.value === v))
      if (valid.length) setPlatforms(valid)
    }
    if (gq && GOAL_OPTIONS.some((o) => o.value === gq)) setGoal(gq)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bridge the landing accent into signup: a chosen niche tints the gradient
  // buttons + progress bar; with no niche it stays the default indigo→fuchsia.
  const accentKey = resolveAccentKey(niche || null, 'coach')
  const accentBg = niche ? ACCENT_PALETTES[accentKey].solidBg : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'

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

  // Step 1 is "complete" when all credential fields validate. We gate the
  // "Continue" button on this so users can't advance with bad input.
  const step1Valid = useMemo(() => {
    return (
      name.trim().length >= 2 &&
      validateEmail(email) &&
      !!passwordValidation?.isValid &&
      acceptedTerms
    )
  }, [name, email, passwordValidation, acceptedTerms, validateEmail])

  const togglePlatform = (value: string) => {
    setPlatforms((prev) => prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value])
  }

  // Advance from credentials → personalization (validates step 1 first).
  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || name.trim().length < 2) { setError('Name is required'); return }
    if (!validateEmail(email)) { setError('Invalid email address'); return }
    if (!passwordValidation?.isValid) { setError(passwordValidation?.errors[0] || 'Invalid password'); return }
    if (!acceptedTerms) { setError('Accept the terms to proceed'); return }
    setStep(2)
  }

  // Final submit — registers the account, then persists personalization via an
  // authenticated PUT /niche/personalize (niche → User.niche AND the canonical
  // UserPreferences.marketingIntelligence.niche). `skip` lets users finish
  // without picking; defaults are set later in onboarding.
  const submitRegistration = async (skip: boolean) => {
    setError('')
    setLoading(true)
    try {
      // Single-name users (e.g. "Madonna") used to fail server validation
      // because lastName was empty. Default to a safe placeholder.
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
        ...(inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {}),
      })

      const token = response.data?.token || response.token
      const refreshToken = response.data?.refreshToken || response.refreshToken

      if (token) {
        setTokens(token, refreshToken)

        // Persist personalization while authenticated. Best-effort: a failure
        // here must NOT block the user from reaching the dashboard — niche
        // defaults to 'other' server-side and can be set later in onboarding.
        const chosenNiche = skip ? '' : niche
        if (!skip && (niche || platforms.length || goal)) {
          try {
            await apiPut('/niche/personalize', {
              ...(niche ? { niche } : {}),
              ...(goal ? { goals: [goal] } : {}),
              ...(platforms.length ? { platformFocus: platforms } : {}),
            })
          } catch { /* non-blocking — onboarding can capture this later */ }
        }

        const planForCheckout = selectedPlan
        if (planForCheckout && planForCheckout.id !== 'free') {
          const target = buildCheckoutTarget(planForCheckout, periodFromUrl, response.data?.user || { email })
          if (target.kind === 'whop') {
            window.location.href = target.href
            return
          }
        }
        // Carry the niche into the dashboard so the welcome banner can greet
        // the user with their real, chosen workspace. Route brand-new users
        // through the one-step caption setup first, then on to the welcome
        // dashboard (passed as `next`) so onboarding starts with their captions.
        const nicheParam = chosenNiche ? `&niche=${encodeURIComponent(chosenNiche)}` : ''
        const welcomeDest = `/dashboard?welcome=1${nicheParam}`
        router.push(`/dashboard/onboarding/captions?next=${encodeURIComponent(welcomeDest)}`)
      } else if (response.data?.requiresVerification || response.success) {
        router.push(`/registration-success?verification=required&email=${encodeURIComponent(email)}`)
      }
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const motionProps = prefersReducedMotion.current
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } }

  return (
    <div className="ds-bg-mesh min-h-screen flex items-center justify-center px-4 py-16 text-theme-primary">
      <div className="absolute top-6 right-6 z-50">
        <LanguagePicker />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <motion.div {...motionProps}>
          <div className="ds-surface-elevated p-7 sm:p-10">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex flex-col items-center text-center mb-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-[var(--border-subtle)] mb-4">
                <ClickLogo size={32} />
              </span>
              <h1 className="ds-text-h1 text-theme-primary">Meet Click</h1>
              <p className="ds-text-body text-theme-muted mt-2 max-w-md">
                {niche
                  ? `Tuned for ${nicheLabel(niche)} creators — Click gets sharper with every post you ship.`
                  : 'Click learns your niche on signup and gets sharper with every post you ship.'}
              </p>

              {/* Plan teaser — confirms the picked plan / nudges free users. */}
              {selectedPlan && selectedPlan.id !== 'free' ? (
                <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-500/10 border border-[var(--border-subtle)]">
                  <span className="ds-text-caption text-theme-muted">You picked</span>
                  <span className="ds-text-label text-theme-primary">
                    {selectedPlan.name} · ${periodFromUrl === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly}/{periodFromUrl === 'yearly' ? 'yr' : 'mo'}
                  </span>
                  <Link href="/#pricing" className="ds-text-caption text-indigo-500 hover:text-indigo-400 underline underline-offset-4">Change</Link>
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-[var(--border-subtle)]">
                  <span className="ds-text-caption text-theme-muted">Starting on Free</span>
                  <Link href="/#pricing" className="ds-text-caption text-indigo-500 hover:text-indigo-400 underline underline-offset-4">See Pro &amp; Agency</Link>
                </div>
              )}
            </div>

            {/* ── Step indicator ─────────────────────────────────────── */}
            <div className="mb-8" aria-label={`Step ${step} of 2`}>
              <div className="flex items-center justify-between mb-2">
                <span className="ds-text-caption text-theme-muted">Step {step} of 2</span>
                <span className="ds-text-caption text-theme-muted">
                  {step === 1 ? 'Create your account' : 'Personalize Click'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-500',
                      s <= step ? accentBg : 'bg-accent'
                    )}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 ds-text-caption text-rose-500" role="alert">
                {error}
              </div>
            )}

            {/* ── Step 1: Credentials ────────────────────────────────── */}
            {step === 1 && (
              <>
              <form onSubmit={handleContinue} className="space-y-5">
                <FormField label="Name" name="name" type="text" value={name} onChange={setName} placeholder="Jane Doe" required autoFocus />
                <FormField label="Email" name="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                {gated && (
                  <FormField label="Invite code" name="inviteCode" type="text" value={inviteCode} onChange={setInviteCode} placeholder="Enter your beta invite code" />
                )}

                <div className="space-y-3">
                  <FormField label="Password" name="password" type="password" value={password} onChange={handlePasswordChange} placeholder="••••••••••••" required showPasswordToggle />
                  <AnimatePresence>
                    {passwordValidation && password.length > 0 && (
                      <motion.div
                        initial={prefersReducedMotion.current ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={prefersReducedMotion.current ? undefined : { opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-3 px-1">
                          <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-[width] duration-300',
                                passwordValidation.strength === 'strong' ? 'bg-emerald-500 w-full'
                                  : passwordValidation.strength === 'good' ? 'bg-indigo-500 w-3/4'
                                    : passwordValidation.strength === 'fair' ? 'bg-amber-500 w-1/2'
                                      : 'bg-rose-500 w-1/4'
                              )}
                            />
                          </div>
                          <span className="ds-text-caption text-theme-muted capitalize">{passwordValidation.strength}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <label className="flex items-start gap-3 cursor-pointer pt-1">
                  <span className="relative flex items-center justify-center w-5 h-5 mt-0.5">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer peer"
                    />
                    <span className="w-5 h-5 rounded-md border border-[var(--border-subtle)] bg-background flex items-center justify-center peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-colors">
                      {acceptedTerms && <Check size={14} className="text-white" aria-hidden />}
                    </span>
                  </span>
                  <span className="ds-text-caption text-theme-muted leading-relaxed">
                    I accept the{' '}
                    <Link href="/terms" target="_blank" className="text-theme-primary underline underline-offset-4">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" target="_blank" className="text-theme-primary underline underline-offset-4">Privacy Policy</Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!step1Valid}
                  className={cn('w-full h-12 rounded-xl font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2', accentBg)}
                >
                  Continue
                  <ArrowRight size={18} aria-hidden />
                </button>
              </form>

              {/* Trust strip — same reassurance the login screen gives. */}
              <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-[var(--border-subtle)]">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Lock size={16} className="text-emerald-500" aria-hidden />
                  <span className="ds-text-caption text-theme-muted leading-tight">256-bit encrypted</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <ShieldCheck size={16} className="text-indigo-500" aria-hidden />
                  <span className="ds-text-caption text-theme-muted leading-tight">Bcrypt + JWT</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Check size={16} className="text-fuchsia-500" aria-hidden />
                  <span className="ds-text-caption text-theme-muted leading-tight">Never stored</span>
                </div>
              </div>
              </>
            )}

            {/* ── Step 2: Personalization ────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-8">
                {/* Niche picker */}
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                      <Target size={18} aria-hidden />
                    </span>
                    <div>
                      <h3 className="ds-text-h3 text-theme-primary">What do you create?</h3>
                      <p className="ds-text-caption text-theme-muted">Click tunes every edit to your niche&apos;s real playbook.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
                    {NICHE_OPTIONS.map((opt) => {
                      const selected = niche === opt.value
                      const OptIcon = opt.icon
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => setNiche(selected ? '' : opt.value)}
                          aria-pressed={selected}
                          className={cn(
                            'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
                            selected
                              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-500'
                              : 'border-[var(--border-subtle)] text-theme-secondary hover:bg-accent hover:text-theme-primary'
                          )}
                        >
                          <OptIcon size={20} aria-hidden />
                          <span className="ds-text-label">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Real, sourced blurb for the selected niche. */}
                  <AnimatePresence mode="wait">
                    {niche && (
                      <motion.p
                        key={niche}
                        initial={prefersReducedMotion.current ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={prefersReducedMotion.current ? undefined : { opacity: 0 }}
                        className="ds-text-caption text-theme-muted mt-3 px-1"
                      >
                        {NICHE_OPTIONS.find((o) => o.value === niche)?.blurb}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Platform focus (multi-select) */}
                <div>
                  <h3 className="ds-text-label text-theme-primary mb-3">Where do you post? <span className="ds-text-caption text-theme-muted font-normal">(pick any)</span></h3>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_OPTIONS.map((p) => {
                      const selected = platforms.includes(p.value)
                      return (
                        <button
                          type="button"
                          key={p.value}
                          onClick={() => togglePlatform(p.value)}
                          aria-pressed={selected}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 ds-text-caption transition-colors',
                            selected
                              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-500'
                              : 'border-[var(--border-subtle)] text-theme-secondary hover:bg-accent hover:text-theme-primary'
                          )}
                        >
                          {selected && <Check size={13} aria-hidden />}
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Primary goal */}
                <div>
                  <h3 className="ds-text-label text-theme-primary mb-3">What&apos;s your #1 goal?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {GOAL_OPTIONS.map((g) => {
                      const selected = goal === g.value
                      const GoalIcon = g.icon
                      return (
                        <button
                          type="button"
                          key={g.value}
                          onClick={() => setGoal(selected ? '' : g.value)}
                          aria-pressed={selected}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                            selected
                              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-500'
                              : 'border-[var(--border-subtle)] text-theme-secondary hover:bg-accent hover:text-theme-primary'
                          )}
                        >
                          <GoalIcon size={18} aria-hidden />
                          <span className="ds-text-label">{g.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(1) }}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl border border-[var(--border-subtle)] ds-text-label text-theme-secondary hover:bg-accent transition-colors disabled:opacity-50 w-full sm:w-auto"
                  >
                    <ArrowLeft size={18} aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => submitRegistration(false)}
                    disabled={loading}
                    className={cn('flex-1 h-12 rounded-xl font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2 w-full', accentBg)}
                  >
                    {loading ? (
                      <><RefreshCw className="animate-spin" size={18} aria-hidden /> Creating account…</>
                    ) : (
                      <>Create account <ChevronRight size={18} aria-hidden /></>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => submitRegistration(true)}
                  disabled={loading}
                  className="w-full text-center ds-text-caption text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-50"
                >
                  Skip for now — set this up later
                </button>
              </div>
            )}

            {/* ── Footer ─────────────────────────────────────────────── */}
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] text-center">
              <p className="ds-text-caption text-theme-muted">
                {t('auth.hasAccount')}{' '}
                <Link href="/login" className="text-indigo-500 hover:text-indigo-400 underline underline-offset-4 ml-1">
                  {t('auth.signIn') || 'Sign in'}
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
