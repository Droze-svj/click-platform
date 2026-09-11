'use client'

/**
 * /dashboard/content/operations — Content Operations.
 *
 * AIContentOperationsDashboard is the largest feature in the codebase that
 * nothing imported: 28 KB covering benchmarks, competitor comparison, content-gap
 * prediction, portfolio health with auto-optimise, next-week planning, trends and
 * refresh recommendations — ten live endpoints under /api/content-operations/*
 * plus /api/teams. All of it was built, none of it reachable.
 */

import AIContentOperationsDashboard from '../../../../components/AIContentOperationsDashboard'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { PageShell } from '../../../../components/ui'

export default function ContentOperationsPage() {
  return (
    // `flush`: the dashboard supplies its own header and section padding, so the
    // shell contributes width + density rhythm only (see docs/design-system.md).
    <PageShell width="wide" flush>
      <ErrorBoundary>
        <AIContentOperationsDashboard />
      </ErrorBoundary>
    </PageShell>
  )
}
