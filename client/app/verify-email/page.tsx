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
import { Button, Card, Icon, Input } from '@/components/ui'
import ClickLogo from '@/components/ClickLogo'
import { clickVoice } from '@/lib/clickVoice'

type Phase = 'verifying' | 'verified' | 'error' | 'missing-token'

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    <div className="min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12">
      <Card
        variant="elevated"
        className="relative z-10 w-full max-w-lg p-8 sm:p-12 text-center space-y-7 ds-anim-rise"
      >
        <div className="mx-auto w-20 h-20 rounded-2xl ds-surface-subtle flex items-center justify-center">
          <ClickLogo size={48} />
        </div>

        {phase === 'verifying' && (
          <div role="status" aria-live="polite" className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 ds-text-label text-primary">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying you
            </div>
            <h1 className="ds-text-h1 text-theme-primary">Confirming your account…</h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              {clickVoice('loading.thinking')}
            </p>
          </div>
        )}

        {phase === 'verified' && (
          <div role="status" aria-live="polite" className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 ds-text-label text-emerald-500">
              <Icon icon={ShieldCheck} size="sm" /> Verified
            </div>
            <h1 className="ds-text-h1 text-theme-primary">You&apos;re in.</h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              Click recognised your email. Taking you to the dashboard…
            </p>
            <div className="flex items-center justify-center gap-2 ds-text-label text-emerald-500">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Redirecting
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 ds-text-label text-rose-500">
              <Icon icon={AlertCircle} size="sm" /> Verification failed
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              Click couldn&apos;t verify this link.
            </h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              The token may have expired or already been used. Enter your email and we&apos;ll send a fresh verification link.
            </p>
            {errorMessage && process.env.NODE_ENV === 'development' && (
              <p className="text-xs font-mono text-theme-muted break-all">{errorMessage}</p>
            )}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              <Input
                type="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                aria-label="Email address to resend verification to"
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
                {resent ? 'Sent ✓ — check your inbox' : 'Resend verification email'}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
              <Link href="/login" className="block">
                <Button variant="secondary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="w-full">
                  Sign in instead
                </Button>
              </Link>
              <Link href="/register" className="block">
                <Button variant="secondary" size="lg" className="w-full">
                  Create a new account
                </Button>
              </Link>
            </div>
          </div>
        )}

        {phase === 'missing-token' && (
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 ds-text-label text-amber-500">
              <Icon icon={AlertTriangle} size="sm" /> No token in link
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              That link is incomplete.
            </h1>
            <p className="ds-text-body text-theme-secondary max-w-sm mx-auto">
              Your email link is missing the verification token. Try opening the email again, or sign in and request a fresh one.
            </p>
            <div className="pt-1">
              <Link href="/login" className="inline-block">
                <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Go to sign in
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  )
}
