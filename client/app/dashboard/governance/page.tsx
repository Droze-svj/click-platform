'use client'

import React from 'react'
import EnterpriseGovernance from '../../../components/EnterpriseGovernance'
import { GovernanceDashboard } from '../../../components/editor/views/GovernanceDashboard'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import PlatformErrorBoundary from '@/components/ErrorBoundary'
import { PageShell } from '../../../components/ui'

export default function GovernancePage() {
  return (
    <PlatformErrorBoundary>
      <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen ds-anim-fade-in">
        <EnterpriseGovernance />

        {/* The live governance ledger (GET /api/sovereign/ledger). This page
            previously rendered EnterpriseGovernance alone, which makes no API
            calls at all — so the only real data on the governance surface came
            from a component nothing imported. */}
        <ErrorBoundary>
          <GovernanceDashboard />
        </ErrorBoundary>
      </PageShell>
    </PlatformErrorBoundary>
  )
}
