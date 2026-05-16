'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function OnboardingError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="onboarding" />
}
