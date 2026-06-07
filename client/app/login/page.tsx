'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiPost, setTokens, clearAuthToken, handleApiError } from '../../lib/api'
import { Button, Card, FormField, Input, Icon } from '../../components/ui'
import LanguagePicker from '../../components/LanguagePicker'
import { useTranslation } from '../../hooks/useTranslation'
import { AlertCircle, Lock, ShieldCheck, Sparkles } from 'lucide-react'
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
    <div className="min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12">
      <div className="absolute top-6 right-6 z-50">
        <LanguagePicker />
      </div>

      <div className="w-full max-w-md ds-anim-rise">
        <Card variant="elevated" className="p-8 sm:p-10 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
              <ClickLogo size={40} />
            </div>
            <h1 className="ds-text-h1 text-theme-primary">Welcome back</h1>
            <p className="ds-text-body text-theme-secondary">
              Your style profile, drafts, and every learned pick are right where you left them.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-medium text-rose-500"
            >
              <Icon icon={AlertCircle} size="sm" className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <FormField label="Email" htmlFor="field-email" required>
              <Input
                id="field-email"
                name="email"
                type="email"
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

            <FormField
              label={
                <span className="flex items-center justify-between gap-2">
                  <span>Password</span>
                  {/* Forgot-password affordance — recovery path for users who
                      can't remember their password, backed by the server's
                      /auth/forgot-password + /auth/reset-password routes. */}
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Forgot password?
                  </Link>
                </span>
              }
              htmlFor="field-password"
              required
              className="[&_label]:w-full"
            >
              <Input
                id="field-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                error={!!error}
                aria-invalid={!!error}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {loading ? 'Signing in…' : t('auth.login')}
            </Button>
          </form>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex flex-col items-center gap-1.5 text-center pt-4">
              <Icon icon={Lock} size="sm" className="text-emerald-500" aria-hidden="true" />
              <span className="text-xs text-theme-muted leading-tight">256-bit encrypted</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center pt-4">
              <Icon icon={ShieldCheck} size="sm" className="text-primary" aria-hidden="true" />
              <span className="text-xs text-theme-muted leading-tight">Bcrypt + JWT refresh</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center pt-4">
              <Icon icon={Sparkles} size="sm" className="text-fuchsia-500" aria-hidden="true" />
              <span className="text-xs text-theme-muted leading-tight">Passwords never stored</span>
            </div>
          </div>

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
      </div>
    </div>
  )
}
