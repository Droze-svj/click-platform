import { redirect } from 'next/navigation'

/**
 * /dashboard/agency used to render InfiniteAgencyDashboardView, which was
 * built almost entirely from invented values — Math.random() agent loads, a
 * hardcoded "8.42X" ROI, fixed retention/market charts, a fake settled-revenue
 * fallback and a made-up "decision ledger". Nothing in the product links here,
 * and once the fabricated parts are removed there is nothing real left to show,
 * so the route sends people to the dashboard instead of showing fakes.
 */
export default function AgencyPage() {
  redirect('/dashboard')
}
