'use client'

/**
 * /dashboard/onboarding/wizard — the guided personalization flow.
 *
 * OnboardingWizard is a multi-step flow (import your best post, pick a hook
 * style, …) that writes to POST /api/me/ai-preferences and /api/user/settings.
 * Both endpoints are live and the component was never imported, so the setup it
 * performs — teaching Click your style before you make anything — could not be
 * reached.
 *
 * It lives on its own route rather than inside /dashboard/onboarding: that page
 * is a checklist of setup tasks, and a multi-step wizard embedded in a checklist
 * competes with it. The checklist links here instead.
 */

import { useRouter } from 'next/navigation'
import OnboardingWizard from '../../../../components/OnboardingWizard'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { PageShell } from '../../../../components/ui'

export default function OnboardingWizardPage() {
  const router = useRouter()

  return (
    <PageShell width="narrow" flush>
      <ErrorBoundary>
        <OnboardingWizard onComplete={() => router.push('/dashboard')} />
      </ErrorBoundary>
    </PageShell>
  )
}
