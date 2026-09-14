'use client'

/**
 * /dashboard/toolbox — the autonomous toolbox.
 *
 * SovereignToolbox lists the tools the backend exposes at GET /api/toolbox and
 * runs them through POST /api/toolbox/execute. Both endpoints are live; the
 * component was never imported, so the entire toolbox was unreachable.
 */

import SovereignToolbox from '../../../components/SovereignToolbox'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { PageShell } from '../../../components/ui'

export default function ToolboxPage() {
  return (
    <PageShell width="wide" flush>
      <ErrorBoundary>
        <SovereignToolbox />
      </ErrorBoundary>
    </PageShell>
  )
}
