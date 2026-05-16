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
import { motion } from 'framer-motion'
import { ShieldCheck, AlertCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react'
import { apiPost, setTokens } from '@/lib/api'
import ClickLogo from '@/components/ClickLogo'
import { clickVoice } from '@/lib/clickVoice'

type Phase = 'verifying' | 'verified' | 'error' | 'missing-token'

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'missing-token')
  const [errorMessage, setErrorMessage] = useState<string>('')

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
    <div className="min-h-screen flex items-center justify-center bg-surface-page text-surface-900 dark:text-white px-4 relative overflow-hidden">
      {/* Ambient backdrop — matches /login + /register so the moment feels continuous. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] bg-primary-600/10 blur-[160px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[20%] -left-[10%] w-[50%] h-[60%] bg-fuchsia-600/10 blur-[180px] rounded-full mix-blend-screen" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg bg-surface-card backdrop-blur-[60px] border-2 border-surface-100 dark:border-white/5 rounded-[3rem] p-10 sm:p-14 shadow-[0_80px_150px_rgba(0,0,0,0.6)] text-center space-y-8"
      >
        <div className="mx-auto w-20 h-20 rounded-[2rem] bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center shadow-2xl">
          <ClickLogo size={48} />
        </div>

        {phase === 'verifying' && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[10px] font-black uppercase tracking-widest text-primary-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Click is verifying you
            </div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter">Confirming your account…</h1>
            <p className="text-sm text-surface-500 dark:text-slate-500 leading-relaxed max-w-sm mx-auto">
              {clickVoice('loading.thinking')}
            </p>
          </>
        )}

        {phase === 'verified' && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Verified
            </div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter">You&apos;re in.</h1>
            <p className="text-sm text-surface-500 dark:text-slate-500 leading-relaxed max-w-sm mx-auto">
              Click recognised your email. Taking you to the dashboard…
            </p>
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Redirecting
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-400">
              <AlertCircle className="w-3 h-3" /> Verification failed
            </div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter">
              Click couldn&apos;t verify this link.
            </h1>
            <p className="text-sm text-surface-500 dark:text-slate-500 leading-relaxed max-w-sm mx-auto">
              The token may have expired or already been used. Sign in and we&apos;ll resend a fresh verification email.
            </p>
            {errorMessage && process.env.NODE_ENV === 'development' && (
              <p className="text-[10px] font-mono text-slate-700 break-all">{errorMessage}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.08] transition-all"
              >
                Create a new account
              </Link>
            </div>
          </>
        )}

        {phase === 'missing-token' && (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-400">
              <AlertCircle className="w-3 h-3" /> No token in link
            </div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter">
              That link is incomplete.
            </h1>
            <p className="text-sm text-surface-500 dark:text-slate-500 leading-relaxed max-w-sm mx-auto">
              Your email link is missing the verification token. Try opening the email again, or sign in and request a fresh one.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Go to sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </motion.div>
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
