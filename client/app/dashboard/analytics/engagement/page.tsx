'use client'

import dynamic from 'next/dynamic'
import { Brain } from 'lucide-react'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'

const ResonanceCommandMatrix = dynamic(
  () => import('../../../../components/EngagementCommandCenter'),
  { ssr: false, loading: () => (
    <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center gap-4">
      <Brain size={48} className="text-indigo-500 motion-safe:animate-pulse" aria-hidden />
      <span className="ds-text-caption">Loading…</span>
    </div>
  )}
)

export default function ResonanceCommandMatrixPage() {
  useTranslation()

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen overflow-x-hidden text-theme-primary">
        <ResonanceCommandMatrix />
      </div>
    </ErrorBoundary>
  )
}
