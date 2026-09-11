'use client'

import dynamic from 'next/dynamic'
import { PageShell } from '../../../components/ui'
import ClickLoadingState from '../../../components/click/ClickLoadingState'

/**
 * The agency dashboard view carries recharts (and the d3 family behind it),
 * which made this the second-heaviest route in the app at 281kB of first-load
 * JS. It's a single full-bleed view, so loading it on demand costs nothing in
 * perceived speed and takes the charting library off the initial payload.
 *
 * ssr:false — the charts measure their container to size themselves.
 */
const InfiniteAgencyDashboardView = dynamic(
  () => import('../../../components/editor/views/InfiniteAgencyDashboardView'),
  { ssr: false, loading: () => <ClickLoadingState intent="loading.analyzing" variant="block" /> }
)

export default function AgencyPage() {
  return (
    // `flush` because this view manages its own full-height canvas bounds; the
    // shell is here for the shared frame rather than page padding.
    <PageShell width="full" flush className="h-screen w-full flex flex-col">
      <InfiniteAgencyDashboardView />
    </PageShell>
  )
}
