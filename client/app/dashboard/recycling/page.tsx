'use client'

import { useEffect } from 'react'
import EntropyReversalNode from '../../../components/ContentRecyclingDashboard'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import SectionHeader from '../../../components/dashboard/SectionHeader'
import { Recycle } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { PageShell } from '../../../components/ui'

export default function ContentRemixPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  if (!user) return null

  return (
    <PageShell width="wide" className="min-h-screen ds-bg-mesh-soft">
        <SectionHeader
          tone="publish"
          icon={Recycle}
          kicker={t('recyclingPage.kicker')}
          title={t('recyclingPage.title')}
          subtitle={t('recyclingPage.subtitle')}
        />
        <EntropyReversalNode />
    </PageShell>
  )
}
