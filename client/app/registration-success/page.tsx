'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, handleApiError } from '@/lib/api'
import { Button, Card, Icon } from '@/components/ui'
import { CheckCircle2, MailCheck, AlertCircle, Loader2, ArrowRight, User } from 'lucide-react'
import ClickLogo from '@/components/ClickLogo'

function RegistrationSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const verificationRequired = searchParams?.get('verification') === 'required'
  const email = searchParams?.get('email') || ''

  useEffect(() => {
    if (verificationRequired) {
      // Skip auth check if verification is required
      setLoading(false)
      return
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationRequired])

  const checkAuth = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) {
        setError('No authentication token found. Please register again.')
        setLoading(false)
        return
      }

      const response = await apiGet<any>('/auth/me')
      setUser(response?.user || response?.data?.user)
      setError('')
    } catch (err: any) {
      const errorMessage = handleApiError(err)
      setError(`Failed to verify authentication: ${errorMessage}`)

      if (process.env.NODE_ENV === 'development') {
        console.error('Auth check failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const goToDashboard = () => {
    router.push('/dashboard')
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md ds-anim-rise">
        <Card variant="elevated" className="p-8 sm:p-10 space-y-8">{children}</Card>
      </div>
    </main>
  )

  if (loading) {
    return (
      <Shell>
        <div role="status" aria-live="polite" className="text-center space-y-5 py-6">
          <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
          <h1 className="ds-text-h2 text-theme-primary">Verifying your account…</h1>
          <p className="ds-text-body text-theme-secondary">Hold tight while we confirm everything.</p>
        </div>
      </Shell>
    )
  }

  // Show email verification message if required
  if (verificationRequired) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl ds-surface-subtle flex items-center justify-center">
            <Icon icon={MailCheck} size="xl" className="text-primary" />
          </div>
          <h1 className="ds-text-h1 text-theme-primary">Check your email</h1>
          <p className="ds-text-body text-theme-secondary">
            We&apos;ve sent a verification link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-theme-muted">
            Click the link in the email to verify your account and complete registration.
          </p>
        </div>

        <div className="rounded-xl ds-surface-subtle p-4 space-y-2">
          <p className="text-sm font-semibold text-theme-primary">Didn&apos;t receive the email?</p>
          <ul className="text-sm text-theme-secondary space-y-1 list-disc list-inside">
            <li>Check your spam/junk folder</li>
            <li>Wait a few minutes for delivery</li>
            <li>Make sure you entered the correct email address</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/login')}>
            Go to login
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/register')}>
            Back to registration
          </Button>
        </div>
      </Shell>
    )
  }

  if (error && !user) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Icon icon={AlertCircle} size="xl" className="text-rose-500" />
          </div>
          <h1 className="ds-text-h1 text-theme-primary">Registration issue</h1>
          <p className="ds-text-body text-theme-secondary">{error}</p>
        </div>
        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/register')}>
            Try registering again
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/login')}>
            Go to login
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Icon icon={CheckCircle2} size="xl" className="text-emerald-500" />
        </div>
        <h1 className="ds-text-h1 text-theme-primary">Registration successful</h1>
        <p className="ds-text-body text-theme-secondary">Your account has been created.</p>
      </div>

      {user && (
        <div className="rounded-xl ds-surface-subtle p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-theme-primary">
            <Icon icon={User} size="sm" className="text-theme-muted" /> Account details
          </div>
          <dl className="space-y-1 text-sm text-theme-secondary">
            <div className="flex justify-between gap-4">
              <dt className="text-theme-muted">Name</dt>
              <dd className="text-theme-primary font-medium truncate">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-theme-muted">Email</dt>
              <dd className="text-theme-primary font-medium truncate">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-theme-muted">User ID</dt>
              <dd className="text-theme-primary font-medium truncate">{user.id}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={goToDashboard}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Go to dashboard
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/login')}>
          Go to login instead
        </Button>
      </div>

      <p className="text-center text-sm text-theme-muted">
        If the dashboard doesn&apos;t load, try signing in with your email and password.
      </p>
    </Shell>
  )
}

export default function RegistrationSuccess() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen ds-bg-mesh flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-theme-secondary">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ds-text-body">Loading…</span>
          </div>
        </main>
      }
    >
      <RegistrationSuccessContent />
    </Suspense>
  )
}
