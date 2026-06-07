'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiPost, handleApiError } from '../../lib/api'
import { Button, Card, FormField, Input, Icon } from '../../components/ui'
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
    <main className="min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 ds-anim-rise">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 ds-text-label text-theme-muted hover:text-theme-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Icon icon={ArrowLeft} size="sm" /> Back to sign in
        </Link>

        <Card variant="elevated" className="p-8 sm:p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
              <ClickLogo size={36} />
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              {submitted ? 'Check your email' : 'Reset your password'}
            </h1>
            <p className="ds-text-body text-theme-secondary">
              {submitted
                ? 'If an account exists for that email, we just sent a reset link. It expires in 1 hour — check spam if it doesn’t show up.'
                : 'Enter the email address on your Click account and we’ll send you a link to set a new password.'}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-6">
              <div
                role="status"
                className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <Icon icon={CheckCircle2} size="md" className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Reset link sent to <strong>{email}</strong>. Click the link in the email to set a new password.
                </p>
              </div>
              <Link href="/login" className="block">
                <Button variant="primary" size="lg" className="w-full">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {error && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-medium text-rose-500"
                >
                  {error}
                </div>
              )}
              <FormField label="Email" htmlFor="email" required>
                <Input
                  id="email"
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                leftIcon={<Mail className="h-4 w-4" />}
                className="w-full"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              <p className="text-center text-sm text-theme-muted">
                Remember it after all?{' '}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  )
}
