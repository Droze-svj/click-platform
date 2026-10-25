'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../hooks/useAuth'
import { AuthShell } from '../../../components/ui'
import { useTranslation } from '@/hooks/useTranslation'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [processing, setProcessing] = useState(false)
  // t changes identity once translations load; accept the invite only once.
  const startedRef = useRef(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Keep the token so the login page can bring the user back here even
      // if `next` is lost (e.g. they register first, then sign in). The login
      // page reads `next` — this used to send `redirect`, which it ignored, so
      // a signed-out invitee landed on the dashboard and the invite was lost.
      if (token) {
        try { sessionStorage.setItem('pendingInviteToken', token) } catch { /* storage blocked */ }
      }
      const back = `/teams/accept${token ? `?token=${encodeURIComponent(token)}` : ''}`
      router.push(`/login?next=${encodeURIComponent(back)}`)
      return
    }

    if (!token) {
      showToast(t('teamAcceptPage.noToken'), 'error')
      router.push('/dashboard/teams')
      return
    }

    if (startedRef.current) return
    startedRef.current = true

    const acceptInvite = async () => {
      setProcessing(true)
      try {
        const res = await apiPost('/teams/accept-invitation', { token })
        showToast(t('teamAcceptPage.joined'), 'success')

        const team = (res as any)?.data
        if (team?._id) {
          router.push(`/dashboard/teams/${team._id}`)
        } else {
          router.push('/dashboard/teams')
        }
      } catch (err: any) {
        showToast(err?.response?.data?.error || t('teamAcceptPage.failed'), 'error')
        router.push('/dashboard/teams')
      } finally {
        // Used either way: don't send the user back here on every sign-in.
        try { sessionStorage.removeItem('pendingInviteToken') } catch { /* storage blocked */ }
        setProcessing(false)
      }
    }

    acceptInvite()
  }, [token, user, authLoading, router, showToast, t])

  return (
    // Was bg-gray-50/dark:bg-gray-900 hardcoded, so it ignored the theme tokens
    // every other signed-out page uses; AuthShell supplies ds-bg-mesh.
    <AuthShell contentClassName="text-center">
      <div>
        <LoadingSpinner size="lg" text={t('teamAcceptPage.processing')} />
        <p className="mt-4 text-theme-muted">
          {t('teamAcceptPage.body')}
        </p>
      </div>
    </AuthShell>
  )
}
