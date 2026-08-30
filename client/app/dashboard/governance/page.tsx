'use client'

import React from 'react'
import EnterpriseGovernance from '../../../components/EnterpriseGovernance'
import PlatformErrorBoundary from '@/components/ErrorBoundary'
import { PageShell } from '../../../components/ui'

export default function GovernancePage() {
  return (
    <PlatformErrorBoundary>
      <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen ds-anim-fade-in">
        <EnterpriseGovernance />
      </PageShell>
    </PlatformErrorBoundary>
  )
}
