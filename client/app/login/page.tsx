'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, setTokens, clearAuthToken, handleApiError } from '../../lib/api'
import { safeNextPath } from '../../lib/authRedirect'
import { Button, Card, FormField, Input, Icon, AuthShell } from '../../components/ui'
import LanguagePicker from '../../components/LanguagePicker'
import { useTranslation } from '../../hooks/useTranslation'
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import ClickLogo from '../../components/ClickLogo'

interface LoginResponse {
  data?: {
    token?: string
    refreshToken?: string
    requiresTwoFactor?: boolean
    tempToken?: string
    backupCodesRemaining?: number
  }
  token?: string
  refreshToken?: string
}

/** Where to go after signing in: ?next= when it's a safe same-site path. */
function destination(): string {
  if (typeof window === 'undefined') return '/dashboard'
  return safeNextPath(new URLSearchParams(window.location.search).get('next'))
}

function friendlyError(err: any): string {
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.name === 'DatabaseTimeoutError') {
    return 'The server is taking a while to respond. It may be waking up — please try again in a moment.'
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
    return 'Can\'t reach Click right now. Check your connection and try again.'
  }
  return handleApiError(err) || 'Something went wrong. Please try again.'
}

export default function Login() {
  const { t } = useTranslation()
  const router = useRouter()
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [slowHint, setSlowHint] = useState(false)
  // Until React has hydrated, a submit would be a native form submission.
  // Keep the buttons disabled until then (and the forms are method="post"),
  // so credentials can never end up in the URL, history, or server logs.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

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

  function finish(res: LoginResponse) {
    const token = res.data?.token || res.token
    const refreshToken = res.data?.refreshToken || res.refreshToken
    if (!token) {
      setError('Signed in, but no session was returned. Please try again.')
      return false
    }
    setTokens(token, refreshToken)
    router.replace(destination())
    return true
  }

  async function run(fn: () => Promise<void>) {
    setError('')
    setLoading(true)
    setSlowHint(false)
    // Reassure on a cold start (free-tier servers can take a while to wake)
    // instead of only explaining it after a timeout error.
    const slowTimer = setTimeout(() => setSlowHint(true), 8000)
    try {
      await fn()
    } finally {
      clearTimeout(slowTimer)
      setSlowHint(false)
      setLoading(false)
    }
  }

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault()
    // Password managers sometimes fill the DOM without firing onChange.
    const emailToUse = email || (document.getElementById('field-email') as HTMLInputElement | null)?.value || ''
    const passwordToUse = password || (document.getElementById('field-password') as HTMLInputElement | null)?.value || ''
    if (!emailToUse || !passwordToUse) {
      setError('Enter your email and password.')
      return
    }
    run(async () => {
      try {
        const res = await apiPost<LoginResponse>('/auth/login', { email: emailToUse, password: passwordToUse })
        if (res.data?.requiresTwoFactor && res.data.tempToken) {
          setTempToken(res.data.tempToken)
          setCode('')
          setStep('code')
          return
        }
        finish(res)
      } catch (err) {
        setError(friendlyError(err))
      }
    })
  }

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Enter the 6-digit code from your authenticator app, or a backup code.')
      return
    }
    run(async () => {
      try {
        const res = await apiPost<LoginResponse>('/auth/2fa/verify', { tempToken, token: code.trim() })
        const left = res.data?.backupCodesRemaining
        if (typeof left === 'number') setNotice(`Backup code used. ${left} left.`)
        finish(res)
      } catch (err: any) {
        if (err?.response?.data?.code === 'TWO_FACTOR_EXPIRED') {
          setStep('password')
          setPassword('')
        }
        setError(friendlyError(err))
      }
    })
  }

  const backToPassword = () => {
    setStep('password')
    setCode('')
    setTempToken('')
    setError('')
  }

  return (
    <AuthShell width="md" corner={<LanguagePicker />}>
      <Card variant="elevated" className="p-8 sm:p-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
            <ClickLogo size={40} />
          </div>
          {step === 'password' ? (
            <>
              <h1 className="ds-text-h1 text-theme-primary">Welcome back</h1>
              <p className="ds-text-body text-theme-secondary">
                Your style profile, drafts, and every learned pick are right where you left them.
              </p>
            </>
          ) : (
            <>
              <h1 className="ds-text-h1 text-theme-primary">Check your authenticator</h1>
              <p className="ds-text-body text-theme-secondary">
                Enter the 6-digit code for Click from your authenticator app.
              </p>
            </>
          )}
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="login-error"
            className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-medium text-rose-500"
          >
            <Icon icon={AlertCircle} size="sm" className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}
        {notice && !error && (
          <p role="status" className="text-center text-sm text-theme-secondary">{notice}</p>
        )}

        {step === 'password' ? (
          <form method="post" onSubmit={handlePassword} className="space-y-5" noValidate data-testid="login-password-step">
            <FormField label="Email" htmlFor="field-email">
              <Input
                id="field-email"
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
                error={!!error}
                aria-invalid={!!error}
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="field-password" className="ds-text-label text-theme-secondary">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="field-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  className="pr-11"
                  error={!!error}
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-theme-muted hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size="sm" />
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!hydrated} className="w-full">
              {loading ? 'Signing in…' : t('auth.login')}
            </Button>
          </form>
        ) : (
          <form method="post" onSubmit={handleCode} className="space-y-5" noValidate data-testid="login-code-step">
            <FormField label="Authentication code" htmlFor="field-code" hint="Lost your phone? Enter one of your backup codes instead.">
              <Input
                id="field-code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456"
                inputMode="text"
                autoComplete="one-time-code"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                maxLength={16}
                className="text-center text-lg tracking-[0.3em]"
                error={!!error}
                aria-invalid={!!error}
              />
            </FormField>
            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!hydrated} className="w-full">
              {loading ? 'Checking…' : 'Verify and sign in'}
            </Button>
            <button
              type="button"
              onClick={backToPassword}
              className="block w-full text-center text-sm text-theme-muted hover:text-theme-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Use a different account
            </button>
          </form>
        )}

        {loading && slowHint && (
          <p className="text-center text-xs text-theme-muted" role="status" aria-live="polite">
            Still working… the server may be waking up (this can take up to a minute).
          </p>
        )}

        {/* What actually protects the account — plain words, all true. */}
        <ul className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={Lock} size="sm" className="text-emerald-500" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">Encrypted connection</span>
          </li>
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={KeyRound} size="sm" className="text-primary" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">Passwords stored only as salted hashes</span>
          </li>
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={step === 'code' ? ShieldCheck : Smartphone} size="sm" className="text-fuchsia-500" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">Optional two-step sign-in</span>
          </li>
        </ul>

        <p className="text-center text-sm text-theme-muted">
          {t('auth.noAccount')}{' '}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('auth.register')}
          </Link>
        </p>
      </Card>
    </AuthShell>
  )
}
