'use client'

import ComplianceDashboard from '../../../components/ComplianceDashboard'
import { Shield } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { SectionHeader } from '../../../components/ui'

export default function CompliancePage() {
  const { t } = useTranslation()
  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto text-theme-primary ds-anim-fade-in">
      <SectionHeader
        as="h1"
        title={
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield size={20} aria-hidden />
            </span>
            {t('compliancePage.title')}
          </span>
        }
        description={t('compliancePage.subtitle')}
        className="mb-6"
      />
      <ComplianceDashboard />
    </div>
  )
}
