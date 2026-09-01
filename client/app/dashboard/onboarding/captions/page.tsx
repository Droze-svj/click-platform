'use client'

import CaptionStyleSetup from '../../../../components/onboarding/CaptionStyleSetup'
import { PageShell } from '../../../../components/ui'

export default function OnboardingCaptionsPage() {
  return (
    // Canvas surface: full + flush gives it the frame without imposing page
    // padding on a setup flow that lays itself out. bg was a hardcoded #0a0a0f,
    // which rendered black in light theme.
    <PageShell width="full" flush className="min-h-screen ds-bg-mesh-soft">
      <CaptionStyleSetup />
    </PageShell>
  )
}
