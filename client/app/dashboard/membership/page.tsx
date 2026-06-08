'use client'

/**
 * /dashboard/membership — RECONCILED to the canonical billing surface.
 *
 * This page previously rendered its own MembershipPackage set ($19/$149 from a
 * separate Mongo collection), which conflicted with the canonical catalog used
 * by the landing page and the billing page. To kill the price discrepancy we
 * redirect here to /dashboard/billing, which renders the ONE canonical catalog
 * (GET /api/plans / lib/plans.ts) — same tiers, same prices, everywhere.
 *
 * Lower-risk than re-implementing the view: nothing can drift because there is
 * now only one pricing surface inside the dashboard.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Gem } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'

export const dynamic = 'force-dynamic'

export default function MembershipPage() {
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    router.replace('/dashboard/billing')
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center py-48 ds-bg-mesh-soft min-h-screen text-theme-primary">
      <Gem size={40} className="text-primary animate-pulse motion-reduce:animate-none mb-4" aria-hidden />
      <span className="ds-text-caption">{t('membershipPage.synchronizing')}</span>
    </div>
  )
}
