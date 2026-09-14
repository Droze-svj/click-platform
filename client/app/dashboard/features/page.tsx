'use client'

import FeaturesDashboard from '../../../components/features/FeaturesDashboard'
import { PageShell } from '../../../components/ui'

/**
 * Creator tools — the 2026 feature dashboard (calendar autofill, comment triage,
 * AI reply approval, streak + weekly digest). Inherits the authenticated
 * dashboard shell from app/dashboard/layout.tsx.
 */
export default function FeaturesPage() {
  return (
    <PageShell>
      <header>
        {/* Was text-white on the h1 and text-zinc-400 on the copy, both
            hardcoded — this header was near-invisible in light theme. */}
        <h1 className="ds-text-h1 text-theme-primary">Creator tools</h1>
        <p className="ds-text-caption mt-1">
          Fill your calendar at the best times, triage your comment inbox, and approve AI-drafted replies — all in one place.
        </p>
      </header>
      <FeaturesDashboard />
    </PageShell>
  )
}
