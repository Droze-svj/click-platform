'use client'

/**
 * /dashboard/overlord — the autonomous-operations command view.
 *
 * This route rendered only Click12Dashboard (arbitrage offers + network health,
 * 4 endpoints). OverlordDashboard — 955 lines covering the syndicate debate,
 * the governance ledger, the compliance shield and fleet scaling across 9
 * endpoints — was built and then never imported by anything, so none of it was
 * reachable in the product.
 *
 * They are not duplicates: Overlord is the command view, Click12 is the
 * arbitrage/network detail. Both render here, Overlord first.
 */

import OverlordDashboard from '../../../components/OverlordDashboard'
import Click12Dashboard from '../../../components/Click12Dashboard'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

export default function OverlordPage() {
  return (
    <div className="min-h-screen bg-transparent">
      {/* Independently bounded: one dashboard failing to render must not take
          the other down with it — they read entirely separate endpoints. */}
      <ErrorBoundary>
        <OverlordDashboard />
      </ErrorBoundary>
      <ErrorBoundary>
        <Click12Dashboard />
      </ErrorBoundary>
    </div>
  )
}
