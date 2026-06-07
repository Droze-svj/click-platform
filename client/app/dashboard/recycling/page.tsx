'use client'

import { useEffect } from 'react'
import EntropyReversalNode from '../../../components/ContentRecyclingDashboard'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import SectionHeader from '../../../components/dashboard/SectionHeader'
import { Recycle } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

export default function ContentRemixPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  if (!user) return null

  return (
    <div className="min-h-screen ds-bg-mesh-soft text-theme-primary">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <SectionHeader
          tone="publish"
          icon={Recycle}
          kicker={t('recyclingPage.kicker')}
          title={t('recyclingPage.title')}
          subtitle={t('recyclingPage.subtitle')}
        />
        <EntropyReversalNode />
      </div>
    </div>
  )
}
