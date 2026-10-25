'use client'

/**
 * /verify-email — the page email-verification links land on.
 *
 * The backend's POST /api/auth/register sends an email with
 * `${FRONTEND_URL}/verify-email?token=...`. Before this page existed,
 * every new user clicking that link hit a 404 — which is the absolute
 * worst onboarding moment for a paying tool. This page:
 *   1. Reads ?token=... from the URL.
 *   2. POSTs to /api/auth/verify-email.
 *   3. Stores the issued token pair via setTokens() so the user is signed
 *      in immediately on success (matches the backend behaviour, which
 *      issues a fresh pair on verify).
 *   4. Falls back to a warm error UX with a clear retry path if the
 *      token's expired or invalid.
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, AlertCircle, Loader2, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'
import { apiPost, setTokens } from '@/lib/api'
import { Button, Card, Icon, Input, AuthShell } from '@/components/ui'
import ClickLogo from '@/components/ClickLogo'
import { clickVoice } from '@/lib/clickVoice'
import { useTranslation } from '@/hooks/useTranslation'

type Phase = 'verifying' | 'verified' | 'error' | 'missing-token'

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const token = searchParams?.get('token') || ''
  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'missing-token')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    if (resending || resent || !resendEmail) return
    setResending(true)
    try {
      await apiPost('/auth/resend-verification', { email: resendEmail })
      setResent(true)
    } catch {
      // Endpoint is intentionally non-committal — let the user retry.
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await apiPost<{
          data?: { token?: string; refreshToken?: string }
          token?: string
          refreshToken?: string
        }>('/auth/verify-email', { token })
        if (cancelled) return
        const accessToken = resp.data?.token || resp.token
        const refreshToken = resp.data?.refreshToken || resp.refreshToken
        if (accessToken) {
          // Server issued a fresh token pair — sign the user straight in
          // and bounce them to the dashboard. No interstitial; the goal
          // is "click email link → land in product."
          setTokens(accessToken, refreshToken)
          setPhase('verified')
          setTimeout(() => router.push('/dashboard?welcome=1'), 1200)
        } else {
          // Verification succeeded but no token returned — older Supabase
          // path. Send the user to login with a confirmation flag.
          setPhase('verified')
          setTimeout(() => router.push('/login?verified=1'), 1200)
        }
      } catch (err: any) {
        if (cancelled) return
        const msg = err?.response?.data?.error || err?.message || 'Verification failed'
        setErrorMessage(msg)
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [token, router])

  return (
    <AuthShell width="lg">
      <Card
        variant="elevated"
        className="relative z-10 w-full p-8 sm:p-12 text-center space-y-7"
      >
        <div className="mx-auto w-20 h-20 rounded-2xl ds-surface-subtle flex items-center justify-center">
          <ClickLogo size={48} />
        </div>

        {phase === 'verifying' && (
          <div role="status" aria-live="polite" className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 ds-text-label text-primary">
              <Loader2 className="w-4 h-4 animate-spin" /> {t('verifyEmailPage.verifyingBadge')}
            </div>
            <h1 className="ds-text-h1 text-theme-primary">{t('verifyEmailPage.verifyingTitle')}</h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              {clickVoice('loading.thinking')}
            </p>
          </div>
        )}

        {phase === 'verified' && (
          <div role="status" aria-live="polite" className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 ds-text-label text-emerald-500">
              <Icon icon={ShieldCheck} size="sm" /> {t('verifyEmailPage.verifiedBadge')}
            </div>
            <h1 className="ds-text-h1 text-theme-primary">{t('verifyEmailPage.verifiedTitle')}</h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              {t('verifyEmailPage.verifiedBody')}
            </p>
            <div className="flex items-center justify-center gap-2 ds-text-label text-emerald-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('verifyEmailPage.redirecting')}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 ds-text-label text-rose-500">
              <Icon icon={AlertCircle} size="sm" /> {t('verifyEmailPage.failedBadge')}
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              {t('verifyEmailPage.failedTitle')}
            </h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              {t('verifyEmailPage.failedBody')}
            </p>
            {errorMessage && process.env.NODE_ENV === 'development' && (
              <p className="text-xs font-mono text-theme-muted break-all">{errorMessage}</p>
            )}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              <Input
                type="email"
                placeholder={t('loginPage.emailPlaceholder')}
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                aria-label={t('verifyEmailPage.emailAria')}
                autoComplete="email"
              />
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleResend}
                loading={resending}
                disabled={resending || resent || !resendEmail}
              >
                {resent ? t('verifyEmailPage.sent') : t('verifyEmailPage.resend')}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
              <Link href="/login" className="block">
                <Button variant="secondary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="w-full">
                  {t('verifyEmailPage.signInInstead')}
                </Button>
              </Link>
              <Link href="/register" className="block">
                <Button variant="secondary" size="lg" className="w-full">
                  {t('verifyEmailPage.createNew')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {phase === 'missing-token' && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 ds-text-label text-amber-500">
              <Icon icon={AlertTriangle} size="sm" /> {t('verifyEmailPage.missingBadge')}
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              {t('verifyEmailPage.missingTitle')}
            </h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              {t('verifyEmailPage.missingBody')}
            </p>
            <div className="pt-1">
              <Link href="/login" className="inline-block">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  {t('verifyEmailPage.goToSignIn')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
        </AuthShell>
  )
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  )
}
