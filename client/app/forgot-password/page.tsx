'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiPost, handleApiError } from '../../lib/api'
import FormField from '../../components/FormField'
import { CheckCircle2, ArrowLeft, Mail } from 'lucide-react'
import ClickLogo from '../../components/ClickLogo'

/**
 * Forgot-password flow.
 *
 * Posts to /api/auth/forgot-password (already implemented server-side).
 * Always shows a success message regardless of whether the email
 * existed — this is the standard practice to prevent account
 * enumeration attacks. The server still only sends the reset email
 * to real accounts; the UI just never tells the attacker.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter the email address on your Click account.')
      return
    }
    setLoading(true)
    try {
      await apiPost('/auth/forgot-password', { email: email.trim() })
    } catch (err) {
      // We deliberately don't surface server errors to the user here.
      // If the email is malformed the server returns 400; otherwise we
      // always show the same success state. Account-enumeration safe.
      // The handleApiError call is kept so dev tooling sees the cause.
      handleApiError(err)
    } finally {
      setLoading(false)
      setSubmitted(true)
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
              {submitted ? 'Check your email' : 'Reset your password'}
            </h1>
            <p className="text-sm text-surface-500 dark:text-slate-400 leading-relaxed">
              {submitted
                ? 'If an account exists for that email, we just sent a reset link. It expires in 1 hour — check spam if it doesn’t show up.'
                : 'Enter the email address on your Click account and we’ll send you a link to set a new password.'}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Reset link sent to <strong>{email}</strong>. Click the link in the email to set a new password.
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full text-center py-3.5 rounded-2xl bg-surface-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:bg-primary-500 hover:text-white transition-colors"
              >
                Back to sign in
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
                label="Email"
                name="email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-xs text-surface-400 dark:text-slate-500">
                Remember it after all?{' '}
                <Link href="/login" className="text-primary-500 hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
