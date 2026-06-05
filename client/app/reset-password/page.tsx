'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost, handleApiError } from '../../lib/api'
import FormField from '../../components/FormField'
import { CheckCircle2, ArrowLeft, Lock } from 'lucide-react'
import ClickLogo from '../../components/ClickLogo'

/**
 * Reset-password flow. Reached from the link in the password-reset email
 * (/reset-password?token=...). Posts { token, newPassword } to
 * /api/auth/reset-password (already implemented server-side, token is a
 * 1-hour JWT of type "password_reset").
 */
function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('This reset link is missing its token. Request a new link from “Forgot password”.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setLoading(true)
    try {
      await apiPost('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      setError(handleApiError(err) || 'That reset link is invalid or has expired. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-page flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-md space-y-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-bold text-surface-500 dark:text-slate-400 hover:text-primary-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <div className="bg-surface-card border-2 border-surface-100 dark:border-white/5 rounded-[3rem] p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-surface-page dark:bg-black/40 border-2 border-surface-100 dark:border-white/10 flex items-center justify-center">
              <ClickLogo size={36} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
              {done ? 'Password updated' : 'Set a new password'}
            </h1>
            <p className="text-sm text-surface-500 dark:text-slate-400 leading-relaxed">
              {done
                ? 'Your password has been reset. Redirecting you to sign in…'
                : 'Choose a new password for your Click account.'}
            </p>
          </div>

          {done ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  All set — you can now sign in with your new password.
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full text-center py-3.5 rounded-2xl bg-surface-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-primary-500 hover:text-white transition-colors"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 text-xs">
                  {error}
                </div>
              )}
              <FormField
                label="New password"
                name="password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                required
                autoFocus
              />
              <FormField
                label="Confirm new password"
                name="confirm"
                type="password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Re-enter your new password"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Updating…' : 'Update password'}
              </button>
              <p className="text-center text-xs text-surface-400 dark:text-slate-500">
                Need a new link?{' '}
                <Link href="/forgot-password" className="text-primary-500 hover:underline">Request reset</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-surface-page" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
