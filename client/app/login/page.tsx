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

/**
 * Where to go after signing in: ?next= when it's a safe same-site path;
 * otherwise back to a team invitation the user opened while signed out
 * (stored by /teams/accept), so the invite is still accepted.
 */
function destination(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  if (next) return safeNextPath(next)
  let pendingInvite: string | null = null
  try { pendingInvite = sessionStorage.getItem('pendingInviteToken') } catch { /* storage blocked */ }
  if (pendingInvite) return `/teams/accept?token=${encodeURIComponent(pendingInvite)}`
  return '/dashboard'
}

function friendlyError(err: any, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.name === 'DatabaseTimeoutError') {
    return t('loginPage.errSlow')
  }
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
    return t('loginPage.errOffline')
  }
  return handleApiError(err) || t('loginPage.errGeneric')
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
      setError(t('loginPage.errNoSession'))
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
      setError(t('loginPage.errMissing'))
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
        setError(friendlyError(err, t))
      }
    })
  }

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError(t('loginPage.errNoCode'))
      return
    }
    run(async () => {
      try {
        const res = await apiPost<LoginResponse>('/auth/2fa/verify', { tempToken, token: code.trim() })
        const left = res.data?.backupCodesRemaining
        if (typeof left === 'number') setNotice(t('loginPage.backupUsed', { count: left }))
        finish(res)
      } catch (err: any) {
        if (err?.response?.data?.code === 'TWO_FACTOR_EXPIRED') {
          setStep('password')
          setPassword('')
        }
        setError(friendlyError(err, t))
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
              <h1 className="ds-text-h1 text-theme-primary">{t('loginPage.title')}</h1>
              <p className="ds-text-body text-theme-secondary">
                {t('loginPage.subtitle')}
              </p>
            </>
          ) : (
            <>
              <h1 className="ds-text-h1 text-theme-primary">{t('loginPage.codeTitle')}</h1>
              <p className="ds-text-body text-theme-secondary">
                {t('loginPage.codeSubtitle')}
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
            <FormField label={t('auth.email')} htmlFor="field-email">
              <Input
                id="field-email"
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('loginPage.emailPlaceholder')}
                autoComplete="email"
                required
                autoFocus
                error={!!error}
                aria-invalid={!!error}
              />
            </FormField>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="field-password" className="ds-text-label text-theme-secondary">{t('auth.password')}</label>
                {/* inline-flex + items-center: on touch screens every link gets a
                    44px min-height, which pushed this text above the label. */}
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="field-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('loginPage.passwordPlaceholder')}
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
                  aria-label={showPassword ? t('loginPage.hidePassword') : t('loginPage.showPassword')}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-theme-muted hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size="sm" />
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!hydrated} className="w-full">
              {loading ? t('loginPage.signingIn') : t('auth.login')}
            </Button>
          </form>
        ) : (
          <form method="post" onSubmit={handleCode} className="space-y-5" noValidate data-testid="login-code-step">
            <FormField label={t('loginPage.codeLabel')} htmlFor="field-code" hint={t('loginPage.codeHint')}>
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
              {loading ? t('loginPage.checking') : t('loginPage.verify')}
            </Button>
            <button
              type="button"
              onClick={backToPassword}
              className="block w-full text-center text-sm text-theme-muted hover:text-theme-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('loginPage.differentAccount')}
            </button>
          </form>
        )}

        {loading && slowHint && (
          <p className="text-center text-xs text-theme-muted" role="status" aria-live="polite">
            {t('loginPage.slowHint')}
          </p>
        )}

        {/* What actually protects the account — plain words, all true. */}
        <ul className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={Lock} size="sm" className="text-emerald-500" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">{t('loginPage.trustEncrypted')}</span>
          </li>
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={KeyRound} size="sm" className="text-primary" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">{t('loginPage.trustHashed')}</span>
          </li>
          <li className="flex flex-col items-center gap-1.5 text-center pt-4">
            <Icon icon={step === 'code' ? ShieldCheck : Smartphone} size="sm" className="text-fuchsia-500" aria-hidden="true" />
            <span className="text-xs text-theme-muted leading-tight">{t('loginPage.trust2fa')}</span>
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
