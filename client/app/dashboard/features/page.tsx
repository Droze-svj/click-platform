'use client'

import FeaturesDashboard from '../../../components/features/FeaturesDashboard'

/**
 * Creator tools — the 2026 feature dashboard (calendar autofill, comment triage,
 * AI reply approval, streak + weekly digest). Inherits the authenticated
 * dashboard shell from app/dashboard/layout.tsx.
 */
export default function FeaturesPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-white">Creator tools</h1>
        <p className="text-sm text-zinc-400">
          Fill your calendar at the best times, triage your comment inbox, and approve AI-drafted replies — all in one place.
        </p>
      </header>
      <FeaturesDashboard />
    </div>
  )
}
