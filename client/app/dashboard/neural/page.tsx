'use client'

/**
 * /dashboard/neural — trend intelligence and success prediction.
 *
 * NeuralStrategyHub reads GET /api/video/neural/trends and scores a concept
 * through POST /api/video/neural/predict-success. Both are live; nothing
 * imported the component, so neither was reachable. Distinct from
 * /dashboard/strategist, which calls no endpoints of its own.
 */

import NeuralStrategyHub from '../../../components/NeuralStrategyHub'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { PageShell } from '../../../components/ui'

export default function NeuralStrategyPage() {
  return (
    <PageShell width="wide" flush>
      <ErrorBoundary>
        <NeuralStrategyHub />
      </ErrorBoundary>
    </PageShell>
  )
}
