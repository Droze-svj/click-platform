'use client'

import { loginPathForCurrentPage } from '../../../lib/authRedirect'
import { useEffect } from 'react'
import EntropyReversalNode from '../../../components/ContentRecyclingDashboard'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useTranslation } from '../../../hooks/useTranslation'
import { PageShell, SectionHeader } from '../../../components/ui'

export default function ContentRemixPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (authLoading) return // user is null until /auth/me answers
    if (!user) router.push(loginPathForCurrentPage())
  }, [user, authLoading, router])

  if (!user) return null

  return (
    <PageShell width="wide" className="min-h-screen ds-bg-mesh-soft">
        {/* Same page header as the rest of the dashboard (the legacy
            dashboard/SectionHeader used dark-only amber-300 / slate tones that
            washed out in light theme). */}
        <SectionHeader
          as="h1"
          title={t('recyclingPage.title')}
          description={t('recyclingPage.subtitle')}
        />
        <EntropyReversalNode />
    </PageShell>
  )
}
