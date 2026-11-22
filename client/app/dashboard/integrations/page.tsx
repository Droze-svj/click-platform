import { redirect } from 'next/navigation'

// The old "Integrations" page read an integration catalogue (CMS/CRM
// connectors) that was never filled, so it always said "0 connected" and
// offered nothing to connect — while the sidebar, the command palette and the
// Get Started checklist sent creators here to connect TikTok/Instagram/YouTube.
// Social accounts are connected on Connect Accounts; send old links there.
export default function IntegrationsRedirect() {
  redirect('/dashboard/social')
}
