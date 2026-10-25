'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost, handleApiError } from '../../lib/api'
import { Button, Card, FormField, Input, Icon, AuthShell } from '../../components/ui'
import { CheckCircle2, ArrowLeft, Lock } from 'lucide-react'
import ClickLogo from '../../components/ClickLogo'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Reset-password flow. Reached from the link in the password-reset email
 * (/reset-password?token=...). Posts { token, newPassword } to
 * /api/auth/reset-password (already implemented server-side, token is a
 * 1-hour JWT of type "password_reset").
 */
function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
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
      setError(t('resetPasswordPage.errNoToken'))
      return
    }
    if (password.length < 8) {
      setError(t('resetPasswordPage.errLength'))
      return
    }
    if (password !== confirm) {
      setError(t('resetPasswordPage.errMismatch'))
      return
    }
    setLoading(true)
    try {
      await apiPost('/auth/reset-password', { token, newPassword: password })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      setError(handleApiError(err) || t('resetPasswordPage.errInvalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell width="md" contentClassName="space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 ds-text-label text-theme-muted hover:text-theme-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Icon icon={ArrowLeft} size="sm" /> {t('forgotPasswordPage.backToSignIn')}
        </Link>

        <Card variant="elevated" className="p-8 sm:p-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
              <ClickLogo size={36} />
            </div>
            <h1 className="ds-text-h1 text-theme-primary">
              {done ? t('resetPasswordPage.titleDone') : t('resetPasswordPage.title')}
            </h1>
            <p className="ds-text-body text-theme-secondary">
              {done
                ? t('resetPasswordPage.subtitleDone')
                : t('resetPasswordPage.subtitle')}
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
                  {t('resetPasswordPage.allSet')}
                </p>
              </div>
              <Link href="/login" className="block">
                <Button variant="primary" size="lg" className="w-full">
                  {t('resetPasswordPage.goToSignIn')}
                </Button>
              </Link>
            </div>
          ) : (
            <form method="post" onSubmit={handleSubmit} className="space-y-6" noValidate>
              {error && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-medium text-rose-500"
                >
                  {error}
                </div>
              )}
              <FormField label={t('resetPasswordPage.newPassword')} htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('resetPasswordPage.newPasswordPlaceholder')}
                  autoComplete="new-password"
                  required
                  autoFocus
                  error={!!error}
                  aria-invalid={!!error}
                />
              </FormField>
              <FormField label={t('resetPasswordPage.confirm')} htmlFor="confirm" required>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('resetPasswordPage.confirmPlaceholder')}
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
                {loading ? t('resetPasswordPage.updating') : t('resetPasswordPage.update')}
              </Button>
              <p className="text-center text-sm text-theme-muted">
                {t('resetPasswordPage.needLink')}{' '}
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('resetPasswordPage.requestReset')}
                </Link>
              </p>
            </form>
          )}
        </Card>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen ds-bg-mesh" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
