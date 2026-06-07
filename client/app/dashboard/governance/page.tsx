'use client'

import React from 'react'
import EnterpriseGovernance from '../../../components/EnterpriseGovernance'
import PlatformErrorBoundary from '@/components/ErrorBoundary'

export default function GovernancePage() {
  return (
    <PlatformErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto text-theme-primary ds-anim-fade-in">
        <EnterpriseGovernance />
      </div>
    </PlatformErrorBoundary>
  )
}
