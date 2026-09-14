'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../hooks/useAuth'
import { AuthShell } from '../../../components/ui'

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // Store token in session storage to resume after login
      if (token) {
        sessionStorage.setItem('pendingInviteToken', token)
      }
      router.push(`/login?redirect=/teams/accept${token ? `?token=${token}` : ''}`)
      return
    }

    if (!token) {
      showToast('No invitation token found', 'error')
      router.push('/dashboard/teams')
      return
    }

    const acceptInvite = async () => {
      setProcessing(true)
      try {
        const res = await apiPost('/teams/accept-invitation', { token })
        showToast('Successfully joined the team!', 'success')

        // Clear stored token
        sessionStorage.removeItem('pendingInviteToken')

        const team = (res as any)?.data
        if (team?._id) {
          router.push(`/dashboard/teams/${team._id}`)
        } else {
          router.push('/dashboard/teams')
        }
      } catch (err: any) {
        showToast(err?.response?.data?.error || 'Failed to accept invitation', 'error')
        router.push('/dashboard/teams')
      } finally {
        setProcessing(false)
      }
    }

    acceptInvite()
  }, [token, user, authLoading, router, showToast])

  return (
    // Was bg-gray-50/dark:bg-gray-900 hardcoded, so it ignored the theme tokens
    // every other signed-out page uses; AuthShell supplies ds-bg-mesh.
    <AuthShell contentClassName="text-center">
      <div>
        <LoadingSpinner size="lg" text="Processing your invitation..." />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          We're adding you to the team. This will only take a moment.
        </p>
      </div>
    </AuthShell>
  )
}
