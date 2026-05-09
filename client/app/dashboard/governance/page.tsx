'use client'

import React from 'react'
import EnterpriseGovernance from '../../../components/EnterpriseGovernance'
import PlatformErrorBoundary from '@/components/ErrorBoundary'

export default function GovernancePage() {
  return (
    <PlatformErrorBoundary>
      <div className="container mx-auto py-8">
        <EnterpriseGovernance />
      </div>
    </PlatformErrorBoundary>
  )
}
