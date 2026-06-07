'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost, handleApiError } from '../../lib/api'
import { Button, Card, FormField, Input, Icon } from '../../components/ui'
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
              {done ? 'Password updated' : 'Set a new password'}
            </h1>
            <p className="ds-text-body text-theme-secondary">
              {done
                ? 'Your password has been reset. Redirecting you to sign in…'
                : 'Choose a new password for your Click account.'}
            </p>
          </div>

          {done ? (
            <div className="space-y-6">
              <div
                role="status"
                className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <Icon icon={CheckCircle2} size="md" className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  All set — you can now sign in with your new password.
                </p>
              </div>
              <Link href="/login" className="block">
                <Button variant="primary" size="lg" className="w-full">
                  Go to sign in
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
              <FormField label="New password" htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  autoFocus
                  error={!!error}
                  aria-invalid={!!error}
                />
              </FormField>
              <FormField label="Confirm new password" htmlFor="confirm" required>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
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
                leftIcon={<Lock className="h-4 w-4" />}
                className="w-full"
              >
                {loading ? 'Updating…' : 'Update password'}
              </Button>
              <p className="text-center text-sm text-theme-muted">
                Need a new link?{' '}
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Request reset
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen ds-bg-mesh" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
